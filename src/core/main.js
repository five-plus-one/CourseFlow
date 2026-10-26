// ========== 课舟 主流程 v4 ==========
// 修复：
//  - autoNext 已保存的 true 会被重置（v0.2.0 的 bug 会误跳）
//  - 日志跨页面追加（KZLog）
//  - 每次 tick 都打详细日志（检测结果、选择器命中）
//  - play() 被 pause 打断时重试

const KezhouMain = {
    running: false,
    mode: 'normal',
    tickTimer: null,
    videoBound: null,
    lastRatio: 0,
    midQuizBusy: false,
    quizDone: false,
    quizBusy: false,
    modalOpen: false,
    epoch: 0,               // 章节/任务切换时 +1，旧的异步流程据此熔断
    lastQuizKey: '',
    lastChapterId: '',
    tickCount: 0,
    playRetry: 0,
    // ---- 多任务点队列 ----
    taskLocalDone: {},      // jobId → true（本会话内已完成/已跳过）
    currentTask: null,      // 正在处理的任务点
    _queueModeUntil: 0,     // 队列模式冷却（防止知识点 Tab 切换瞬间回落 legacy）
    _knowledgeStep: 0,      // 本章节已切过几次知识点 Tab

    options: {
        playbackRate: 1.0,
        completeRatio: 1.0,
        autoVideo: true,
        autoQuiz: true,
        autoMidQuiz: true,
        autoNext: true,
        confirmSeconds: 10,
        submitMode: 'submit',
        skipWatched: true,
        answerMode: 'vision',   // vision=截图识别 | text=纯文本
        // ---- 自动讨论 ----
        autoDiscuss: false,     // 完成任务点后自动发帖
        discussPerTrigger: 2,   // 每次发几条
        discussMaxPerCourse: 10, // 每门课上限
        discussAutoLike: true,  // 发完自动点赞
    },

    log(msg, level) {
        // 技术日志：完整记录，供导出
        KZLog.add(msg, level);
    },

    /** 给用户看的友好日志（去重，短句） */
    say(msg, cls) {
        KZFriendly.say(msg, cls);
    },

    init() {
        // 普通 iframe 不注入；groupweb 讨论区 iframe 只做执行器（不建 UI）
        if (window !== window.top) {
            const h = location.hostname;
            if (!/groupweb\.(xuexitong|chaoxing)\.com/.test(h)) return;
            // 内 iframe：只启动中继监听，不建 UI
            try { if (window.__KEZHOU_DISCUSS__) window.__KEZHOU_DISCUSS__.startRelay(); } catch (e) { }
            return;
        }

        ProviderManager.init();
        try {
            const saved = GM_getValue('kezhou-options');
            if (saved) Object.assign(this.options, JSON.parse(saved));
        } catch (e) { }
        try { this.mode = GM_getValue('kezhou-mode') || 'normal'; } catch (e) { }
        // 一次性迁移（v0.3.0 的误跳问题，不再强制改 autoNext）
        if (!GM_getValue('kezhou-migrated-0.3.0')) {
            GM_setValue('kezhou-migrated-0.3.0', true);
        }

        const adapter = window.__KEZHOU_ADAPTER__;
        if (!adapter || !adapter.shouldInitialize()) return;

        createKezhouButtons();
        syncKezhouPanel();
        // 外窗口启动中继监听（收内 iframe 回传的结果）
        try { if (window.__KEZHOU_DISCUSS__) window.__KEZHOU_DISCUSS__.startRelay(); } catch (e) { }
        this.lastChapterId = (adapter.getParams() || {}).chapterId || '';
        this.pageSig = location.pathname + '|' + this.lastChapterId;
        this.log(`就绪 · ${adapter.isDetailPage() ? '详情页' : '列表页'} · mode=${this.mode} · autoNext=${this.options.autoNext}`, 'o');
        this.say('课舟就绪', 'ok');

        // 首次引导
        if (!OOBE.isDone()) {
            setTimeout(() => OOBE.show(), 800);
        } else {
            // OOBE 已完成但 key 为空（跳过过/被清）→ 再弹引导
            try {
                const cfg = AIEngine.getConfig();
                if (!cfg.apiKey && (this.options.autoQuiz || this.options.autoMidQuiz)) {
                    setTimeout(() => OOBE.show(), 800);
                }
            } catch (e) { }
        }

        // 刷新自动恢复运行
        try {
            if (GM_getValue('kezhou-running')) {
                this.log('检测到刷新前处于运行状态 → 自动恢复', 'o');
                setTimeout(() => this.start(true), 500);
            }
        } catch (e) { }

        this.tickTimer = setInterval(() => this.tick(), 2500);
        this.tick();
    },

    toggle() {
        if (this.running) this.stop('手动暂停');
        else this.start();
    },

    start(resume) {
        const adapter = window.__KEZHOU_ADAPTER__;
        if (adapter && adapter.isDetailPage()) {
            const cfg = AIEngine.getConfig();
            if ((this.options.autoQuiz || this.options.autoMidQuiz) && !cfg.apiKey) {
                // 无 API Key → 弹 OOBE 引导（含获取链接），替代仅 toast
                kzToast('请先配置 AI API Key', 'error');
                if (typeof OOBE !== 'undefined') OOBE.show();
                else toggleKezhouPanel(true);
                return;
            }
            this.log(`AI: model=${cfg.model} endpoint=${cfg.endpoint}`, 'i');
        }
        this.running = true;
        this.quizDone = false;
        this.quizBusy = false;
        this.playRetry = 0;
        this.taskLocalDone = {};
        this.currentTask = null;
        this._knowledgeStep = 0;
        this.epoch++;
        try { GM_setValue('kezhou-running', true); } catch (e) { }
        setFabState('running', '课舟 · 进行中');
        this.log(resume ? '自动恢复运行' : `开始运行 · 模式=${this.mode}`, 'o');
        this.say(resume ? '自动恢复运行中…' : '开始自动学习', 'ok');
        if (!resume) kzToast('课舟已启动', 'success');
        this.tick();
    },

    stop(reason) {
        this.running = false;
        this.epoch++;                      // 熔断答题等异步流程
        this.unbindVideo();
        // 暂停正在播放的视频
        try {
            const st = window.__KEZHOU_ADAPTER__ && window.__KEZHOU_ADAPTER__.getVideoState();
            if (st && !st.paused && st.element) {
                st.element.pause();
                this.log('已暂停视频', 'i');
            }
        } catch (e) { }
        try { GM_setValue('kezhou-running', false); } catch (e) { }
        setFabState('paused', '课舟 · 开始学习');
        this.log('停止：' + reason, 'e');
        if (reason && reason !== '刷新恢复') kzToast(reason, 'info');
    },

    // ---------- 主循环 ----------

    async tick() {
        this.tickCount++;
        const adapter = window.__KEZHOU_ADAPTER__;
        if (!adapter || !adapter.isDetailPage()) {
            if (this.tickCount % 8 === 1) this.log('tick: 非详情页，跳过');
            return;
        }

        // ---- 页面守卫：确认还在同一章节/页面，否则熔断 ----
        const p = adapter.getParams() || {};
        const curSig = location.pathname + '|' + (p.chapterId || '');
        if (this.pageSig && curSig !== this.pageSig) {
            this.log(`页面变化 ${this.pageSig} → ${curSig}，熔断`, 'i');
            this.epoch++;
            this.pageSig = curSig;
            this.lastChapterId = p.chapterId || '';
            this.quizDone = false;
            this.quizBusy = false;
            this.lastRatio = 0;
            this._seekedFor = null;
            this.taskLocalDone = {};
            this.currentTask = null;
            this._knowledgeStep = 0;
            this._quizSwitchTries = 0;
            this.unbindVideo();
        } else if (p.chapterId && this.lastChapterId && p.chapterId !== this.lastChapterId) {
            this.log(`章节变化: ${this.lastChapterId} → ${p.chapterId}，熔断旧任务`, 'i');
            this.epoch++;
            this.lastChapterId = p.chapterId;
            this.pageSig = curSig;
            this.quizDone = false;
            this.quizBusy = false;
            this.lastRatio = 0;
            this._seekedFor = null;
            this.taskLocalDone = {};
            this.currentTask = null;
            this._knowledgeStep = 0;
            this._quizSwitchTries = 0;
            this.unbindVideo();
        }

        // 弹窗：只在 running 时处理，且 5 秒防抖
        if (this.running && Date.now() - (this._lastPopup || 0) > 5000) {
            const popupHandled = XXTQuiz.handleTaskPopup(this.options.autoNext ? 'next' : 'learn');
            if (popupHandled) {
                this._lastPopup = Date.now();
                this.log('已处理「任务点未完成」弹窗', 'i');
            }
        }

        const limit = adapter.checkLimits();
        if (limit.limited) {
            this.log('触发限制弹窗：' + limit.message, 'e');
            this.stop('触发限制：' + limit.message);
            return;
        }

        // 中插题（2 秒防抖）
        if (this.options.autoMidQuiz && Date.now() - (this._lastMidQuiz || 0) > 2000) {
            const mid = adapter.detectMidVideoQuiz();
            if (mid) {
                this._lastMidQuiz = Date.now();
                await this.handleMidQuiz(adapter, mid);
                return;
            }
        }

        if (!this.running) {
            if (this.tickCount % 8 === 1) this.log('tick: 未运行');
            return;
        }

        // 测验处理中 / 确认框弹出时，禁止视频逻辑
        if (this.quizBusy || this.modalOpen) {
            return;
        }

        // ---- 多任务点队列调度（一页多个 .ans-attach-ct）----
        let tasks = [];
        try { tasks = adapter.listTasks(); } catch (e) { tasks = []; }
        const queueMode = tasks.length >= 2 || (tasks.length === 1 && tasks[0].type === 'work');
        if (queueMode) {
            this._queueModeUntil = Date.now() + 60000;
            await this.tickTaskQueue(adapter, tasks);
            return;
        }
        // 知识点 Tab 切换后内容短暂为空 → 冷却期内别走 legacy
        if (this._queueModeUntil && Date.now() < this._queueModeUntil) {
            if (this.tickCount % 8 === 1) this.log('队列模式冷却中，等待任务点加载…');
            return;
        }

        // ---- legacy：单视频 + 测验 Tab 老页型 ----
        const isVideo = adapter.detectVideoPage();
        const isQuiz = adapter.detectQuizPage();
        const vSt = adapter.getVideoState();
        const jobDone = isVideo ? adapter.isVideoJobDone() : null;

        // 每 4 次 tick 打一次详细状态
        if (this.tickCount % 4 === 1) {
            this.log(
                `tick#${this.tickCount} video=${isVideo} quiz=${isQuiz} ` +
                (vSt ? `vid[${Math.round(vSt.ratio * 100)}% ${vSt.paused ? 'P' : '▶'} r=${vSt.playbackRate}]` : 'vid[-]') +
                ` jobDone=${jobDone} quizDone=${this.quizDone} tab=${adapter.getActiveTab()}`
            );
        }

        // 优先测验（测验页可能残留 video iframe）
        if (isQuiz && this.options.autoQuiz && !this.quizDone) {
            this._emptyTicks = 0;
            await this.handleQuiz(adapter);
        } else if (isVideo && this.options.autoVideo) {
            this._emptyTicks = 0;
            this.handleVideo(adapter);
        } else if (!isVideo && !isQuiz) {
            // 纯文本/图片页：连续 3 次 tick（~7.5s）无内容 → 自动推进到下一个
            this._emptyTicks = (this._emptyTicks || 0) + 1;
            if (this._emptyTicks >= 3) {
                this._emptyTicks = 0;
                this.log('纯文本页（无视频/测验/任务点）→ 自动推进', 'o');
                this.say('纯文本页，自动跳过', 'info');
                await this.onAllTasksDone(adapter);
            } else if (this.tickCount % 4 === 1) {
                this.log(`纯文本页，等待内容加载…（${this._emptyTicks}/3）`);
            }
        }
    },

    // ---------- 多任务点队列 ----------

    isTaskReallyDone(adapter, task) {
        if (task.jobId && this.taskLocalDone[task.jobId]) return true;
        try { return adapter.isTaskDone(task); } catch (e) { return !!task.done; }
    },

    markTaskDone(task, reason) {
        if (task && task.jobId) {
            this.taskLocalDone[String(task.jobId)] = true;
            this.log(`任务#${task.index}(${task.type}) 标记完成 jobid=${task.jobId}${reason ? ' · ' + reason : ''}`, 'o');
        }
        // 同步先锁住队列（防止 onAllTasksDone 在发帖开始前就跳转），
        // _maybeAutoDiscuss 完成后在 finally 里解锁
        if (this.options.autoDiscuss && window.__KEZHOU_DISCUSS__) {
            if (!(Date.now() - (this._lastDiscuss || 0) < 30000)) {
                this._discussBusy = true;
            }
        }
        this._maybeAutoDiscuss();
    },

    async _maybeAutoDiscuss() {
        if (!this.options.autoDiscuss || !window.__KEZHOU_DISCUSS__) {
            this._discussBusy = false;
            return;
        }
        if (Date.now() - (this._lastDiscuss || 0) < 30000) {
            this._discussBusy = false;
            return;
        }
        this._lastDiscuss = Date.now();

        try {
            const adapter = window.__KEZHOU_ADAPTER__;
            const params = adapter ? adapter.getParams() : {};
            const courseId = params.courseId || 'unknown';
            let courseName = '';
            try {
                const el = document.querySelector('dd.textHidden.colorDeep');
                courseName = el ? el.textContent.trim() : document.title;
            } catch (e) { courseName = document.title; }
            let chapterName = '';
            try {
                const cur = document.querySelector('.posCatalog_active .posCatalog_name, .posCatalog_select.posCatalog_active');
                chapterName = cur ? cur.textContent.replace(/\s+/g, ' ').trim().slice(0, 30) : '';
            } catch (e) { }

            await window.__KEZHOU_DISCUSS__.autoPost({
                courseId, courseName, chapterName,
                count: this.options.discussPerTrigger || 2,
                maxY: this.options.discussMaxPerCourse || 10,
                autoLike: this.options.discussAutoLike !== false,
            });
        } catch (e) {
            this.log('自动讨论异常: ' + e.message, 'e');
        } finally {
            this._discussBusy = false;
        }
    },

    async tickTaskQueue(adapter, tasks) {
        const unfinished = tasks.filter(t => !this.isTaskReallyDone(adapter, t));

        if (this.tickCount % 4 === 1) {
            this.log(
                `队列#${this.tickCount} 共${tasks.length} 未完成${unfinished.length} | ` +
                tasks.map((t, i) => `#${i}:${t.type}${this.isTaskReallyDone(adapter, t) ? '✓' : '○'}`).join(' ')
            );
        }

        // 全部完成 → 知识点 Tab / 下一节
        if (unfinished.length === 0) {
            this.currentTask = null;
            await this.onAllTasksDone(adapter);
            return;
        }

        const task = unfinished[0];
        this.currentTask = task;

        if (task.type === 'video') {
            if (!this.options.autoVideo) return;
            this.handleVideo(adapter, task);
        } else if (task.type === 'work') {
            if (!this.options.autoQuiz) return;
            await this.handleQuiz(adapter, task);
        } else {
            // 未知类型：跳过，不卡住队列
            if (this.tickCount % 8 === 1) this.log(`任务#${task.index} 类型=${task.type} 无法自动处理 → 跳过`, 'e');
            this.markTaskDone(task, 'unknown-type-skip');
        }
    },

    async onAllTasksDone(adapter) {
        // 发帖进行中：等发完再继续（切知识点/跳节）
        if (this._discussBusy) {
            if (this.tickCount % 4 === 1) this.log('发帖进行中，等待完成…', 'i');
            return;
        }

        this.unbindVideo();

        const stepKey = (this.lastChapterId || '') + '|' + this._knowledgeStep;
        if (this._allDoneLogged !== stepKey) {
            this._allDoneLogged = stepKey;
            this.say('本页任务点已全部完成 ✓', 'ok');
            setFabState('running', '课舟 · 本页完成');
        }

        // 优先：切下一个知识点 Tab（最多切 tabs.length-1 次，防死循环）
        const tabs = adapter.listKnowledgeTabs();
        const maxSteps = Math.max(0, tabs.length - 1);
        if (this._knowledgeStep < maxSteps && tabs.some(t => !t.active)) {
            if (Date.now() - (this._lastKwSwitch || 0) < 8000) return;
            this._lastKwSwitch = Date.now();
            this._knowledgeStep++;
            this.taskLocalDone = {};
            this.currentTask = null;
            this._seekedFor = null;
            this.lastRatio = 0;
            const ok = adapter.nextKnowledgeTab();
            this.log(ok ? `切换到下一知识点 Tab（step=${this._knowledgeStep}/${maxSteps}）` : '知识点 Tab 切换失败', ok ? 'o' : 'e');
            if (ok) this.say('进入下一知识点', 'info');
            return;
        }

        // 没有下一知识点 → autoNext 下一节
        if (this.options.autoNext) {
            if (Date.now() - (this._lastAutoNext || 0) < 10000) return;
            this._lastAutoNext = Date.now();
            this.log('全部任务点完成，autoNext → 下一节', 'o');
            // 注意：不归零 _knowledgeStep / taskLocalDone，清零只由页面变化守卫做
            // 否则 nextChapter() 失败（末页/翻页慢）时会反复横跳知识点、任务点重做
            this.currentTask = null;
            this._seekedFor = null;
            this.lastRatio = 0;
            adapter.nextChapter();
            this.epoch++;
        } else if (this.tickCount % 8 === 1) {
            this.log('全部完成，等用户手动下一节', 'i');
        }
    },

    // ---------- 提交后答案核对 ----------

    /**
     * 提交后等成绩页渲染，抓「标准答案/我的答案/分数」回填历史对错
     * 每轮重新查找 quizDoc（提交后 iframe 可能重载，旧引用会失效）
     * 轮询最多 60s，直到出现带「标准答案」的批阅记录
     */
    scheduleAnswerVerify(histId, task) {
        const maxAttempts = 20;
        const delayMs = 3000;
        let attempt = 0;

        const findGradedRecords = () => {
            // 先试任务点内的文档，再退化为全文档搜索
            let doc = null;
            if (task) {
                try { doc = window.__KEZHOU_ADAPTER__.getTaskQuizDoc(task); } catch (e) { }
            }
            if (!doc) {
                try { doc = XXTQuiz._findQuizDoc(); } catch (e) { }
            }
            let recs = [];
            try { recs = XXTQuiz.extractAnsweredRecords(doc); } catch (e) { }
            // 如果还没结果，全文档扫一遍
            if (!recs.some(r => r.correct && r.correct.trim())) {
                try {
                    const adapter = window.__KEZHOU_ADAPTER__;
                    if (adapter && adapter.collectDocs) {
                        for (const { doc: d } of adapter.collectDocs(document)) {
                            try {
                                const more = XXTQuiz.extractAnsweredRecords(d);
                                if (more.some(r => r.correct && r.correct.trim())) { recs = more; break; }
                            } catch (e) { }
                        }
                    }
                } catch (e) { }
            }
            return recs;
        };

        const tryVerify = () => {
            attempt++;
            try {
                const recs = findGradedRecords();
                const graded = recs.filter(r => r.correct && r.correct.trim());
                if (graded.length > 0) {
                    this.log(`成绩已出（${graded.length}/${recs.length} 题有标准答案）→ 回填对错`, 'o');

                    const all = KZHistory.getAll();
                    const entry = all.find(x => x.id === histId);
                    if (entry && entry.questions) {
                        entry.questions.forEach(q => {
                            const qPrefix = String(q.stem || '').slice(0, 30);
                            let best = null, bestScore = 0;
                            for (const r of recs) {
                                const rPrefix = String(r.stem || '').slice(0, 30);
                                let score = 0;
                                for (let i = 0; i < Math.min(qPrefix.length, rPrefix.length); i++) {
                                    if (qPrefix[i] === rPrefix[i]) score++;
                                    else break;
                                }
                                if (score > bestScore) { bestScore = score; best = r; }
                            }
                            if (best && bestScore >= 10) {
                                q.correct = best.correct || '';
                                if (best.correct) {
                                    const ua = String(q.answer || '').trim().toUpperCase();
                                    const ca = String(best.correct).trim().toUpperCase();
                                    if (q.type === 'judge') {
                                        const norm = s => (/^true$|^对$|^T$/.test(s) ? 'T' : /^false$|^错$|^F$/.test(s) ? 'F' : s);
                                        q.isWrong = norm(ua) !== norm(ca);
                                    } else if (q.type === 'multi') {
                                        const s1 = [...new Set(ua.replace(/[^A-H]/g, '').split(''))].sort().join('');
                                        const s2 = [...new Set(ca.replace(/[^A-H]/g, '').split(''))].sort().join('');
                                        q.isWrong = s1 !== s2;
                                    } else {
                                        q.isWrong = ua !== ca;
                                    }
                                }
                            }
                        });
                        KZHistory._save(all);
                        const wrongCount = entry.questions.filter(q => q.isWrong === true).length;
                        this.log(`对错回填完成：${entry.questions.length - wrongCount}对 ${wrongCount}错`, wrongCount > 0 ? 'i' : 'o');
                        if (wrongCount > 0) this.say(`本测验 ${wrongCount} 题答错`, 'err');
                    }
                    return;
                }
            } catch (e) {
                this.log('核对异常: ' + e.message, 'e');
            }
            if (attempt < maxAttempts) {
                setTimeout(tryVerify, delayMs);
            } else {
                this.log('核对超时：成绩页未出现标准答案，跳过回填', 'i');
            }
        };

        setTimeout(tryVerify, 5000);  // 首次等 5s，给平台判卷时间
    },

    // ---------- 视频 ----------

    handleVideo(adapter, task) {
        const st = adapter.getVideoState(task);
        if (!st) {
            this.log('等待 video 元素…');
            return;
        }

        this.bindVideo(st.element, adapter);
        const p = adapter.getParams() || {};
        const jobTag = (task && task.jobId) ? String(task.jobId).slice(-8) : 'legacy';
        const vidKey = 'kz-pos-' + (p.chapterId || 'unknown') + '_' + jobTag;

        // 跳过已看：载入后跳到上次进度；已看完则直接标记完成
        if (this.options.skipWatched && this._seekedFor !== vidKey) {
            this._seekedFor = vidKey;
            let saved = 0;
            try { saved = parseFloat(GM_getValue(vidKey) || '0'); } catch (e) { }
            if (st.duration > 0 && saved >= st.duration * 0.95) {
                this.log(`已看完（${Math.round(saved)}s/${Math.round(st.duration)}s）→ 跳过视频`, 'o');
                this.videoDone = true;
                this.unbindVideo();
                if (task) {
                    this.markTaskDone(task, 'skipWatched');
                    return;
                }
                if (!this.quizDone) {
                    adapter.switchTab('quiz');
                    setFabState('running', '课舟 · 测验');
                } else if (this.options.autoNext) {
                    setTimeout(() => { if (this.running) { adapter.nextChapter(); this.epoch++; this._seekedFor = null; this.videoDone = false; this.quizDone = false; } }, 800);
                }
                return;
            }
            if (saved > 5 && st.duration > 0 && st.currentTime < saved - 5) {
                try {
                    st.element.currentTime = saved;
                    this.log(`跳过已看 → ${Math.round(saved)}s`, 'o');
                } catch (e) { this.log('跳转失败: ' + e.message, 'e'); }
            }
        }

        // 记录进度
        if (st.currentTime > 0 && Date.now() - (this._lastSavePos || 0) > 5000) {
            this._lastSavePos = Date.now();
            try { GM_setValue(vidKey, String(st.currentTime)); } catch (e) { }
        }

        const target = this.options.completeRatio || 1;
        const jobDone = task ? adapter.isTaskDone(task) : adapter.isVideoJobDone();
        const ratioDone = st.duration > 1 && st.currentTime > 0 && st.ratio >= target;

        if (jobDone || ratioDone) {
            this.log(`视频完成 ratio=${Math.round(st.ratio * 100)}%`, 'o');
            this.say('视频已看完 ✓', 'ok');
            setFabState('running', '课舟 · 视频完成');
            this.unbindVideo();
            this.videoDone = true;

            if (task) {
                this.markTaskDone(task, jobDone ? 'icon-done' : 'ratio-done');
                return;
            }

            // legacy：尝试切测验 Tab，最多 2 次，切不到就当无测验直接推进
            if (!this.quizDone) {
                this._quizSwitchTries = (this._quizSwitchTries || 0) + 1;
                if (this._quizSwitchTries <= 2) {
                    this.log('切换到「章节测验」Tab', 'i');
                    adapter.switchTab('quiz');
                    setFabState('running', '课舟 · 测验');
                    return;
                }
                this.log('未检测到测验内容，跳过', 'i');
                this.quizDone = true;
            }

            if (this.options.autoNext) {
                this.log('视频+测验都完成，autoNext → 下一节', 'o');
                setTimeout(() => {
                    if (!this.running) return;
                    adapter.nextChapter();
                    this.log('已点「下一节」', 'o');
                    setFabState('running', '课舟 · 进行中');
                    this.lastRatio = 0;
                    this.quizDone = false;
                    this.videoDone = false;
                    this._seekedFor = null;
                    this.epoch++;
                }, 1200);
            } else {
                this.log('全部完成，等用户手动下一节', 'i');
            }
            return;
        }

        // 确保在播
        if (st.paused) {
            if (this.playRetry < 3) {
                this.playRetry++;
                this.log(`视频暂停中 → 尝试播放 (第${this.playRetry}次)`, 'i');
                this.tryPlay(adapter, task);
            } else {
                // 重试多了，等一会儿再试
                if (this.tickCount % 4 === 1) this.log('播放重试已达上限，等待下轮', 'e');
                this.playRetry = 0;
            }
        } else {
            this.playRetry = 0;
            if (Math.abs(st.playbackRate - this.options.playbackRate) > 0.01) {
                try { st.element.playbackRate = this.options.playbackRate; } catch (e) { }
            }
        }

        const pct = Math.round(st.ratio * 100);
        if (Math.abs(st.ratio - this.lastRatio) > 0.02) {
            this.lastRatio = st.ratio;
            setFabState('running', `课舟 · 视频 ${pct}%`);
            this.say(`视频播放中 ${pct}%`, 'info');
        }
    },

    tryPlay(adapter, task) {
        adapter.playVideo(this.options.playbackRate, task).then(r => {
            if (r.ok) this.log('播放成功', 'o');
            else this.log('播放失败：' + r.reason, 'e');
        });
    },

    bindVideo(video, adapter) {
        if (this.videoBound === video) return;
        this.unbindVideo();
        this.videoBound = video;
        this.log('绑定 video 事件', 'i');
        const onPause = () => {
            if (!this.running) return;
            const a = window.__KEZHOU_ADAPTER__;
            if (this.videoDone) return;
            if (a && a.detectMidVideoQuiz()) return;
            // 防抖：1 秒内多次 pause 只处理一次
            const now = Date.now();
            if (now - (this._lastPauseResume || 0) < 1000) return;
            this._lastPauseResume = now;
            this.log('video pause → 恢复', 'i');
            setTimeout(() => {
                if (!this.running || this.videoDone) return;
                const st = a && a.getVideoState(this.currentTask);
                if (st && st.paused && !a.detectMidVideoQuiz() && !this.videoDone) this.tryPlay(a, this.currentTask);
            }, 200);
        };
        const onEnded = () => {
            this.log('video ended', 'o');
            this.videoDone = true;
            this.unbindVideo();
            const a = window.__KEZHOU_ADAPTER__;
            if (this.currentTask) {
                this.markTaskDone(this.currentTask, 'ended');
                return;
            }
            if (a) {
                if (!this.quizDone) {
                    a.switchTab('quiz');
                    this.log('已点「章节测验」Tab', 'o');
                } else if (this.options.autoNext) {
                    setTimeout(() => { if (this.running) a.nextChapter(); }, 1500);
                }
            }
        };
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        this._vh = { onPause, onEnded };
    },

    unbindVideo() {
        if (this.videoBound && this._vh) {
            try {
                this.videoBound.removeEventListener('pause', this._vh.onPause);
                this.videoBound.removeEventListener('ended', this._vh.onEnded);
            } catch (e) { }
        }
        this.videoBound = null;
        this._vh = null;
    },

    // ---------- 视频中插题 ----------

    async handleMidQuiz(adapter, hit) {
        if (this.midQuizBusy) return;

        // 已答完 → 只点「继续学习」，绝不调 AI
        if (adapter.isMidQuizResolved(hit.doc)) {
            const ok = adapter.clickMidQuizContinue(hit.doc);
            if (ok) {
                this._midQuizStuck = 0;
                this.log('中插题已答完 → 点「继续学习」', 'o');
                return;
            }
            // 找不到继续按钮：加熔断，3 次失败后放弃（视频可能自动继续/已关闭）
            this._midQuizStuck = (this._midQuizStuck || 0) + 1;
            if (this._midQuizStuck <= 3) {
                this.log(`中插题已答完但找不到继续按钮（${this._midQuizStuck}/3）`, 'e');
            } else if (this._midQuizStuck === 4) {
                this.log('中插题继续按钮始终找不到，放弃等待（不影响后续）', 'i');
            }
            return;
        }

        this._midQuizStuck = 0;
        this.midQuizBusy = true;
        try {
            const q = adapter.parseMidQuiz(hit);
            if (!q || !q.options.length || !q.stem) {
                this.log('中插题解析失败', 'e');
                return;
            }

            // 同题缓存：避免反复调 AI 烧 token
            const cacheKey = q.stem.slice(0, 60);
            const cached = this._aiCache && this._aiCache[cacheKey];
            let answer, explain;
            if (cached) {
                answer = cached.answer;
                explain = cached.explain;
                this.log('中插题命中缓存 → ' + answer, 'o');
            } else {
                this.log(`中插题 [${q.type}] ${q.stem.slice(0, 50)}`, 'i');
                // AI 调用加重试（504 超时等瞬态错误很常见）
                let r = null;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    r = await AIEngine.answerQuestion(q);
                    if (r.ok) break;
                    this.log(`中插题 AI 失败（第${attempt}次）：${(r.error || '').slice(0, 80)}`, 'e');
                    if (attempt < 3) await new Promise(res => setTimeout(res, 3000));
                }
                if (!r.ok) {
                    this.log('中插题 AI 3 次重试均失败，跳过', 'e');
                    return;
                }
                answer = r.answer;
                explain = r.explain;
                this._aiCache = this._aiCache || {};
                this._aiCache[cacheKey] = { answer, explain };
                this.log('AI 答案=' + answer, 'o');
            }

            let key = answer;
            if (q.type === 'judge') key = (/true|对/i.test(answer)) ? 'A' : 'B';

            const r2 = adapter.submitMidQuiz(q, key);
            this.log('中插题提交结果=' + r2, 'o');

            // 提交后稍等，再点「继续学习」
            await new Promise(res => setTimeout(res, 800));
            if (adapter.isMidQuizResolved(hit.doc)) {
                adapter.clickMidQuizContinue(hit.doc);
                this.log('已点「继续学习」', 'o');
            }
        } catch (e) {
            this.log('中插题异常：' + e.message, 'e');
        }
        setTimeout(() => { this.midQuizBusy = false; }, 2000);
    },

    // ---------- 章节测验 ----------

    async handleQuiz(adapter, task) {
        // 多任务点：scoped 到该任务点的作业文档
        const quizDoc = task ? adapter.getTaskQuizDoc(task) : null;
        const params = adapter.getParams();
        const jobId = task && task.jobId ? String(task.jobId) : '';
        const key = (params.courseId || '') + '_' + (params.chapterId || '') + '_' + jobId;
        if (this.quizDone && this.lastQuizKey === key) {
            if (this.tickCount % 8 === 1) this.log('本测验已处理完，跳过');
            return;
        }
        if (this.quizBusy) return;
        if (this.lastQuizKey !== key) {
            this.lastQuizKey = key;
            this.quizDone = false;
        }

        this.log(`开始处理测验…${task ? ` (任务#${task.index} jobid=${jobId})` : ''}`, 'i');

        // 已答题 → 抓取作答记录入历史，然后跳过
        const doneReason = XXTQuiz.isQuizAlreadyDone(quizDoc);
        if (doneReason) {
            this.log(`测验已作答过（${doneReason}）→ 抓取记录入历史`, 'o');
            try {
                const recs = XXTQuiz.extractAnsweredRecords(quizDoc);
                if (recs.length) {
                    const p = adapter.getParams() || {};
                    KZHistory.add({
                        chapterId: p.chapterId || '',
                        courseId: p.courseId || '',
                        mode: this.mode,
                        decodeOk: true,
                        source: 'graded-view',
                        questions: recs.map(x => ({
                            qid: '', type: 'unknown',
                            stem: x.stem,
                            options: x.options,
                            answer: x.myAnswer || '',
                            correct: x.correct || '',
                            explain: x.explain || '',
                            isWrong: x.score !== '' && parseFloat(x.score) < 100 ? true : (x.correct ? x.myAnswer === x.correct : null),
                        })),
                    });
                    this.log(`已记录 ${recs.length} 题作答历史`, 'o');
                } else {
                    this.log('未解析到作答记录', 'e');
                }
            } catch (e) {
                this.log('历史记录失败: ' + e.message, 'e');
            }
            this.quizDone = true;
            setFabState('running', '课舟 · 测验已完成');
            if (task) {
                this.markTaskDone(task, 'already-done');
                this.quizBusy = false;
                return;
            }
            if (this.options.autoNext) {
                await new Promise(r => setTimeout(r, 1200));
                if (this.running) {
                    adapter.nextChapter();
                    this.log('已点「下一节」', 'o');
                    this.lastRatio = 0; this.quizDone = false; this.videoDone = false;
                    this._seekedFor = null; this.epoch++;
                }
            }
            this.quizBusy = false;
            return;
        }

        const questions = XXTQuiz.parse(quizDoc);
        this.log(`初始解析: ${questions.length} 题`, questions.length ? 'i' : 'e');

        if (!questions.length) {
            // 详细探测
            const doc = quizDoc || XXTQuiz._findQuizDoc();
            this.log(`quizDoc=${doc ? 'found' : 'null'}`, 'i');
            if (doc) {
                const zy = doc.querySelector('#ZyBottom');
                const sq = doc.querySelectorAll('div.singleQuesId');
                const tm = doc.querySelectorAll('.TiMu');
                this.log(`ZyBottom=${!!zy} singleQuesId=${sq.length} TiMu=${tm.length}`, 'i');
                if (zy) this.log('ZyBottom html≈' + zy.innerHTML.slice(0, 200), 'i');
            }
            return;
        }

        this.quizBusy = true;
        const myEpoch = this.epoch;   // 熔断标记
        try {
            const useVision = this.options.answerMode !== 'text';

            // 视觉模式不需要字体解码（截图已含正确字形），省掉 2~3 分钟建库
            if (!useVision) {
                this.log('字体解码中…', 'i');
                const doc = quizDoc || XXTQuiz._findQuizDoc();
                if (doc) {
                    const root = doc.querySelector('#ZyBottom') || doc;
                    await FontDecoder.decodeQuizRoot(root);
                    this.log('字体解码完成', 'o');
                }
                if (this.epoch !== myEpoch) {
                    this.log('章节已切换，熔断测验流程', 'e');
                    this.quizBusy = false;
                    return;
                }
            } else {
                this.log('视觉模式，跳过字体解码', 'i');
            }

            const qs = XXTQuiz.parse(quizDoc);
            this.log(`解码后解析: ${qs.length} 题`, 'o');

            const results = [];

            for (const q of qs) {
                if (!this.running || this.epoch !== myEpoch) {
                    this.log('运行状态变化，熔断测验', 'e');
                    break;
                }
                const label = { single: '单选', multi: '多选', judge: '判断', blank: '填空' }[q.type] || q.type;
                this.log(`第${q.index + 1}题[${label}] qid=${q.qid}`, 'i');
                this.say(`第 ${q.index + 1} 题（${label}）识别中…`, 'info');

                let screenshot = null, recognized = null, r = null;

                // ---- 视觉路线：截图 → 识别题干 + 答案 + 解析（失败重试 3 次）----
                if (useVision && q.element) {
                    try {
                        screenshot = await Capture.captureQuizRoot(q.element);
                        if (screenshot) {
                            this.log('  截图完成，发送视觉模型…', 'i');
                            let vr = null;
                            for (let attempt = 1; attempt <= 3; attempt++) {
                                vr = await AIEngine.answerWithVision(screenshot);
                                if (vr.ok) break;
                                this.log(`  视觉失败(${(vr.error || '').slice(0, 40)}) 第${attempt}次重试`, 'e');
                                if (attempt < 3) await new Promise(res => setTimeout(res, 2000));
                            }
                            if (vr && vr.ok) {
                                r = vr;
                                recognized = { stem: vr.stem || q.stem, options: vr.options || [] };
                                this.log('  视觉识别 → ' + vr.answer + ' | ' + (vr.stem || '').slice(0, 30), 'o');
                                this.say(`第 ${q.index + 1} 题已识别，答案 ${vr.answer}`, 'ok');
                            } else {
                                this.log('  视觉 3 次失败，回退文本', 'e');
                                this.say('截图识别失败，改用文本…', 'err');
                            }
                        }
                    } catch (e) {
                        this.log('  截图异常: ' + e.message, 'e');
                    }
                }

                // ---- 文本回退 ----
                if (!r) {
                    const cacheKey = q.stem.slice(0, 60);
                    if (this._aiCache && this._aiCache[cacheKey]) {
                        const c = this._aiCache[cacheKey];
                        r = { ok: true, answer: c.answer, explain: c.explain, reason: '(cached)' };
                        this.log('  命中缓存 → ' + c.answer, 'o');
                    } else {
                        r = await AIEngine.answerQuestion(q);
                        if (r.ok && r.answer) {
                            this._aiCache = this._aiCache || {};
                            this._aiCache[cacheKey] = { answer: r.answer, explain: r.explain || '' };
                        }
                    }
                }

                if (!r || !r.ok) {
                    this.log('AI 失败：' + ((r && r.error) || '').slice(0, 100), 'e');
                    if (/price not configured|模型.*未配置|model.*not found|401/.test((r && r.error) || '')) {
                        this.stop('AI 模型不可用，请到设置更换模型');
                        kzToast('AI 模型不可用，请到设置换一个模型', 'error');
                        return;
                    }
                    continue;
                }
                this.log('  AI=' + r.answer + (r.explain ? ' | 解析' + r.explain.length + '字' : ''), 'o');

                const ok = XXTQuiz.select(q, r.answer);
                this.log(ok ? '  已选中' : '  选中失败', ok ? 'o' : 'e');
                if (q.ansInput) this.log('  hidden=' + q.ansInput.value, 'i');

                results.push({
                    index: q.index,
                    type: q.type,
                    stem: (recognized && recognized.stem) || q.stem,
                    options: (recognized && recognized.options && recognized.options.length)
                        ? recognized.options.map(o => ({
                            key: o.key, text: o.text,
                            picked: String(r.answer).toUpperCase().includes(o.key)
                                || (q.type === 'judge' && ((r.answer === 'true' && o.text.includes('对')) || (r.answer === 'false' && o.text.includes('错')))),
                        }))
                        : q.options.map(o => ({
                            key: o.key, text: o.text,
                            picked: String(r.answer).toUpperCase().includes(o.key)
                                || (q.type === 'judge' && ((r.answer === 'true' && o.text.includes('对')) || (r.answer === 'false' && o.text.includes('错')))),
                        })),
                    answer: q.type === 'judge' ? (r.answer === 'true' ? '对' : '错') : r.answer,
                    explain: r.explain || '',
                    screenshot,
                });
                await new Promise(r2 => setTimeout(r2, 300));
            }

            // 有题未答成功 → 绝不提交
            if (results.length < qs.length) {
                this.log(`只成功作答 ${results.length}/${qs.length} 题，存在未答题 → 不提交`, 'e');
                kzToast(`有 ${qs.length - results.length} 题未答上，不提交`, 'error');
                this.quizBusy = false;
                this.quizDone = false;
                setFabState('running', '课舟 · 进行中');
                return;
            }
            if (this.epoch !== myEpoch) {
                this.log('章节已切换，取消确认框', 'e');
                this.quizBusy = false;
                return;
            }

            // ---- 确认弹窗（倒计时，可暂停 / 提前确认 / 取消）----
            const doSubmit = this.options.submitMode !== 'save';
            this.log(`弹出确认框：${results.length} 题，${this.options.confirmSeconds}s，结束后${doSubmit ? '自动提交' : '仅保存'}`, 'i');
            setFabState('running', '课舟 · 等待确认');
            this.modalOpen = true;

            const action = await new Promise((resolve) => {
                showQuizConfirm(results, {
                    seconds: this.options.confirmSeconds || 10,
                    submitLabel: doSubmit ? '确认提交' : '暂时保存',
                    onSubmit: (auto) => {
                        this.log(auto ? '倒计时结束 → 自动执行' : '用户确认 → 执行', 'o');
                        resolve('submit');
                    },
                    onCancel: () => {
                        this.log('用户取消，不提交', 'e');
                        resolve('cancel');
                    },
                });
            });
            this.modalOpen = false;

            if (action !== 'submit') {
                this.quizDone = false;
                setFabState('running', '课舟 · 进行中');
                return;
            }

            // 保存 / 提交
            let ok = false;
            if (doSubmit) {
                this.log('点「提交」…', 'i');
                const sv = XXTQuiz.submit(quizDoc);
                ok = sv.ok;
                this.log(ok ? '已点提交' : '提交失败:' + sv.reason, ok ? 'o' : 'e');
            } else {
                this.log('点「暂时保存」…', 'i');
                const sv = XXTQuiz.saveTemp(quizDoc);
                ok = sv.ok;
                this.log(ok ? '已暂时保存 ✓' : '保存失败:' + sv.reason, ok ? 'o' : 'e');
            }

            if (!ok) {
                this.log('保存/提交失败 → 不跳节', 'e');
                kzToast('保存失败，请手动操作', 'error');
                this.quizDone = false;
                setFabState('running', '课舟 · 进行中');
                return;
            }

            // 处理学习通确认弹窗（「确认提交？」）
            await new Promise(r2 => setTimeout(r2, 600));
            const confirmed = XXTQuiz.confirmYes();
            if (confirmed) this.log('已点学习通确认弹窗「确定」', 'o');

            this.quizDone = true;
            setFabState('running', '课舟 · 测验完成');
            kzToast(doSubmit ? '测验已提交' : '测验已保存', 'success');

            // 存作答历史
            let histId = '';
            try {
                const p2 = adapter.getParams() || {};
                histId = KZHistory.add({
                    chapterId: p2.chapterId || '',
                    courseId: p2.courseId || '',
                    mode: this.mode,
                    decodeOk: true,
                    source: 'auto-answer',
                    questions: results.map(x => ({
                        qid: '', type: x.type,
                        stem: x.stem,
                        options: x.options,
                        answer: x.answer,
                        explain: x.explain,
                        screenshot: x.screenshot ? true : false,
                    })),
                });
                this.log(`已记录 ${results.length} 题到历史`, 'o');
            } catch (e) { }

            // 提交后自动核对：抓成绩页的正确答案，回填历史对错
            if (histId && doSubmit) {
                this.scheduleAnswerVerify(histId, task || null);
            }

            // 多任务点：标记完成，队列自动处理下一个；不直接跳节
            if (task) {
                this.markTaskDone(task, 'submitted');
                return;
            }

            // legacy：进入下一节
            if (this.options.autoNext) {
                this.log('autoNext → 下一节', 'i');
                await new Promise(r2 => setTimeout(r2, 1200));
                if (this.running) {
                    adapter.nextChapter();
                    this.log('已点「下一节」', 'o');
                    this.lastRatio = 0;
                    this.quizDone = false;
                    this.videoDone = false;
                }
            } else {
                this.log('测验完成，等用户手动下一节', 'i');
            }
        } catch (e) {
            this.log('测验异常：' + e.message + '\n' + (e.stack || ''), 'e');
        } finally {
            // 无论正常完成、early-return 还是异常，都必须释放锁，否则主循环永久冻结
            this.quizBusy = false;
        }
    },
};

window.__KEZHOU_MAIN__ = KezhouMain;

(function boot() {
    function tryInit() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(tryInit, 400));
            return;
        }
        try { KezhouMain.init(); } catch (e) {
            console.error('[课舟] init 失败', e);
            try { KZLog.add('init 异常: ' + e.message + '\n' + (e.stack || ''), 'e'); } catch (e2) { }
        }
    }
    tryInit();
})();
