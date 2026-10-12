// ========== 课舟 UI v2 ==========
// 收起/展开 · 友好日志 · 设置分页签 · 历史入口
// 设计 token 对齐 AI-Marker-Suite

function kezhouUIRoot() {
    if (document.body && document.body.tagName === 'FRAMESET') return document.documentElement;
    return document.body || document.documentElement;
}

function ensureKezhouStyles() {
    if (document.getElementById('kezhou-styles')) return;
    const s = document.createElement('style');
    s.id = 'kezhou-styles';
    s.textContent = `
        .kz-fab, .kz-panel, .kz-toast, .kz-log, .kz-icon-btn, .kz-pill {
            all: initial;
            box-sizing: border-box !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif !important;
            pointer-events: auto !important;
            visibility: visible !important;
        }

        /* 收起态：一个小胶囊 */
        .kz-pill {
            position: fixed !important;
            left: 16px !important;
            bottom: 16px !important;
            z-index: 99999 !important;
            display: none !important;
            align-items: center !important;
            gap: 6px !important;
            height: 38px !important;
            padding: 0 14px !important;
            background: rgba(20,20,20,0.92) !important;
            color: #fff !important;
            border-radius: 20px !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.18) !important;
        }
        .kz-pill.show { display: flex !important; }

        .kz-fab {
            position: fixed !important;
            left: 16px !important;
            bottom: 16px !important;
            z-index: 99999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-width: 110px !important;
            height: 40px !important;
            padding: 0 16px !important;
            background: rgba(20,20,20,0.92) !important;
            color: #fff !important;
            border: 1.5px solid rgba(255,255,255,0.1) !important;
            border-radius: 40px !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            box-shadow: 0 12px 32px rgba(0,0,0,0.18) !important;
            transition: all 0.3s cubic-bezier(0.16,1,0.3,1) !important;
            line-height: 1 !important;
        }
        .kz-fab:hover { transform: translateY(-2px) scale(1.02) !important; }
        .kz-fab.running { border-color: rgba(64,158,255,0.55) !important; animation: kz-pulse-blue 2s infinite !important; }
        .kz-fab.paused { border-color: rgba(230,162,60,0.55) !important; animation: kz-pulse-amber 2s infinite !important; }
        @keyframes kz-pulse-blue { 0%,100%{box-shadow:0 12px 32px rgba(0,0,0,.18),0 0 0 0 rgba(64,158,255,.3)} 50%{box-shadow:0 12px 32px rgba(0,0,0,.18),0 0 0 8px rgba(64,158,255,0)} }
        @keyframes kz-pulse-amber { 0%,100%{box-shadow:0 12px 32px rgba(0,0,0,.18),0 0 0 0 rgba(230,162,60,.3)} 50%{box-shadow:0 12px 32px rgba(0,0,0,.18),0 0 0 8px rgba(230,162,60,0)} }

        .kz-icon-btn {
            position: fixed !important;
            left: 16px !important;
            z-index: 99999 !important;
            width: 36px !important;
            height: 36px !important;
            border-radius: 50% !important;
            background: rgba(255,255,255,0.94) !important;
            border: 1px solid rgba(0,0,0,0.08) !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.3s cubic-bezier(0.16,1,0.3,1) !important;
        }
        .kz-icon-btn:hover { transform: translateY(-2px) scale(1.05) !important; }
        .kz-icon-btn svg { width: 17px !important; height: 17px !important; color: #444 !important; }

        /* 设置面板：右侧 + 分页签 */
        .kz-panel {
            position: fixed !important;
            top: 0 !important; right: 0 !important;
            width: 380px !important;
            height: 100vh !important;
            z-index: 2147483646 !important;
            background: #fff !important;
            border-left: 1px solid #e1e6ef !important;
            box-shadow: -16px 0 48px rgba(18,28,45,0.12) !important;
            overflow-y: auto !important;
            transform: translateX(100%) !important;
            transition: transform 0.3s cubic-bezier(0.16,1,0.3,1) !important;
            color: #172033 !important;
            padding: 0 !important;
        }
        .kz-panel.open { transform: translateX(0) !important; }
        .kz-panel-head { padding: 22px 24px 0 !important; }
        .kz-panel h2 { margin: 0 0 4px !important; font-size: 18px !important; font-weight: 700 !important; color: #172033 !important; }
        .kz-sub { font-size: 12px !important; color: #667085 !important; margin-bottom: 14px !important; }
        .kz-tabs { display: flex !important; gap: 6px !important; padding: 0 24px !important; border-bottom: 1px solid #eef1f6 !important; }
        .kz-tab {
            padding: 10px 14px !important; font-size: 13px !important; font-weight: 700 !important;
            color: #667085 !important; cursor: pointer !important; border: none !important;
            background: none !important; border-bottom: 2px solid transparent !important;
        }
        .kz-tab.active { color: #2166ad !important; border-bottom-color: #2166ad !important; }
        .kz-tab-body { padding: 18px 24px 28px !important; }
        .kz-panel label { display: block !important; font-size: 12px !important; font-weight: 600 !important; color: #667085 !important; margin: 14px 0 6px !important; }
        .kz-panel input, .kz-panel select, .kz-panel textarea {
            width: 100% !important; padding: 10px 12px !important; border: 1px solid #d8dee8 !important;
            border-radius: 8px !important; font-size: 13px !important; color: #172033 !important;
            background: #fff !important; font-family: inherit !important; box-sizing: border-box !important;
        }
        .kz-panel input:focus { outline: none !important; border-color: #2166ad !important; box-shadow: 0 0 0 3px rgba(33,102,173,0.12) !important; }
        .kz-panel input:disabled { background: #f3f6fa !important; color: #98a2b3 !important; }
        .kz-check { display: flex !important; align-items: center !important; gap: 8px !important; margin: 10px 0 !important; font-size: 13px !important; color: #344054 !important; }
        .kz-check input[type="checkbox"] {
            width: 18px !important; height: 18px !important; padding: 0 !important;
            border: none !important; border-radius: 4px !important; box-shadow: none !important;
            accent-color: #2166ad !important; flex-shrink: 0 !important; cursor: pointer !important;
        }
        .kz-check input[type="checkbox"]:focus {
            outline: none !important; box-shadow: 0 0 0 2px rgba(33,102,173,0.25) !important;
        }
        .kz-btn-row { display: flex !important; gap: 10px !important; margin-top: 20px !important; }
        .kz-btn { flex: 1 !important; padding: 11px 0 !important; border-radius: 8px !important; font-size: 13px !important; font-weight: 700 !important; cursor: pointer !important; border: none !important; text-align: center !important; }
        .kz-btn-primary { background: #172033 !important; color: #fff !important; box-shadow: 0 6px 16px rgba(18,28,45,0.18) !important; }
        .kz-btn-primary:hover { background: #0f1725 !important; }
        .kz-btn-ghost { background: #fff !important; color: #344054 !important; border: 1px solid #d8dee8 !important; }
        .kz-btn-ghost:hover { background: #f3f6fa !important; }

        .kz-toast {
            position: fixed !important; top: 24px !important; left: 50% !important;
            transform: translate(-50%,-20px) !important;
            background: #fff !important; color: #172033 !important;
            padding: 12px 20px !important; border-radius: 10px !important;
            border: 1px solid #e1e6ef !important; border-left: 4px solid #2166ad !important;
            box-shadow: 0 16px 42px rgba(18,28,45,0.18) !important;
            z-index: 2147483647 !important; font-size: 13px !important; font-weight: 600 !important;
            opacity: 0 !important; transition: all .3s cubic-bezier(.16,1,.3,1) !important;
            max-width: 420px !important; line-height: 1.45 !important;
        }
        .kz-toast.show { opacity: 1 !important; transform: translate(-50%,0) !important; }
        .kz-toast.success { border-left-color: #287047 !important; }
        .kz-toast.error { border-left-color: #c2352b !important; }

        /* 用户友好日志 */
        .kz-log {
            position: fixed !important;
            left: 16px !important;
            bottom: 68px !important;
            width: 260px !important;
            max-height: 150px !important;
            overflow-y: auto !important;
            background: rgba(23,32,51,0.92) !important;
            color: #c8d2e0 !important;
            padding: 10px 12px !important;
            border-radius: 10px !important;
            font-size: 11.5px !important;
            line-height: 1.55 !important;
            z-index: 99998 !important;
            box-shadow: 0 8px 28px rgba(0,0,0,0.2) !important;
            display: none !important;
        }
        .kz-log.visible { display: block !important; }
        .kz-log .ok { color: #6ee7a0 !important; }
        .kz-log .err { color: #fca5a5 !important; }
        .kz-log .info { color: #93c5fd !important; }

        /* 收起时隐藏一切 */
        body.kz-collapsed .kz-fab,
        body.kz-collapsed .kz-icon-btn,
        body.kz-collapsed .kz-log { display: none !important; }
    `;
    document.head.appendChild(s);
}

// ---------- Toast ----------
function kzToast(msg, type = 'info') {
    ensureKezhouStyles();
    let el = document.querySelector('.kz-toast');
    if (!el) {
        el = document.createElement('div');
        el.className = 'kz-toast';
        kezhouUIRoot().appendChild(el);
    }
    el.className = 'kz-toast ' + type;
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------- 技术日志小窗（导出用，显示给用户看友好版） ----------
function kzLog(msg, cls = 'info') {
    ensureKezhouStyles();
    let box = document.querySelector('.kz-log');
    if (!box) {
        box = document.createElement('div');
        box.className = 'kz-log';
        kezhouUIRoot().appendChild(box);
    }
    box.classList.add('visible');
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 40) box.removeChild(box.firstChild);
}

// ---------- 友好日志（给用户看） ----------
const KZFriendly = {
    last: '',
    say(msg, cls) {
        if (msg === this.last) return;   // 去重，避免刷屏
        this.last = msg;
        kzLog(msg, cls);
    },
};

// ---------- 收起 / 展开 ----------
function kzSetCollapsed(collapsed) {
    document.body.classList.toggle('kz-collapsed', collapsed);
    const pill = document.querySelector('.kz-pill');
    if (pill) pill.classList.toggle('show', collapsed);
    try { GM_setValue('kezhou-collapsed', collapsed); } catch (e) { }
}

function toggleKezhouPanel(force, tab) {
    const panel = document.getElementById('kezhou-panel');
    if (!panel) return;
    const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    if (open && tab) {
        panel.querySelectorAll('.kz-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        panel.querySelectorAll('.kz-tab-body').forEach(b => b.style.display = b.dataset.tab === tab ? 'block' : 'none');
    }
}

function setFabState(state, text) {
    const fab = document.querySelector('.kz-fab');
    if (!fab) return;
    fab.className = 'kz-fab' + (state ? ' ' + state : '');
    if (text) fab.textContent = text;
    const pill = document.querySelector('.kz-pill');
    if (pill) pill.textContent = text || '课舟';
}

// ---------- 创建按钮 / 面板 ----------
function createKezhouButtons() {
    if (document.querySelector('.kz-fab')) return;
    ensureKezhouStyles();
    const root = kezhouUIRoot();

    // 收起态胶囊
    const pill = document.createElement('button');
    pill.className = 'kz-pill';
    pill.innerHTML = '<span>舟</span><span>展开</span>';
    pill.title = '展开课舟';
    pill.onclick = () => kzSetCollapsed(false);
    root.appendChild(pill);

    // 主按钮
    const fab = document.createElement('button');
    fab.className = 'kz-fab';
    fab.textContent = '课舟 · 开始学习';
    fab.onclick = () => window.__KEZHOU_MAIN__.toggle();
    root.appendChild(fab);

    const icon = (bottom, title, svg, onclick) => {
        const b = document.createElement('button');
        b.className = 'kz-icon-btn';
        b.style.bottom = bottom + 'px';
        b.title = title;
        b.innerHTML = svg;
        b.onclick = onclick;
        root.appendChild(b);
        return b;
    };

    icon(64, '收起课舟',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6"/></svg>',
        () => kzSetCollapsed(true));

    icon(110, '设置',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        () => toggleKezhouPanel());

    icon(156, '作答历史',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>',
        () => showKezhouHistory());

    icon(202, '发讨论（AI 生成）',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        async () => {
            if (!window.__KEZHOU_DISCUSS__) { kzToast('讨论模块未加载', 'error'); return; }
            const n = prompt('发几条讨论？', '2');
            const count = parseInt(n);
            if (!count || count < 1 || count > 5) { kzToast('数量需为 1~5', 'error'); return; }
            kzToast('AI 生成讨论中…', 'info');
            const posted = await window.__KEZHOU_DISCUSS__.manualPost(count);
            if (posted > 0) kzToast(`已发表 ${posted} 条讨论`, 'success');
            else kzToast('发帖失败或已达到上限', 'error');
        });

    icon(248, '关于 / 支持作者',
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 11v5"/></svg>',
        () => showKezhouAbout());

    createKezhouPanel();

    // 恢复收起状态
    try { if (GM_getValue('kezhou-collapsed')) kzSetCollapsed(true); } catch (e) { }
}

function createKezhouPanel() {
    const cfg = AIEngine.getConfig();
    const panel = document.createElement('div');
    panel.className = 'kz-panel';
    panel.id = 'kezhou-panel';

    const provName = ProviderManager.get().active || '5+1API';
    const is51 = provName === '5+1API';
    const models = is51
        ? [['courseflow', 'courseflow（推荐）'], ['mimo-v2.6-pro', 'mimo-v2.6-pro'], ['__custom__', '自定义…']]
        : [['__custom__', '自定义模型']];
    const curModel = cfg.model || 'courseflow';
    const modelOpts = models.map(([v, l]) =>
        `<option value="${v}" ${v === curModel || (v === '__custom__' && !models.some(m => m[0] === curModel)) ? 'selected' : ''}>${l}</option>`
    ).join('');

    panel.innerHTML = `
    <div class="kz-panel-head">
        <h2>课舟设置</h2>
        <div class="kz-sub">v${SCRIPT_CONFIG.VERSION} · 学习通自动学习助手</div>
    </div>
    <div class="kz-tabs">
        <button class="kz-tab active" data-tab="answer">答题</button>
        <button class="kz-tab" data-tab="ai">AI</button>
        <button class="kz-tab" data-tab="about">关于</button>
    </div>

    <div class="kz-tab-body" data-tab="answer">
        <label>运行模式</label>
        <select id="kz-mode">
            <option value="normal">普通模式（确认后提交）</option>
            <option value="unattended">无人值守（直接提交）</option>
        </select>
        <label>答题方式</label>
        <select id="kz-answer-mode">
            <option value="vision">截图识别（推荐）</option>
            <option value="text">纯文本</option>
        </select>
        <label>倒计时结束后</label>
        <select id="kz-submit-mode">
            <option value="submit">自动提交</option>
            <option value="save">仅暂时保存</option>
        </select>
        <label>确认秒数</label>
        <select id="kz-confirm">
            <option value="5">5 秒</option>
            <option value="10">10 秒</option>
            <option value="30">30 秒</option>
        </select>
        <label>视频倍速</label>
        <select id="kz-rate">
            <option value="1">1x（默认）</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
        </select>
        <label>视频播放到多少算完成</label>
        <select id="kz-complete">
            <option value="1">100%</option>
            <option value="0.95">95%</option>
            <option value="0.9">90%</option>
        </select>
        <div class="kz-check"><input type="checkbox" id="kz-auto-video"><span>自动播放视频</span></div>
        <div class="kz-check"><input type="checkbox" id="kz-auto-quiz"><span>自动章节测验</span></div>
        <div class="kz-check"><input type="checkbox" id="kz-auto-midquiz"><span>自动答视频中插题</span></div>
        <div class="kz-check"><input type="checkbox" id="kz-auto-next"><span>完成后自动下一节</span></div>
        <div class="kz-check"><input type="checkbox" id="kz-skip-watched"><span>跳过已看过的视频</span></div>

        <div style="margin-top:18px;padding-top:14px;border-top:1px solid #eef1f6;">
            <div style="font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;">自动讨论</div>
            <div class="kz-check"><input type="checkbox" id="kz-auto-discuss"><span>完成任务点后自动发帖</span></div>
            <label>每次发几条</label>
            <select id="kz-discuss-count">
                <option value="1">1 条</option>
                <option value="2" selected>2 条</option>
                <option value="3">3 条</option>
            </select>
            <label>每门课最多发几条</label>
            <input id="kz-discuss-max" type="number" min="1" max="100" value="10" placeholder="1~100">
            <div class="kz-check"><input type="checkbox" id="kz-discuss-like"><span>发帖后自动点赞</span></div>
        </div>
    </div>

    <div class="kz-tab-body" data-tab="ai" style="display:none">
        <label>AI 供应商</label>
        <select id="kz-provider">
            <option value="5+1API">5+1 API（推荐）</option>
            <option value="自定义">其他（自定义）</option>
        </select>
        <label>接口地址</label>
        <input id="kz-endpoint" value="${cfg.endpoint || ''}" placeholder="https://api.ai.five-plus-one.com/v1/chat/completions" ${is51 ? 'disabled' : ''}>
        <label>API Key</label>
        <input id="kz-apikey" type="password" value="${cfg.apiKey || ''}" placeholder="sk-...">
        <label>模型</label>
        <select id="kz-model">${modelOpts}</select>
        <input id="kz-model-custom" placeholder="自定义模型名" style="margin-top:6px;display:${curModel === '__custom__' || (!is51 && curModel === 'custom') ? 'block' : 'none'}">
        <div class="kz-btn-row">
            <button class="kz-btn kz-btn-ghost" id="kz-test-ai">测试 AI</button>
        </div>
    </div>

    <div class="kz-tab-body" data-tab="about" style="display:none">
        <div style="width:56px;height:56px;margin:8px auto 12px;background:linear-gradient(135deg,#172033,#2166ad);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;font-weight:700;">舟</div>
        <div style="text-align:center;font-size:15px;font-weight:700;margin-bottom:4px;">课舟 · 网课学习助手</div>
        <div style="text-align:center;font-size:12px;color:#667085;margin-bottom:16px;">v${SCRIPT_CONFIG.VERSION} · 学习通</div>
        <div style="font-size:12.5px;color:#344054;line-height:1.8;">
            · 自动播放视频（可跳过已看）<br>
            · 视频中插题 / 章节测验自动作答<br>
            · 截图视觉识别，答案 + 详细解析<br>
            · 作答历史可导出 JSON / CSV / HTML
        </div>
        <div class="kz-btn-row">
            <button class="kz-btn kz-btn-ghost" id="kz-about-btn">完整关于</button>
            <button class="kz-btn kz-btn-ghost" id="kz-hist-btn">作答历史</button>
        </div>
        <div class="kz-btn-row">
            <button class="kz-btn kz-btn-ghost" id="kz-export-log">导出日志</button>
            <button class="kz-btn kz-btn-ghost" id="kz-clear-log">清空日志</button>
        </div>
    </div>

    <div style="padding: 0 24px 28px;">
        <div class="kz-btn-row">
            <button class="kz-btn kz-btn-ghost" id="kz-close">关闭</button>
            <button class="kz-btn kz-btn-primary" id="kz-save">保存</button>
        </div>
    </div>`;
    kezhouUIRoot().appendChild(panel);

    // 分页签
    panel.querySelectorAll('.kz-tab').forEach(t => {
        t.onclick = () => {
            panel.querySelectorAll('.kz-tab').forEach(x => x.classList.toggle('active', x === t));
            panel.querySelectorAll('.kz-tab-body').forEach(b => b.style.display = b.dataset.tab === t.dataset.tab ? 'block' : 'none');
        };
    });

    // 供应商切换：5+1 锁定端点
    const provSel = panel.querySelector('#kz-provider');
    provSel.value = is51 ? '5+1API' : '自定义';
    provSel.onchange = () => {
        const is51Now = provSel.value === '5+1API';
        const ep = panel.querySelector('#kz-endpoint');
        ep.disabled = is51Now;
        if (is51Now) ep.value = 'https://api.ai.five-plus-one.com/v1/chat/completions';
        else ep.value = '';
        const mSel = panel.querySelector('#kz-model');
        mSel.innerHTML = is51Now
            ? '<option value="courseflow">courseflow（推荐）</option><option value="mimo-v2.6-pro">mimo-v2.6-pro</option><option value="__custom__">自定义…</option>'
            : '<option value="__custom__">自定义模型</option>';
        panel.querySelector('#kz-model-custom').style.display = 'none';
    };
    panel.querySelector('#kz-model').onchange = function () {
        panel.querySelector('#kz-model-custom').style.display = this.value === '__custom__' ? 'block' : 'none';
    };

    panel.querySelector('#kz-close').onclick = () => toggleKezhouPanel(false);
    panel.querySelector('#kz-about-btn').onclick = () => showKezhouAbout();
    panel.querySelector('#kz-hist-btn').onclick = () => showKezhouHistory();
    panel.querySelector('#kz-export-log').onclick = () => {
        const fn = KZLog.export();
        kzToast('日志已导出 ' + fn, 'success');
    };
    panel.querySelector('#kz-clear-log').onclick = () => { KZLog.clear(); kzToast('日志已清空', 'info'); };

    panel.querySelector('#kz-test-ai').onclick = async () => {
        kzToast('正在测试 AI…');
        const r = await AIEngine.chat('回复两个字：正常', '你是一个测试助手。');
        if (r.ok) kzToast('AI 连接成功：' + r.text.slice(0, 30), 'success');
        else kzToast('AI 连接失败：' + r.error, 'error');
    };

    panel.querySelector('#kz-save').onclick = () => {
        const prov = panel.querySelector('#kz-provider').value;
        const modelVal = panel.querySelector('#kz-model').value;
        const modelFinal = modelVal === '__custom__'
            ? (panel.querySelector('#kz-model-custom').value.trim() || (prov === '5+1API' ? 'courseflow' : 'custom'))
            : modelVal;
        ProviderManager.setActive(prov, modelFinal);
        if (prov !== '5+1API') {
            ProviderManager.setEndpoint(prov, panel.querySelector('#kz-endpoint').value.trim());
        }
        ProviderManager.setKey(prov, panel.querySelector('#kz-apikey').value.trim());

        const m = window.__KEZHOU_MAIN__;
        m.mode = panel.querySelector('#kz-mode').value || 'normal';
        m.options.answerMode = panel.querySelector('#kz-answer-mode').value;
        m.options.submitMode = panel.querySelector('#kz-submit-mode').value;
        m.options.confirmSeconds = parseInt(panel.querySelector('#kz-confirm').value) || 10;
        m.options.playbackRate = parseFloat(panel.querySelector('#kz-rate').value) || 1;
        m.options.completeRatio = parseFloat(panel.querySelector('#kz-complete').value) || 1;
        m.options.autoVideo = panel.querySelector('#kz-auto-video').checked;
        m.options.autoQuiz = panel.querySelector('#kz-auto-quiz').checked;
        m.options.autoMidQuiz = panel.querySelector('#kz-auto-midquiz').checked;
        m.options.autoNext = panel.querySelector('#kz-auto-next').checked;
        m.options.skipWatched = panel.querySelector('#kz-skip-watched').checked;
        // 讨论设置
        m.options.autoDiscuss = panel.querySelector('#kz-auto-discuss').checked;
        m.options.discussPerTrigger = parseInt(panel.querySelector('#kz-discuss-count').value) || 2;
        m.options.discussMaxPerCourse = Math.min(100, Math.max(1, parseInt(panel.querySelector('#kz-discuss-max').value) || 10));
        m.options.discussAutoLike = panel.querySelector('#kz-discuss-like').checked;
        try {
            GM_setValue('kezhou-mode', m.mode);
            GM_setValue('kezhou-options', JSON.stringify(m.options));
        } catch (e) { }
        kzToast('设置已保存', 'success');
        toggleKezhouPanel(false);
    };
}

// 回填当前值到面板
function syncKezhouPanel() {
    const panel = document.getElementById('kezhou-panel');
    if (!panel) return;
    const m = window.__KEZHOU_MAIN__;
    const set = (id, v) => { const el = panel.querySelector('#' + id); if (el) el.value = v; };
    const chk = (id, v) => { const el = panel.querySelector('#' + id); if (el) el.checked = !!v; };
    set('kz-mode', m.mode);
    set('kz-answer-mode', m.options.answerMode);
    set('kz-submit-mode', m.options.submitMode);
    set('kz-confirm', m.options.confirmSeconds);
    set('kz-rate', m.options.playbackRate);
    set('kz-complete', m.options.completeRatio);
    chk('kz-auto-video', m.options.autoVideo);
    chk('kz-auto-quiz', m.options.autoQuiz);
    chk('kz-auto-midquiz', m.options.autoMidQuiz);
    chk('kz-auto-next', m.options.autoNext);
    chk('kz-skip-watched', m.options.skipWatched);
    // 讨论设置
    chk('kz-auto-discuss', m.options.autoDiscuss);
    set('kz-discuss-count', m.options.discussPerTrigger || 2);
    set('kz-discuss-max', m.options.discussMaxPerCourse || 10);
    chk('kz-discuss-like', m.options.discussAutoLike !== false);
}
