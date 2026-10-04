// ========== 课舟 自动讨论（发帖 + 点赞）==========
// 架构：外窗口持 UI + AI 生成 + 计数，内 iframe（groupweb）做执行器
// 通信：GM_setValue / GM_addValueChangeListener 跨 frame 共享，天然中继通道
//   外窗口 → CMD_KEY 发指令 → 内 iframe 监听执行 → RESULT_KEY 回传结果
// 无 iframe 时（学习页侧栏）直接本地执行，不走中继

const KZDiscuss = {
    KEY_COUNT: 'kezhou-discuss-count',
    KEY_LOG: 'kezhou-discuss-log',
    RELAY_CMD_KEY: 'kezhou-discuss-cmd',
    RELAY_RESULT_KEY: 'kezhou-discuss-result',
    _relayPending: null,   // { id, resolve }

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

    // ============ 中继协议 ============

    /**
     * 外窗口：发指令给内 iframe，等结果
     * @returns {Promise<{ok, reason}>}
     */
    relayPost(title, content) {
        return new Promise((resolve) => {
            const cmdId = 'cmd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
            this._relayPending = { id: cmdId, resolve, ts: Date.now() };

            try {
                GM_setValue(this.RELAY_CMD_KEY, {
                    id: cmdId,
                    action: 'post',
                    title,
                    content,
                    ts: Date.now(),
                });
            } catch (e) {
                this._relayPending = null;
                resolve({ ok: false, reason: '中继发送失败: ' + e.message });
                return;
            }

            // 超时 30s
            setTimeout(() => {
                if (this._relayPending && this._relayPending.id === cmdId) {
                    this._relayPending = null;
                    resolve({ ok: false, reason: '中继超时（讨论区 iframe 未响应，可能未加载完）' });
                }
            }, 30000);
        });
    },

    /**
     * 启动中继监听
     * - 在 groupweb iframe 里：监听指令并执行发帖
     * - 在外窗口：监听结果并 resolve
     */
    startRelay() {
        const isDiscussFrame = /groupweb\.(xuexitong|chaoxing)\.com/.test(location.hostname);

        // 监听指令（只有讨论区 iframe 执行）
        try {
            GM_addValueChangeListener(this.RELAY_CMD_KEY, (name, oldVal, newVal) => {
                if (!newVal || newVal.action !== 'post') return;
                if (!isDiscussFrame) return; // 外窗口不执行，只发指令

                // 内 iframe：执行发帖，回传结果
                this.postTopicLocal(newVal.title, newVal.content).then(result => {
                    try {
                        GM_setValue(this.RELAY_RESULT_KEY, {
                            id: newVal.id,
                            ok: result.ok,
                            reason: result.reason || '',
                            ts: Date.now(),
                        });
                    } catch (e) { }
                });
            });
        } catch (e) { }

        // 监听结果（只有外窗口需要 resolve）
        try {
            GM_addValueChangeListener(this.RELAY_RESULT_KEY, (name, oldVal, newVal) => {
                if (!newVal || !this._relayPending || this._relayPending.id !== newVal.id) return;
                this._relayPending.resolve({ ok: newVal.ok, reason: newVal.reason });
                this._relayPending = null;
            });
        } catch (e) { }
    },

    // ============ AI 批量生成 ============

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

    // ============ 发帖表单查找 ============

    _findForm() {
        // ---- A. mooc2-ans 讨论页（.editContainer）----
        const editTitle = document.querySelector('.edit_title input[name="title"]')
            || document.querySelector('.edit_title input[type="text"]');
        if (editTitle) {
            const publishBtn = document.querySelector('.edit_btn .jb_btn')
                || document.querySelector('.edit_btn a.jb_btn')
                || document.querySelector('.edit_btn [class*="jb_btn"]');
            return {
                pageType: 'mooc2ans',
                titleInput: editTitle,
                publishBtn,
                setContent: (text) => {
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

        // ---- B. 学习页侧栏 ----
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

    // ============ 本地发帖（内 iframe / 学习页侧栏用） ============

    async postTopicLocal(title, content) {
        let form = this._findForm();
        if (!form) {
            // 尝试展开
            const expandSelectors = ['span.newTopic_bnt', '.newTopic_bnt', '.edit_headTitle', '[class*="newTopic"]'];
            for (const sel of expandSelectors) {
                const btn = document.querySelector(sel);
                if (btn && btn.offsetParent !== null) {
                    try { btn.click(); } catch (e) { }
                    await new Promise(r => setTimeout(r, 1000));
                    form = this._findForm();
                    if (form) break;
                }
            }
            if (!form) {
                const all = Array.from(document.querySelectorAll('button, a, div, span'));
                const btn = all.find(el => (el.textContent || '').trim() === '新建话题' && el.offsetParent !== null);
                if (btn) {
                    try { btn.click(); } catch (e) { }
                    await new Promise(r => setTimeout(r, 1000));
                    form = this._findForm();
                }
            }
        }
        if (!form) return { ok: false, reason: '找不到发帖表单' };

        // 填标题
        if (form.titleInput) {
            form.titleInput.value = title;
            form.titleInput.dispatchEvent(new Event('input', { bubbles: true }));
            form.titleInput.dispatchEvent(new Event('change', { bubbles: true }));
            form.titleInput.dispatchEvent(new Event('blur', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 300));

        // 填内容
        if (!form.setContent(content)) return { ok: false, reason: '找不到内容输入区' };
        await new Promise(r => setTimeout(r, 500));

        // 发布
        if (!form.publishBtn) return { ok: false, reason: '找不到发布按钮' };
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

    /**
     * 发一条帖子（自动选择本地/中继）
     * 外窗口找不到本地表单 → 走中继让内 iframe 执行
     */
    async postTopic(title, content) {
        // 先试本地表单
        const form = this._findForm();
        if (form) {
            return this.postTopicLocal(title, content);
        }

        // 本地没表单 → 如果在外窗口，走中继
        if (window === window.top) {
            return this.relayPost(title, content);
        }

        // 内 iframe 也没表单 → 尝试本地展开后再试
        return this.postTopicLocal(title, content);
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

    // ============ 主入口 ============

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
