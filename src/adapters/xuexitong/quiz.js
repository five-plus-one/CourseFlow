// ========== 学习通 测验解析 / 填答（按真实 DOM） ==========
// 来源：用户提供的章节测验 HTML（RightCon / ZyBottom / singleQuesId）

const XXTQuiz = {
    /**
     * 测验是否已经作答过（成绩已出 / 已完成）
     * 文本特征：「已完成」「本次成绩」「第1次作答」「我的答案」
     * 传入 doc 时只查该文档（多任务点下不能被别的作业污染）
     */
    isQuizAlreadyDone(doc) {
        const docs = [];
        if (doc) {
            docs.push(doc);
        } else {
            try {
                const adapter = window.__KEZHOU_ADAPTER__;
                if (adapter && adapter.collectDocs) {
                    adapter.collectDocs(document).forEach(e => { if (e.doc) docs.push(e.doc); });
                }
            } catch (e) { }
            docs.push(document);
        }

        for (const d of docs) {
            try {
                const t = (d.body ? d.body.innerText : '') || '';
                // 成绩已出 / 已完成
                if (/本次成绩\s*\d/.test(t)) return '已出成绩';
                if (/第\d+次作答/.test(t) && /我的答案/.test(t)) return '已有作答记录';
                // 任务点已完成 + 测验区有「已完成」标记
                const doneBadge = d.querySelector('.testTit_status, [class*="finish"], [class*="done"]');
                if (doneBadge && /已完成/.test(doneBadge.textContent || '')) return '测验标记已完成';
            } catch (e) { }
        }
        return null;
    },

    /**
     * 抓取「已作答」测验的作答记录（题干/选项/我的答案/分数/解析）
     * 返回 [{stem, options, myAnswer, correct, score, explain}]
     * 传入 doc 时只查该文档（多任务点下不能混入别的作业）
     */
    extractAnsweredRecords(doc) {
        const docs = [];
        if (doc) {
            docs.push(doc);
        } else {
            try {
                const adapter = window.__KEZHOU_ADAPTER__;
                if (adapter && adapter.collectDocs) {
                    adapter.collectDocs(document).forEach(e => { if (e.doc) docs.push(e.doc); });
                }
            } catch (e) { }
            docs.push(document);
        }

        const out = [];
        for (const d of docs) {
            try {
                // 题目块：.singleQuesId 或 .TiMu
                const blocks = d.querySelectorAll('div.singleQuesId, div.TiMu');
                blocks.forEach((el, i) => {
                    const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
                    if (raw.length < 10) return;

                    // 我的答案
                    const myM = raw.match(/我的答案[:：]\s*([^分得]{1,20})/);
                    const myAnswer = myM ? myM[1].trim() : '';
                    // 标准答案
                    const corM = raw.match(/标准答案[:：]\s*([^分得]{1,20})/);
                    const correct = corM ? corM[1].trim() : '';
                    // 分数
                    const scoreM = raw.match(/(\d+(?:\.\d+)?)\s*分/);
                    const score = scoreM ? scoreM[1] : '';
                    // 题干
                    const stemEl = el.querySelector('.fontLabel, .Zy_TItle, .tkItem_title');
                    let stem = stemEl ? (stemEl.textContent || '').replace(/\s+/g, ' ').trim() : raw.slice(0, 120);
                    stem = stem.replace(/我的答案[\s\S]*$/, '').replace(/【[^】]+】/, '').trim();
                    // 选项
                    const options = [];
                    el.querySelectorAll('li[class*="before-after"] a, ul.Zy_ulTop li a.after').forEach(a => {
                        const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
                        if (t) options.push({ text: t });
                    });
                    // 解析
                    const expEl = el.querySelector('[class*="analysis"], [class*="parse"], .tkParsing_con');
                    const explain = expEl ? (expEl.textContent || '').trim() : '';

                    out.push({ stem: stem.slice(0, 200), options, myAnswer, correct, score, explain, index: i });
                });
            } catch (e) { }
        }
        return out;
    },

    /**
     * 解析所有题目
     * 结构：
     *   div.singleQuesId#question<qid>
     *     div.TiMu.newTiMu[data=qtype]
     *       div.Zy_TItle → span.newZy_TItle「【单选题】」 + 题干
     *       ul.Zy_ulTop > li[onclick=addChoice|addMultipleChoice][qid][qtype]
     *         span.num_option[.check_answer][data=A|true]  → 选项字母
     *         a.after → 选项文本
     *       input#answer<qid>  hidden
     *       input#answertype<qid> hidden
     */
    parse(doc) {
        doc = doc || this._findQuizDoc();
        if (!doc) return [];

        const roots = doc.querySelectorAll('div.singleQuesId, div[id^="question"]');
        const questions = [];

        roots.forEach((el, i) => {
            const qid = el.getAttribute('data') || (el.id || '').replace('question', '');
            const tiMu = el.querySelector('.TiMu') || el;
            const qtype = tiMu.getAttribute('data') || '';

            // 题型
            let type = 'unknown';
            const typeSpan = el.querySelector('.newZy_TItle');
            const typeText = typeSpan ? typeSpan.textContent : (el.textContent || '');
            if (/多选/.test(typeText) || qtype === '1') type = 'multi';
            else if (/单选/.test(typeText) || qtype === '0') type = 'single';
            else if (/判断/.test(typeText) || qtype === '3') type = 'judge';
            else if (/填空/.test(typeText) || qtype === '2') type = 'blank';

            // 题干：去题型前缀
            const titleBox = el.querySelector('.fontLabel, .Zy_TItle');
            let stem = '';
            if (titleBox) {
                // clone 去掉 newZy_TItle
                const c = titleBox.cloneNode(true);
                c.querySelectorAll('.newZy_TItle').forEach(n => n.remove());
                stem = (c.textContent || '').replace(/\s+/g, ' ').trim();
            }

            // 选项
            const options = [];
            el.querySelectorAll('ul.Zy_ulTop > li, .Py_tk ul > li').forEach((li, j) => {
                const span = li.querySelector('span.num_option, span.num_option_dx');
                const key = (span && span.getAttribute('data'))
                    ? span.getAttribute('data')
                    : (span ? span.textContent.trim() : String.fromCharCode(65 + j));
                const a = li.querySelector('a.after') || li.querySelector('a');
                const text = (a ? a.textContent : '').replace(/\s+/g, ' ').trim();
                const checked = !!(span && span.classList.contains('check_answer'))
                    || li.getAttribute('aria-checked') === 'true';
                options.push({
                    key: String(key).toUpperCase().length === 1 ? String(key).toUpperCase() : key,
                    text,
                    element: li,
                    span,
                    checked,
                });
            });

            // hidden inputs
            const ansInput = el.querySelector('input[id^="answer"]:not([id^="answerEditor"]):not([id^="answerwqbid"]), input[name^="answer"]:not([name^="answerEditor"])');
            const typeInput = el.querySelector('input[id^="answertype"]');

            // 填空题：提取每个空的 UEditor 实例 / hidden textarea
            const blanks = [];
            if (type === 'blank') {
                el.querySelectorAll('div.blankItemDiv').forEach((bd, bi) => {
                    const ta = bd.querySelector('textarea[name^="answerEditor"], textarea[id^="answerEditor"]');
                    const inpDiv = bd.querySelector('div[id^="inpDiv"]');
                    blanks.push({
                        index: bi,
                        textArea: ta,
                        inpDiv,
                        ueId: ta ? ta.id : '',  // UE.getEditor 的 id，如 "answerEditor4057563601"
                    });
                });
            }

            questions.push({
                index: i,
                qid,
                type,
                stem,
                options,
                element: el,
                ansInput,
                typeInput,
                blanks,
                current: ansInput ? ansInput.value : '',
            });
        });

        return questions;
    },

    _findQuizDoc() {
        // 在所有可访问文档里找 ZyBottom / singleQuesId
        const adapter = window.__KEZHOU_ADAPTER__;
        if (adapter && adapter.collectDocs) {
            const docs = adapter.collectDocs(document);
            for (const { doc } of docs) {
                try {
                    if (doc.querySelector('div.singleQuesId, #ZyBottom')) return doc;
                } catch (e) { }
            }
        }
        return document.querySelector('#ZyBottom') ? document : null;
    },

    /**
     * 填空题：写 UEditor 编辑器内容
     * 单空：直接写全文
     * 多空：用 ;; 分隔（如 "答案1;;答案2"），逐个写入
     */
    _fillBlank(question, answer) {
        const blanks = question.blanks || [];
        if (!blanks.length) return false;

        // 拆分多空答案（;; 或 | 分隔）
        const parts = String(answer).split(/;;|\|/).map(s => s.trim()).filter(Boolean);
        let ok = 0;

        for (let i = 0; i < blanks.length; i++) {
            const b = blanks[i];
            const text = parts[i] !== undefined ? parts[i] : (blanks.length === 1 ? String(answer).trim() : '');
            if (!text) continue;

            // 优先走 UEditor API
            let filled = false;
            try {
                const ue = window.UE && UE.getEditor && UE.getEditor(b.ueId);
                if (ue && ue.setContent) {
                    ue.setContent(text);
                    filled = true;
                }
            } catch (e) { }

            // 退化：写 hidden textarea + 触发 contentChange
            if (!filled && b.textArea) {
                try {
                    b.textArea.value = text;
                    b.textArea.dispatchEvent(new Event('change', { bubbles: true }));
                    b.textArea.dispatchEvent(new Event('input', { bubbles: true }));
                    // 同步 inpDiv（平台靠这个显示内容）
                    if (b.inpDiv) {
                        b.inpDiv.innerHTML = text;
                        b.inpDiv.style.display = 'block';
                    }
                    filled = true;
                } catch (e) { }
            }

            if (filled) ok++;
        }

        // 更新 tiankongsize 和 answerwqbid
        try {
            const tkSize = question.element.querySelector('input[name^="tiankongsize"]');
            if (tkSize) tkSize.value = String(blanks.length);
        } catch (e) { }

        // 标记已作答（answerwqbid）
        try {
            const wq = document.getElementById('answerwqbid')
                || (question.element.ownerDocument && question.element.ownerDocument.getElementById('answerwqbid'));
            if (wq && question.qid) {
                const cur = (wq.value || '').split(',').filter(Boolean);
                if (!cur.includes(question.qid)) {
                    cur.push(question.qid);
                    wq.value = cur.join(',') + ',';
                }
            }
        } catch (e) { }

        return ok > 0;
    },

    /**
     * 选中答案
     * 单选/判断：点 li（触发 addChoice），设 hidden = 'A' / 'true'/'false'
     * 多选：逐个点 li（addMultipleChoice），设 hidden = 'ABC'
     * 填空：写 UEditor 编辑器内容
     */
    select(question, answer) {
        // answer: 'A' | 'AB' | 'true'/'false' | '对'/'错' | 填空文本
        const t = question.type;

        // ---- 填空题：写 UEditor ----
        if (t === 'blank') {
            return this._fillBlank(question, answer);
        }

        let keys = [];
        if (t === 'judge') {
            const v = (answer === 'true' || answer === '对' || answer === 'A' || answer === '对的') ? 'true' : 'false';
            keys = [v];
        } else {
            keys = String(answer).toUpperCase().split('').filter(c => /[A-H]/.test(c));
        }

        let clicked = 0;
        for (const k of keys) {
            // 找选项
            let opt = question.options.find(o =>
                o.key === k || o.key === k.toUpperCase() ||
                (t === 'judge' && ((k === 'true' && o.text.includes('对')) || (k === 'false' && o.text.includes('错'))))
            );
            if (!opt) continue;

            // 点 li（走平台自己的 addChoice / addMultipleChoice）
            try {
                const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
                opt.element.dispatchEvent(ev);
                // 有些环境 click() 更可靠
                opt.element.click();
            } catch (e) { }

            // 状态 class
            try {
                if (opt.span) {
                    if (t === 'multi') opt.span.classList.add('check_answer');
                    else {
                        question.options.forEach(o => o.span && o.span.classList.remove('check_answer'));
                        opt.span.classList.add('check_answer');
                    }
                }
            } catch (e) { }
            clicked++;
        }

        // 写 hidden input（平台提交靠这个）
        if (question.ansInput) {
            let val = '';
            if (t === 'judge') {
                val = keys[0] || 'true';
            } else if (t === 'multi') {
                val = keys.join('');
            } else {
                val = keys[0] || '';
            }
            question.ansInput.value = val;
            try {
                question.ansInput.dispatchEvent(new Event('change', { bubbles: true }));
                question.ansInput.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (e) { }
        }

        // answerwqbid
        try {
            const wq = document.getElementById('answerwqbid')
                || (question.element.ownerDocument && question.element.ownerDocument.getElementById('answerwqbid'));
            if (wq && question.qid) {
                const cur = (wq.value || '').split(',').filter(Boolean);
                if (!cur.includes(question.qid)) {
                    cur.push(question.qid);
                    wq.value = cur.join(',') + ',';
                }
            }
        } catch (e) { }

        return clicked > 0;
    },

    /** 暂时保存（onclick=noSubmit） */
    saveTemp(doc) {
        doc = doc || this._findQuizDoc() || document;
        const btn = doc.querySelector('a.btnSave span#tempsave')
            || doc.querySelector('a.btnSave')
            || doc.querySelector('#tempsave');
        if (btn) {
            const target = btn.closest('a') || btn;
            target.click();
            // 也直接调平台函数，双保险
            try {
                const win = doc.defaultView;
                if (win && typeof win.noSubmit === 'function') win.noSubmit();
            } catch (e) { }
            return { ok: true, via: target.className || target.id };
        }
        return { ok: false, reason: '找不到「暂时保存」' };
    },

    /** 提交（onclick=btnBlueSubmit，会弹「确认提交？」） */
    submit(doc) {
        doc = doc || this._findQuizDoc() || document;
        const btn = doc.querySelector('a.btnSubmit')
            || Array.from(doc.querySelectorAll('a,button,span')).find(e =>
                ((e.textContent || e.title || '')).trim() === '提交');
        if (btn) {
            const target = btn.closest('a') || btn;
            target.click();
            try {
                const win = doc.defaultView;
                if (win && typeof win.btnBlueSubmit === 'function') win.btnBlueSubmit();
            } catch (e) { }
            return { ok: true };
        }
        return { ok: false, reason: '找不到「提交」' };
    },

    /** 点确认框「确定」（学习通「确认提交？」弹窗，在 quiz iframe 内） */
    confirmYes(doc) {
        const docs = [];
        if (doc) docs.push(doc);
        // 递归找所有可访问文档
        const adapter = window.__KEZHOU_ADAPTER__;
        if (adapter && adapter.collectDocs) {
            adapter.collectDocs(document).forEach(e => { if (e.doc) docs.push(e.doc); });
        }
        docs.push(document);

        for (const d of docs) {
            try {
                // #confirmSubWin 里的「确定」onclick=submitCheckTimes
                const win = d.querySelector('#confirmSubWin');
                if (win) {
                    const cs = getComputedStyle(win);
                    if (cs.display !== 'none' && cs.visibility !== 'hidden') {
                        const ok = win.querySelector('a.bluebtn')
                            || Array.from(win.querySelectorAll('a')).find(a => (a.textContent || '').trim() === '确定');
                        if (ok) { ok.click(); return true; }
                    }
                }
                // #workpop 确认弹窗
                const pop = d.querySelector('#workpop');
                if (pop && getComputedStyle(pop).display !== 'none') {
                    const ok = pop.querySelector('#popok');
                    if (ok) { ok.click(); return true; }
                }
                // 通用：可见弹窗里的「确定」
                const alerts = d.querySelectorAll('.AlertCon02, .popDiv');
                for (const a of alerts) {
                    const cs = getComputedStyle(a);
                    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                    const r = a.getBoundingClientRect();
                    if (r.width < 80 || r.height < 50) continue;
                    const t = (a.textContent || '');
                    if (!/确认|提交|保存/.test(t)) continue;
                    const ok = Array.from(a.querySelectorAll('a, button')).find(x => {
                        const xt = (x.textContent || '').trim();
                        return xt === '确定' || xt === '提交';
                    });
                    if (ok) { ok.click(); return true; }
                }
            } catch (e) { }
        }
        return false;
    },

    /**
     * 处理「当前章节还有任务点未完成」弹窗
     * 只在弹窗真正可见时点按钮（页面里常驻同款隐藏 DOM，必须判可见性）
     */
    handleTaskPopup(action = 'stay') {
        // 只认真正弹出的遮罩层，不用全文匹配（页面常驻隐藏模板）
        const masks = document.querySelectorAll('.maskDiv, .AlertCon02');
        for (const m of masks) {
            const t = (m.textContent || '');
            if (!t.includes('还有任务点未完成') || !t.includes('是否去完成')) continue;
            const cs = getComputedStyle(m);
            if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
            const r = m.getBoundingClientRect();
            if (r.width < 100 || r.height < 80) continue;

            const btns = Array.from(m.querySelectorAll('a, button'));
            const learn = btns.find(b => /去学习/.test(b.textContent || ''));
            const next = btns.find(b => /下一节/.test(b.textContent || ''));
            const close = btns.find(b => /关闭|取消/.test(b.textContent || '') || /popClose|close/i.test(b.className || ''));

            if (action === 'next' && next) { next.click(); return true; }
            if (action === 'learn' && learn) { learn.click(); return true; }
            if (close) { close.click(); return true; }
            // 可见但没按钮可点 —— 不算处理，避免刷屏
            return false;
        }
        return false;
    },
};
