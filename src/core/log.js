// ========== 课舟 日志（持久化 + 追加） ==========
// 跨页面追加写入 GM_setValue，配置面板导出完整历史

const KZLog = {
    KEY: 'kezhou-log-entries',
    MAX: 3000,
    _mem: [],

    _load() {
        try {
            const raw = GM_getValue(this.KEY);
            if (raw) this._mem = JSON.parse(raw);
        } catch (e) { this._mem = []; }
        return this._mem;
    },

    _save() {
        try {
            GM_setValue(this.KEY, JSON.stringify(this._mem.slice(-this.MAX)));
        } catch (e) { }
    },

    add(msg, level) {
        const entry = {
            t: new Date().toISOString(),
            p: location.pathname + location.search.slice(0, 80),
            m: msg,
            l: level || 'i',
        };
        if (!this._mem.length) this._load();
        this._mem.push(entry);
        if (this._mem.length > this.MAX) this._mem = this._mem.slice(-this.MAX);
        this._save();

        // 控制台 + 页面小窗
        const color = level === 'e' ? '#c2352b' : level === 'o' ? '#287047' : '#2166ad';
        try { console.log('%c[课舟]', 'color:' + color, msg); } catch (e) { }
        if (typeof kzLog === 'function') kzLog(msg, level === 'e' ? 'err' : level === 'o' ? 'ok' : 'info');
    },

    export() {
        if (!this._mem.length) this._load();
        const main = window.__KEZHOU_MAIN__;
        const header =
            `=== 课舟完整日志（跨页面追加） ===\n` +
            `export: ${new Date().toISOString()}\n` +
            `count: ${this._mem.length}\n` +
            `mode: ${main ? main.mode : '?'}\n` +
            `options: ${main ? JSON.stringify(main.options) : '?'}\n` +
            `page: ${location.href}\n\n`;
        const body = this._mem.map(e =>
            `[${e.t}] ${e.p}\n  ${e.m}`
        ).join('\n');

        const fn = `kezhou-log-full-${Date.now().toString(36)}.txt`;
        const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fn;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        return fn;
    },

    clear() {
        this._mem = [];
        try { GM_setValue(this.KEY, '[]'); } catch (e) { }
    },
};
