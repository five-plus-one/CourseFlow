// ========== 学习通 / 超星 适配器 ==========
// 页面结构（多任务点页，实测 2026-10）：
//   主文档 → iframe(cards) → N 个 div.ans-attach-ct（任务点）
//     每个任务点：div.ans-job-icon（aria-label=任务点未完成/已完成）
//               + iframe[src*="/ananas/modules/video|work/"]（jobid + data 元数据）
//   视频在 video iframe 的嵌套 iframe 里；作业题在 work iframe 的嵌套 iframe 里
// 旧版页：视频 Tab(#dct1) / 测验 Tab(#dct2) 两卡结构，走 legacy 路径
// 详见 docs/xuexitong-research.md

const XuexitongAdapter = {
    name: '学习通',
    id: 'xuexitong',
    urlPatterns: [
        '*://mooc1.xuexitong.com/mycourse/studentstudy*',
        '*://mooc1.chaoxing.com/mycourse/studentstudy*',
        '*://mooc2-ans.xuexitong.com/*',
        '*://mooc2-ans.chaoxing.com/*',
    ],

    shouldInitialize() {
        const h = location.hostname;
        const p = location.pathname;
        // 详情页 + 章节列表都注入（列表页只显示按钮，不做自动化）
        return /mooc[12](-ans)?\.(xuexitong|chaoxing)\.com/.test(h)
            && (/studentstudy|\/mycourse\/stu|fanyav3\/stu|\/base/.test(p));
    },

    isDetailPage() {
        return /studentstudy/.test(location.pathname);
    },

    // ---------- 递归 iframe 工具 ----------

    /** 收集所有可访问文档 */
    collectDocs(rootDoc, label = 'MAIN', depth = 0, acc = []) {
        acc.push({ doc: rootDoc, label, depth });
        if (depth > 6) return acc;
        const iframes = Array.from(rootDoc.querySelectorAll('iframe'));
        iframes.forEach((f, i) => {
            const fl = `${label}>ifr${i}${f.id ? '#' + f.id : ''}`;
            try {
                const d = f.contentDocument || (f.contentWindow && f.contentWindow.document);
                if (d && d.documentElement) this.collectDocs(d, fl, depth + 1, acc);
            } catch (e) { /* cross-origin */ }
        });
        return acc;
    },

    /** 在所有文档里 querySelector */
    findInAll(selector) {
        const docs = this.collectDocs(document);
        for (const e of docs) {
            try {
                const el = e.doc.querySelector(selector);
                if (el) return { el, doc: e.doc, label: e.label };
            } catch (err) { }
        }
        return null;
    },

    findAllInAll(selector) {
        const docs = this.collectDocs(document);
        const out = [];
        for (const e of docs) {
            try {
                e.doc.querySelectorAll(selector).forEach(el => out.push({ el, doc: e.doc, label: e.label }));
            } catch (err) { }
        }
        return out;
    },

    // ---------- 页面识别 ----------

    /** 当前激活的 Tab：video | quiz | unknown */
    getActiveTab() {
        try {
            const t1 = document.querySelector('#dct1');
            const t2 = document.querySelector('#dct2');
            if (t2 && t2.classList.contains('active')) return 'quiz';
            if (t1 && t1.classList.contains('active')) return 'video';
            // 兜底：看 iframe title
            const f = document.querySelector('iframe#iframe');
            if (f) {
                try {
                    const t = (f.contentDocument && f.contentDocument.title) || '';
                    if (/测验|作业|考试/.test(t)) return 'quiz';
                    if (/视频/.test(t)) return 'video';
                } catch (e) { }
            }
        } catch (e) { }
        return 'unknown';
    },

    detectVideoPage() {
        // 优先看 Tab：不是视频 Tab 就别当视频页
        const tab = this.getActiveTab();
        if (tab === 'quiz') return false;
        const hit = this.findInAll(XXT_SELECTORS.VIDEO_ELEMENT)
            || this.findInAll(XXT_SELECTORS.VIDEO_ELEMENT_FALLBACK);
        return !!hit;
    },

    detectQuizPage() {
        const tab = this.getActiveTab();
        // 有测验 DOM 就算测验页（哪怕同时有 video iframe 残留）
        const hit = this.findInAll(XXT_SELECTORS.QUIZ_ROOT)
            || this.findInAll('h3.newTestType')
            || this.findInAll(XXT_SELECTORS.QUIZ_FRAME)
            || this.findInAll('div.singleQuesId');
        if (hit) return true;
        return tab === 'quiz';
    },

    detectStudentStudyPage() {
        return this.shouldInitialize();
    },

    // ---------- URL / 标识 ----------

    getParams() {
        const q = new URLSearchParams(location.search);
        return {
            courseId: q.get('courseId') || this._val(XXT_SELECTORS.CUR_COURSE),
            clazzid: q.get('clazzid') || this._val(XXT_SELECTORS.CUR_CLAZZ),
            cpi: q.get('cpi') || this._val(XXT_SELECTORS.CUR_CPI),
            chapterId: q.get('chapterId') || this._val(XXT_SELECTORS.CUR_CHAPTER),
            enc: q.get('enc') || '',
        };
    },

    _val(sel) {
        const el = document.querySelector(sel);
        return el ? (el.value || '').trim() : '';
    },

    getTaskIdentifier() {
        const p = this.getParams();
        return `xxt_${p.courseId}_${p.clazzid}_${p.chapterId}`;
    },

    // ---------- 视频 ----------

    /** task 传入时只操作该任务点的 video，否则找页面第一个 */
    getVideo(task) {
        if (task && task.videoEl) return { el: task.videoEl, doc: task.videoEl.ownerDocument, label: 'task' + (task.index != null ? task.index : '') };
        return this.findInAll(XXT_SELECTORS.VIDEO_ELEMENT)
            || this.findInAll(XXT_SELECTORS.VIDEO_ELEMENT_FALLBACK);
    },

    getVideoState(task) {
        const hit = this.getVideo(task);
        if (!hit) return null;
        const v = hit.el;
        return {
            element: v,
            src: v.currentSrc || v.src || '',
            duration: v.duration || 0,
            currentTime: v.currentTime || 0,
            paused: v.paused,
            playbackRate: v.playbackRate || 1,
            ratio: v.duration ? v.currentTime / v.duration : 0,
            readyState: v.readyState,
        };
    },

    async playVideo(rate, task) {
        const hit = this.getVideo(task);
        if (!hit) return { ok: false, reason: '找不到 video 元素' };
        const v = hit.el;
        try {
            if (rate && rate > 0) v.playbackRate = rate;
            await v.play();
            return { ok: true, state: this.getVideoState(task) };
        } catch (e) {
            return { ok: false, reason: 'play() 被拒绝: ' + e.message };
        }
    },

    pauseVideo(task) {
        const hit = this.getVideo(task);
        if (hit) hit.el.pause();
    },

    isVideoJobDone() {
        // 【注意】.ans-attach-ct.videoContainer 上的 ans-job-finished 不是完成标记！
        // 它只是「任务点视频容器」的固定 class，测验页也带。别用它判断。
        // 真正的完成信号：
        //   1. 任务点图标 .ans-job-icon.ans-job-video —— 带 ans-job-icon-clear = 未完成
        //   2. video 进度达到阈值
        const icons = this.findAllInAll(XXT_SELECTORS.VIDEO_JOB_ICON);
        let sawIcon = false;
        for (const { el } of icons) {
            sawIcon = true;
            if (el.classList.contains(XXT_SELECTORS.JOB_CLEAR)) return false; // 明确未完成
            // 有些版本用 ans-job-icon-finished / 去掉 clear 表示完成
            if (el.classList.contains('ans-job-icon-finished') || el.classList.contains('finished')) return true;
        }

        // 进度：必须 duration 有效且真的播到阈值
        const st = this.getVideoState();
        if (st && st.duration > 1 && st.currentTime > 0) {
            const target = (window.__KEZHOU_MAIN__ && window.__KEZHOU_MAIN__.options.completeRatio) || 1;
            if (st.ratio >= target) return true;
        }

        // 有图标且带 clear → 未完成；没图标也没进度 → 不算完成
        return false;
    },

    // ---------- 多任务点枚举（一页多个 .ans-attach-ct）----------

    /**
     * 枚举页面上所有任务点（跨 iframe，按文档顺序）
     * @returns {Array} [{index, type, jobId, done, container, icon, iframe, meta, videoEl, label}]
     *   type: 'video' | 'work' | 'unknown'
     *   done 判定金标准：图标 aria-label（跨类型统一）
     */
    listTasks() {
        const tasks = [];
        const seen = new Set();
        const docs = this.collectDocs(document);
        for (const { doc, label } of docs) {
            let els = [];
            try { els = Array.from(doc.querySelectorAll(XXT_SELECTORS.TASK_CONTAINER)); } catch (e) { continue; }
            for (const el of els) {
                if (seen.has(el)) continue;
                seen.add(el);
                try { tasks.push(this._describeTask(el, label, tasks.length)); } catch (e) { }
            }
        }
        return tasks;
    },

    _describeTask(container, label, index) {
        // ---- 图标 + 完成判定（aria-label 金标准）----
        let icon = null;
        try { icon = container.querySelector(XXT_SELECTORS.TASK_ICON); } catch (e) { }
        const aria = icon ? (icon.getAttribute('aria-label') || '') : '';
        const cCls = container.classList;

        let done = false;
        if (aria.includes('已完成')) done = true;
        else if (aria.includes('未完成')) done = false;
        else if (cCls.contains(XXT_SELECTORS.JOB_FINISHED)) done = true;
        else if (icon && icon.classList.contains(XXT_SELECTORS.JOB_CLEAR)) done = false;
        else if (icon && (icon.classList.contains('ans-job-icon-finished') || icon.classList.contains('finished'))) done = true;

        // ---- iframe + 类型 + jobid ----
        let iframe = null;
        try {
            iframe = container.querySelector(XXT_SELECTORS.TASK_IFRAME_VIDEO)
                || container.querySelector(XXT_SELECTORS.TASK_IFRAME_WORK)
                || container.querySelector('iframe');
        } catch (e) { }

        let type = 'unknown';
        let jobId = '';
        let meta = null;
        if (iframe) {
            const src = iframe.getAttribute('src') || '';
            if (/\/ananas\/modules\/video\//.test(src)
                || (icon && icon.classList.contains('ans-job-video'))
                || cCls.contains('videoContainer')) type = 'video';
            else if (/\/ananas\/modules\/work\//.test(src)) type = 'work';

            jobId = iframe.getAttribute('jobid') || '';
            try {
                const d = iframe.getAttribute('data');
                if (d) meta = JSON.parse(d);
                if (!jobId && meta && (meta.jobid || meta._jobid)) jobId = meta.jobid || meta._jobid;
            } catch (e) { }
        }

        // ---- video 元素（在 iframe 嵌套链里）----
        let videoEl = null;
        if (type === 'video' && iframe) {
            videoEl = this._findVideoIn(iframe);
        }

        return { index, type, jobId: String(jobId), done, container, icon, iframe, meta, videoEl, label };
    },

    /** 在 iframe 嵌套链里找 <video> */
    _findVideoIn(iframe, depth = 0) {
        if (!iframe || depth > 4) return null;
        try {
            const d = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
            if (!d) return null;
            const v = d.querySelector(XXT_SELECTORS.VIDEO_ELEMENT) || d.querySelector('video');
            if (v) return v;
            for (const f of Array.from(d.querySelectorAll('iframe'))) {
                const hit = this._findVideoIn(f, depth + 1);
                if (hit) return hit;
            }
        } catch (e) { }
        return null;
    },

    /** 在 iframe 嵌套链里找含指定选择器的文档（作业题） */
    findDocIn(iframe, selector, depth = 0) {
        if (!iframe || depth > 4) return null;
        try {
            const d = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
            if (!d) return null;
            if (d.querySelector(selector)) return d;
            for (const f of Array.from(d.querySelectorAll('iframe'))) {
                const hit = this.findDocIn(f, selector, depth + 1);
                if (hit) return hit;
            }
        } catch (e) { }
        return null;
    },

    /** 取任务点的作业文档（每次重新解析，内容可能懒加载） */
    getTaskQuizDoc(task) {
        if (!task) return null;
        if (task.iframe) {
            const d = this.findDocIn(task.iframe, 'div.singleQuesId, #ZyBottom');
            if (d) return d;
        }
        return null;
    },

    /**
     * 单个任务点是否完成（scoped，不受其他任务点污染）
     * 优先重读 DOM（平台会更新图标 class/aria），视频再加进度兜底
     */
    isTaskDone(task) {
        if (!task) return false;
        try {
            const icon = task.icon || (task.container && task.container.querySelector
                ? task.container.querySelector(XXT_SELECTORS.TASK_ICON) : null);
            const aria = icon ? (icon.getAttribute('aria-label') || '') : '';
            if (aria.includes('已完成')) return true;
            if (aria.includes('未完成')) {
                // 视频：进度兜底（平台可能还没刷图标）
                if (task.type === 'video') {
                    const st = this.getVideoState(task);
                    if (st && st.duration > 1 && st.currentTime > 0) {
                        const target = (window.__KEZHOU_MAIN__ && window.__KEZHOU_MAIN__.options.completeRatio) || 1;
                        if (st.ratio >= target) return true;
                    }
                }
                return false;
            }
            if (task.container && task.container.classList
                && task.container.classList.contains(XXT_SELECTORS.JOB_FINISHED)) return true;
            if (icon && icon.classList && icon.classList.contains(XXT_SELECTORS.JOB_CLEAR)) return false;
            if (icon && icon.classList
                && (icon.classList.contains('ans-job-icon-finished') || icon.classList.contains('finished'))) return true;
        } catch (e) { }
        return !!task.done;
    },

    // ---------- 知识点 Tab（多任务点页的 #dct1/#dct2 是知识点切换）----------

    listKnowledgeTabs() {
        const out = [];
        (XXT_SELECTORS.KNOWLEDGE_TABS || []).forEach(sel => {
            try {
                const el = document.querySelector(sel);
                if (el) {
                    out.push({
                        el,
                        id: (el.id || sel).replace('#', ''),
                        label: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
                        active: el.classList.contains('active'),
                    });
                }
            } catch (e) { }
        });
        return out;
    },

    /** 切到「当前 Tab 之后」的下一个知识点 Tab；没有则返回 false */
    nextKnowledgeTab() {
        const tabs = this.listKnowledgeTabs();
        // 只往后走：取当前 active 的下一个，避免点回前一个造成死循环
        const activeIdx = tabs.findIndex(t => t.active);
        const next = activeIdx >= 0 ? tabs[activeIdx + 1] : tabs.find(t => !t.active);
        if (next && !next.active) { next.el.click(); return true; }
        return false;
    },

    // ---------- 测验 ----------

    /** 抓取题目（从 iframe#frame_content） */
    gatherQuestions() {
        const docs = this.collectDocs(document);
        const questions = [];

        for (const { doc, label } of docs) {
            try {
                // 方法 A：常见题目容器
                const stems = doc.querySelectorAll(
                    '.questionLi, .question, [class*="questionItem"], .singleQuestion, ' +
                    '[id^="question"], .mark_item, .examPaper_subject, li[id^="q"]'
                );
                stems.forEach((el, i) => {
                    const q = this._parseQuestionEl(el, doc, questions.length + i);
                    if (q) questions.push(q);
                });

                // 方法 B：按【题型】文本切（兜底）
                if (questions.length === 0) {
                    const all = Array.from(doc.querySelectorAll('div,li,p'));
                    const hits = all.filter(el => {
                        const t = (el.textContent || '').trim();
                        return t.length > 8 && t.length < 600 && /【(单选题|多选题|判断题|填空题|简答题)】/.test(t);
                    });
                    hits.forEach((el, i) => {
                        const q = this._parseQuestionEl(el, doc, i);
                        if (q) questions.push(q);
                    });
                }
            } catch (e) { }
        }

        // 去重（同一题可能被两层匹配）
        const seen = new Set();
        return questions.filter(q => {
            const k = q.stem.slice(0, 40);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    },

    _parseQuestionEl(el, doc, index) {
        const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (raw.length < 6) return null;

        let type = 'unknown';
        if (/【多选题】|多选题/.test(raw)) type = 'multi';
        else if (/【单选题】|单选题/.test(raw)) type = 'single';
        else if (/【判断题】|判断题/.test(raw)) type = 'judge';
        else if (/【填空题】|填空题/.test(raw)) type = 'blank';
        else if (/【简答题】|简答题/.test(raw)) type = 'essay';

        // 题干：去掉题型前缀和选项
        let stem = raw
            .replace(/^\d+\s*/, '')
            .replace(/【[^】]+】\s*/, '')
            .replace(/\s*[A-D][、.．]\s*[^A-D]{0,80}(?=\s*[A-D][、.．]|$)/g, '')
            .trim();

        // 选项
        const options = [];
        const optEls = el.querySelectorAll(
            'input[type=radio], input[type=checkbox], [class*="option"], [class*="xuanxiang"], label'
        );
        optEls.forEach(o => {
            let text = (o.textContent || '').trim();
            if (!text && o.parentElement) text = (o.parentElement.textContent || '').trim();
            const m = text.match(/^([A-H])[、.．\s]*(.+)$/);
            if (m) {
                options.push({
                    key: m[1],
                    text: m[2].trim(),
                    element: o.tagName === 'INPUT' ? o : (o.querySelector('input') || o),
                });
            }
        });

        // 兜底：从题干文本里抠选项
        if (options.length === 0) {
            const optRe = /([A-H])[、.．]\s*([^A-D]{1,60}?)(?=\s+[A-H][、.．]|$)/g;
            let m;
            while ((m = optRe.exec(raw)) !== null) {
                options.push({ key: m[1], text: m[2].trim(), element: null });
            }
        }

        // 题目 id（用于 addStudentWorkNew 的 answer<qid>）
        let qid = el.id || el.getAttribute('data-qid') || el.getAttribute('data-id') || '';
        if (!qid) {
            const input = el.querySelector('input[id^="answer"], input[name^="answer"]');
            if (input) {
                const mm = (input.id || input.name || '').match(/(\d{5,})/);
                if (mm) qid = mm[1];
            }
        }

        return {
            index,
            type,
            stem: stem.slice(0, 500),
            options,
            qid,
            element: el,
            raw: raw.slice(0, 800),
        };
    },

    /** 点选项 */
    selectOption(question, key) {
        const opt = question.options.find(o => o.key === key);
        if (!opt) return false;

        if (opt.element && opt.element.tagName === 'INPUT') {
            opt.element.click();
            opt.element.checked = true;
            opt.element.dispatchEvent(new Event('change', { bubbles: true }));
            opt.element.dispatchEvent(new Event('click', { bubbles: true }));
            return true;
        }
        if (opt.element) {
            opt.element.click();
            return true;
        }
        // 按文本找
        const doc = question.element.ownerDocument;
        const labels = Array.from(doc.querySelectorAll('label, .option, [class*="option"]'));
        for (const lab of labels) {
            const t = (lab.textContent || '').trim();
            if (t.startsWith(key) || t.includes(key + '、') || t.includes(key + '.')) {
                lab.click();
                return true;
            }
        }
        return false;
    },

    /** 保存 / 提交（走 UI） */
    async saveOrSubmit(mode = 'temp') {
        // mode: 'temp' = 暂时保存, 'submit' = 提交
        const label = mode === 'submit' ? /提交/ : /暂时保存|暂存|保存/;
        const docs = this.collectDocs(document);
        let btn = null;

        for (const { doc } of docs) {
            try {
                const btns = Array.from(doc.querySelectorAll('button, input[type=button], input[type=submit], a, div'));
                btn = btns.find(b => {
                    const t = ((b.textContent || b.value || '')).trim();
                    return t.length < 12 && label.test(t) && !/取消/.test(t);
                });
                if (btn) break;
            } catch (e) { }
        }

        if (!btn) return { ok: false, reason: '找不到' + (mode === 'submit' ? '提交' : '暂时保存') + '按钮' };
        btn.click();

        // 确认弹窗
        await new Promise(r => setTimeout(r, 400));
        const ok = document.querySelector(XXT_SELECTORS.CONFIRM_OK);
        if (ok && ok.offsetParent !== null) ok.click();

        return { ok: true };
    },

    // ---------- 导航 ----------

    nextChapter() {
        const el = document.querySelector(XXT_SELECTORS.BTN_NEXT);
        if (el) { el.click(); return true; }
        return false;
    },

    prevChapter() {
        const el = document.querySelector(XXT_SELECTORS.BTN_PREV);
        if (el) { el.click(); return true; }
        return false;
    },

    switchTab(tab) {
        const sel = tab === 'video' ? XXT_SELECTORS.TAB_VIDEO : XXT_SELECTORS.TAB_QUIZ;
        const el = document.querySelector(sel);
        if (el) { el.click(); return true; }
        return false;
    },

    // ---------- 视频中插题 ----------

    /**
     * 检测视频中插题层是否出现
     * 真实结构（.tkTopic）：
     *   .tkTopic_title 单选题
     *   .tkItem_title 题干
     *   li.ans-videoquiz-opt > label > span.tkRadio > input[type=radio]  + 文本 A、Java
     *   #videoquiz-submit 提交 / #videoquiz-continue 继续学习 / #videoquiz-submitting 提交中
     *   #spanHas 恭喜你答对了 / #spanNot 真遗憾
     */
    detectMidVideoQuiz() {
        const docs = this.collectDocs(document);
        for (const { doc, label } of docs) {
            try {
                const root = doc.querySelector('.tkTopic');
                if (!root) continue;
                const r = root.getBoundingClientRect();
                if (r.width < 100 || r.height < 60) continue;
                const cs = getComputedStyle(root);
                if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                return { root, doc, label };
            } catch (e) { }
        }
        return null;
    },

    /** 元素是否真正可见（兼容 CSS 隐藏，不能只看 style.display） */
    _isReallyVisible(el) {
        if (!el) return false;
        try {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
            const r = el.getBoundingClientRect();
            return r.width > 8 && r.height > 8;
        } catch (e) { return false; }
    },

    /** 中插题是否已经答完 */
    isMidQuizResolved(doc) {
        try {
            const d = doc || this._findAnyDoc();
            // 「继续学习」真正可见 = 已答完
            const cont = d.querySelector('#videoquiz-continue');
            if (this._isReallyVisible(cont)) return true;
            // 「恭喜你答对了」真正可见
            const spanHas = d.querySelector('#spanHas');
            if (this._isReallyVisible(spanHas) && (spanHas.textContent || '').trim()) return true;
            const tip = d.querySelector('#InteractiveQuizTip');
            if (this._isReallyVisible(tip)) return true;
            // 提交按钮隐藏 + 有勾选 = 已提交
            const submit = d.querySelector('#videoquiz-submit');
            const checked = d.querySelector('input[name="ans-videoquiz-opt"]:checked');
            if (submit && !this._isReallyVisible(submit) && checked) return true;
        } catch (e) { }
        return false;
    },

    parseMidQuiz(hit) {
        if (!hit) return null;
        const root = hit.root;
        const doc = hit.doc;
        const raw = (root.textContent || '').replace(/\s+/g, ' ').trim();

        const titleEl = root.querySelector('.tkTopic_title');
        const typeText = titleEl ? titleEl.textContent : raw;
        let type = 'single';
        if (/多选/.test(typeText)) type = 'multi';
        else if (/判断/.test(typeText)) type = 'judge';
        else if (/单选/.test(typeText)) type = 'single';

        const stemEl = root.querySelector('.tkItem_title');
        const stem = stemEl ? (stemEl.textContent || '').trim() : '';

        const options = [];
        root.querySelectorAll('li.ans-videoquiz-opt').forEach((li, i) => {
            const input = li.querySelector('input[type=radio], input[type=checkbox]');
            const label = li.querySelector('label');
            let text = (label ? label.textContent : li.textContent || '').replace(/\s+/g, ' ').trim();
            const m = text.match(/^([A-H])[、.．:：]?\s*(.+)$/);
            const key = m ? m[1] : String.fromCharCode(65 + i);
            options.push({
                key,
                text: m ? m[2].trim() : text,
                element: li,
                input,
            });
        });

        return { type, stem, options, root, raw: raw.slice(0, 300), doc };
    },

    /** 中插题：点选项 + 点提交；若已答完则点「继续学习」 */
    submitMidQuiz(midQ, answerKey) {
        const doc = midQ.doc || midQ.root.ownerDocument;

        // 已答完 → 直接点继续
        if (this.isMidQuizResolved(doc)) {
            return this.clickMidQuizContinue(doc) ? 'continue' : false;
        }

        const key = String(answerKey).toUpperCase();
        const opt = midQ.options.find(o => o.key === key)
            || midQ.options.find(o => o.key === key[0]);
        if (!opt) return false;

        try {
            opt.element.click();
            if (opt.input) {
                opt.input.checked = true;
                opt.input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const lab = opt.element.querySelector('label');
            if (lab) lab.click();
        } catch (e) { }

        // 点 #videoquiz-submit（真正可见时）
        setTimeout(() => {
            const submit = doc.querySelector('#videoquiz-submit');
            if (this._isReallyVisible(submit)) {
                submit.click();
            } else {
                this.clickMidQuizContinue(doc);
            }
        }, 150);
        return true;
    },

    /** 中插题：点「继续学习」恢复播放 */
    clickMidQuizContinue(doc) {
        const docs = [];
        if (doc) docs.push(doc);
        try {
            this.collectDocs(document).forEach(e => { if (e.doc) docs.push(e.doc); });
        } catch (e) { }
        docs.push(document);

        for (const d of docs) {
            try {
                const cont = d.querySelector('#videoquiz-continue');
                if (this._isReallyVisible(cont)) {
                    cont.click();
                    return true;
                }
            } catch (e) { }
        }
        // 文本兜底
        try {
            for (const d of docs) {
                const els = Array.from(d.querySelectorAll('a, button'));
                const b = els.find(e => (e.textContent || '').trim() === '继续学习' && this._isReallyVisible(e));
                if (b) { b.click(); return true; }
            }
        } catch (e) { }
        return false;
    },

    _findAnyDoc() {
        const docs = this.collectDocs(document);
        for (const { doc } of docs) {
            try { if (doc.querySelector('.tkTopic')) return doc; } catch (e) { }
        }
        return document;
    },

    // ---------- 限制弹窗 ----------

    checkLimits() {
        const docs = this.collectDocs(document);
        for (const { doc } of docs) {
            try {
                const pops = doc.querySelectorAll(XXT_SELECTORS.LIMIT_POPUP);
                for (const p of pops) {
                    const visible = p.offsetParent !== null || getComputedStyle(p).display !== 'none';
                    if (!visible) continue;
                    const t = (p.textContent || '').trim();
                    if (t && SCRIPT_CONFIG.LIMIT_KEYWORDS.some(k => t.includes(k))) {
                        return { limited: true, message: t.slice(0, 120) };
                    }
                }
            } catch (e) { }
        }
        return { limited: false };
    },
};

// 注册到全局，供核心层访问
window.__KEZHOU_ADAPTER__ = XuexitongAdapter;
