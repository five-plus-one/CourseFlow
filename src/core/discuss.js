// ========== 课舟 自动讨论（发帖 + 点赞）==========
// DOM 来源：research/diagnose-discuss.js 实测（2026-10-04）+ 用户提供的 mooc2-ans 发帖表单 HTML
// 兼容两种页面：
//   A. mooc2-ans 讨论页（input[name="title"] + UEditor 富文本 + .edit_btn 发布）
//   B. 学习页侧栏（input#toplevelTextCommentTitle + textarea#toplevelTextCommentContent）

const KZDiscuss = {
    KEY_COUNT: 'kezhou-discuss-count',
    KEY_LOG: 'kezhou-discuss-log',

    // ---- 计数 ----
    getCount(courseId) {
        try {
            const m = JSON.parse(GM_getValue(this.KEY_COUNT) || '{}');
            return m[String(courseId)] || 0;
        } catch (e) { return 0; }
    },

    _bumpCount(courseId) {
        try {
            const m = JSON.parse(GM_getValue(this.KEY_COUNT) || '{}');
            const k = String(courseId);
            m[k] = (m[k] || 0) + 1;
            GM_setValue(this.KEY_COUNT, JSON.stringify(m));
        } catch (e) { }
    },

    _log(entry) {
        try {
            const arr = JSON.parse(GM_getValue(this.KEY_LOG) || '[]');
            arr.push({ t: new Date().toISOString(), ...entry });
            GM_setValue(this.KEY_LOG, JSON.stringify(arr.slice(-50)));
        } catch (e) { }
    },

    // ---- AI 批量生成讨论内容（一次调用生成 N 条）----
    async generateTopics(count, courseName, chapterName) {
        const prompt =
            `你是一个大学生，正在学习《${courseName || '这门课程'}》` +
            (chapterName ? `，当前章节是"${chapterName}"` : '') + `。\n` +
            `请一次性写出 ${count} 条讨论帖，像学生在讨论区分享学习心得或提出思考问题。\n` +
            `语气自然、有个人见解，不要像 AI 写的。可以联系实际生活或社会现象。\n` +
            `每条主题角度不同，每条正文 80~150 字。\n\n` +
            `严格按以下格式输出，用 === 分隔每条（不要多余文字）：\n` +
            `标题：xxx\n正文：xxx\n===\n标题：xxx\n正文：xxx`;

        try {
            const r = await AIEngine.chat(prompt, '你是一个大学生，正在课程讨论区发帖。');
            if (!r.ok || !r.text) return [];

            const topics = [];
            const blocks = r.text.split(/={3,}/);
            for (const block of blocks) {
                const titleM = block.match(/标题[:：]\s*(.+)/);
                const bodyM = block.match(/正文[:：]\s*([\s\S]+)/);
                if (titleM) {
                    topics.push({
                        title: titleM[1].trim().slice(0, 30),
                        content: (bodyM ? bodyM[1].trim() : '').slice(0, 500) || titleM[1].trim(),
                    });
                }
            }
            return topics;
        } catch (e) {
            return [];
        }
    },

    // ---- 发帖表单查找（双页面兼容）----

    /**
     * 找到发帖表单元素
     * 返回 { titleInput, setContent(, publishBtn, expandBtn, pageType }
     * pageType: 'mooc2ans' | 'sidebar' | null
     */
    _findForm() {
        // ---- A. mooc2-ans 讨论页（.editContainer 结构）----
        const editTitle = document.querySelector('.edit_title input[name="title"]')
            || document.querySelector('.edit_title input[type="text"]');
        if (editTitle && editTitle.offsetParent !== null) {
            const publishBtn = document.querySelector('.edit_btn .jb_btn')
                || document.querySelector('.edit_btn a.jb_btn')
                || document.querySelector('.edit_btn [class*="jb_btn"]');
            return {
                pageType: 'mooc2ans',
                titleInput: editTitle,
                publishBtn,
                expandBtn: null,
                setContent: (text) => {
                    // UEditor：优先走 API，退化为直接写 iframe body
                    try {
                        const ue = window.UE && UE.instants && UE.instants['ueditorInstant0'];
                        if (ue && ue.setContent) {
                            ue.setContent(text.replace(/\n/g, '<br>'));
                            return true;
                        }
                    } catch (e) { }
                    try {
                        const holder = document.querySelector('#edui1_iframeholder iframe')
                            || document.querySelector('#ueditor_0');
                        if (holder) {
                            const d = holder.contentDocument || holder.contentWindow.document;
                            if (d && d.body) {
                                d.body.innerHTML = text.replace(/\n/g, '<br>');
                                // 触发 UEditor 感知内容变化
                                try {
                                    const evt = d.createEvent('Event');
                                    evt.initEvent('input', true, true);
                                    d.body.dispatchEvent(evt);
                                } catch (e) { }
                                return true;
                            }
                        }
                    } catch (e) { }
                    return false;
                },
            };
        }

        // ---- B. 学习页侧栏（input#toplevelTextCommentTitle + textarea）----
        const sidebarTitle = document.querySelector('input#toplevelTextCommentTitle');
        const sidebarContent = document.querySelector('textarea#toplevelTextCommentContent');
        if (sidebarTitle) {
            const btns = Array.from(document.querySelectorAll('div.replyTopic div.jb_btn, div.replyTopic a.jb_btn'));
            const publishBtn = btns.find(b => b.offsetParent !== null) || btns[0] || null;
            return {
                pageType: 'sidebar',
                titleInput: sidebarTitle,
                contentInput: sidebarContent,
                publishBtn,
                expandBtn: document.querySelector('span.newTopic_bnt'),
                setContent: (text) => {
                    if (!sidebarContent) return false;
                    sidebarContent.value = text;
                    sidebarContent.dispatchEvent(new Event('input', { bubbles: true }));
                    sidebarContent.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                },
            };
        }

        return null;
    },

    /** 展开发帖表单（如果需要） */
    async _expandForm(form) {
        if (form.expandBtn && form.expandBtn.offsetParent !== null) {
            form.expandBtn.click();
            await new Promise(r => setTimeout(r, 600));
            return this._findForm(); // 重新获取
        }
        return form;
    },

    /** 发一条帖子 */
    async postTopic(title, content) {
        let form = this._findForm();
        if (!form) {
            // 尝试展开后再找
            const tmpExpand = document.querySelector('span.newTopic_bnt, .newTopic_bnt');
            if (tmpExpand && tmpExpand.offsetParent !== null) {
                tmpExpand.click();
                await new Promise(r => setTimeout(r, 800));
                form = this._findForm();
            }
        }
        if (!form) return { ok: false, reason: '找不到发帖表单（请确认在讨论区页面）' };

        // 填标题
        const ti = form.titleInput;
        if (ti) {
            ti.value = title;
            ti.dispatchEvent(new Event('input', { bubbles: true }));
            ti.dispatchEvent(new Event('change', { bubbles: true }));
            ti.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 300));

        // 填内容
        const contentOk = form.setContent(content);
        if (!contentOk) return { ok: false, reason: '找不到内容输入区' };
        await new Promise(r => setTimeout(r, 500));

        // 发布按钮（可能需要内容填入后才从 disable 变 enable）
        if (!form.publishBtn) return { ok: false, reason: '找不到发布按钮' };
        // 如果按钮是 disable 状态，等一下再试
        let btn = form.publishBtn;
        if (btn.className && btn.className.includes('disable')) {
            await new Promise(r => setTimeout(r, 500));
            btn = document.querySelector('.edit_btn .jb_btn') || btn;
        }
        btn.click();
        await new Promise(r => setTimeout(r, 2000));

        this._log({ action: 'post', title: title.slice(0, 20), page: form.pageType });
        return { ok: true };
    },

    /** 给帖子点赞（最新一条） */
    likeLatestTopic() {
        try {
            const items = Array.from(document.querySelectorAll('div.itemDiscuss, [class*="topic-item"], [class*="topicItem"]'));
            if (!items.length) return false;
            const likeBtn = items[0].querySelector('a.zan, [class*="like"] a, [class*="Like"] a, [class*="zan"]');
            if (likeBtn) {
                likeBtn.click();
                this._log({ action: 'like', topic: items[0].id || items[0].className });
                return true;
            }
        } catch (e) { }
        return false;
    },

    // ---- 主入口 ----

    async autoPost(opts) {
        const { courseId, courseName, chapterName, count = 2, maxY = 10, autoLike = true } = opts || {};

        const done = this.getCount(courseId);
        if (done >= maxY) {
            if (window.__KEZHOU_MAIN__) {
                window.__KEZHOU_MAIN__.log(`讨论已达上限（${done}/${maxY}），跳过`, 'i');
            }
            return 0;
        }

        const toPost = Math.min(count, maxY - done);
        if (window.__KEZHOU_MAIN__) {
            window.__KEZHOU_MAIN__.log(`自动发帖：一次性生成 ${toPost} 条（已发 ${done}/${maxY}）`, 'i');
            window.__KEZHOU_MAIN__.say('AI 生成讨论中…', 'info');
        }

        // 先确认发帖表单存在，找不到就不浪费 AI 调用
        let form = this._findForm();
        if (!form) {
            // 尝试展开
            const expand = document.querySelector('span.newTopic_bnt, .newTopic_bnt, .editContainer');
            if (expand && expand.offsetParent !== null) {
                try { expand.click(); } catch (e) { }
                await new Promise(r => setTimeout(r, 800));
                form = this._findForm();
            }
        }
        if (!form) {
            if (window.__KEZHOU_MAIN__) {
                window.__KEZHOU_MAIN__.log('找不到发帖表单，请先打开讨论区页面', 'e');
            }
            return 0;
        }

        // 一次 AI 调用生成全部内容
        const topics = await this.generateTopics(toPost, courseName, chapterName);
        if (!topics.length) {
            if (window.__KEZHOU_MAIN__) window.__KEZHOU_MAIN__.log('AI 生成讨论失败', 'e');
            return 0;
        }
        if (window.__KEZHOU_MAIN__) {
            window.__KEZHOU_MAIN__.log(`AI 生成 ${topics.length} 条：${topics.map(t => t.title.slice(0, 10)).join(' / ')}`, 'o');
        }

        let posted = 0;
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            try {
                const r = await this.postTopic(topic.title, topic.content);
                if (r.ok) {
                    posted++;
                    this._bumpCount(courseId);
                    if (window.__KEZHOU_MAIN__) {
                        window.__KEZHOU_MAIN__.log(`已发表 [${i + 1}/${topics.length}]：「${topic.title.slice(0, 15)}」`, 'o');
                    }
                    if (autoLike) {
                        await new Promise(r2 => setTimeout(r2, 800));
                        this.likeLatestTopic();
                    }
                    if (i < topics.length - 1) {
                        const wait = 10000 + Math.random() * 10000;
                        if (window.__KEZHOU_MAIN__) {
                            window.__KEZHOU_MAIN__.log(`等待 ${Math.round(wait / 1000)}s 再发下一条…`, 'i');
                        }
                        await new Promise(r2 => setTimeout(r2, wait));
                    }
                } else {
                    if (window.__KEZHOU_MAIN__) window.__KEZHOU_MAIN__.log(`发帖失败：${r.reason}`, 'e');
                }
            } catch (e) {
                if (window.__KEZHOU_MAIN__) window.__KEZHOU_MAIN__.log(`发帖异常：${e.message}`, 'e');
            }
        }

        if (window.__KEZHOU_MAIN__ && posted > 0) {
            window.__KEZHOU_MAIN__.say(`已发表 ${posted} 条讨论`, 'ok');
        }
        return posted;
    },

    async manualPost(count) {
        const params = window.__KEZHOU_ADAPTER__
            ? window.__KEZHOU_ADAPTER__.getParams() : {};
        const courseId = params.courseId || 'unknown';
        let courseName = '';
        try {
            const el = document.querySelector('dd.textHidden.colorDeep, .course_name, h1');
            courseName = el ? el.textContent.trim().slice(0, 20) : document.title.slice(0, 20);
        } catch (e) { courseName = document.title.slice(0, 20); }
        let chapterName = '';
        try {
            const cur = document.querySelector('.posCatalog_active .posCatalog_name, .posCatalog_select.posCatalog_active');
            chapterName = cur ? cur.textContent.replace(/\s+/g, ' ').trim().slice(0, 30) : '';
        } catch (e) { }

        return this.autoPost({
            courseId, courseName, chapterName,
            count: count || 2, maxY: 999, autoLike: true,
        });
    },
};

window.__KEZHOU_DISCUSS__ = KZDiscuss;
