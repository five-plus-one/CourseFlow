// ============================================
// 课舟 · 接口捕获 v3（钻进所有 iframe）
//
// v2 失败原因：视频/测验在嵌套 iframe 里发请求，
// 只 hook 主窗口拦不到。本版会递归 hook 所有可访问 iframe。
//
// 用法：
// 【测验】
//   1. 打开章节测验，等题目出来
//   2. 粘贴本脚本 → 回车（看到「已 hook N 个窗口」）
//   3. 点 2 个选项 → 点「暂时保存」→ 弹窗就点确定
//   4. 别动，等 15 秒自动下载
//
// 【视频】
//   1. 切到「1 视频」→ 等播放器出来
//   2. 重新粘贴本脚本（必须重新粘贴！）
//   3. 点播放，看 20 秒以上
//   4. 等自动下载
//
// 若自动下载失败：__KZ3__.save()
// ============================================

(() => {
    'use strict';
    if (window.__KZ3__) { console.log('已在运行，先 __KZ3__.stop()'); return; }

    const rec = [];
    const hookedWins = [];
    const cut = (v, n = 1000) => {
        if (v == null) return '';
        const s = typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch (e) { return String(v); } })();
        return s.length > n ? s.slice(0, n) + '…' : s;
    };

    // 只跳过明显的静态资源，保留一切可能的接口
    const skip = u => {
        if (!u) return true;
        if (/\.(css|png|jpe?g|gif|svg|woff2?|ttf|ico)(\?|$)/i.test(u)) return true;
        if (/hm\.baidu|google-analytics|cnzz|umeng|doubleclick|sentry|log\.baidu/i.test(u)) return true;
        return false;
    };

    const isHot = u => /work|homework|job|video|multimedia|study|log|answer|question|save|submit|visit|progress|play|record|report|fystat|card|knowledge|token|enc|rt|clazz/i.test(u);

    const add = (r) => {
        if (skip(r.url)) return;
        r.id = rec.length + 1;
        r.time = new Date().toLocaleTimeString();
        rec.push(r);
        if (rec.length > 500) rec.shift();
        const mark = isHot(r.url) ? '★' : '·';
        try {
            console.log(`%c${mark} [KZ3]`, isHot(r.url) ? 'color:#c2352b;font-weight:bold' : 'color:#888',
                r.method, cut(r.url, 160), r.status || '',
                r.req ? '\n    REQ ' + cut(r.req, 120) : '');
        } catch (e) { }
    };

    function hookWin(win, label) {
        if (!win || hookedWins.includes(win)) return;
        hookedWins.push(win);

        const origFetch = win.fetch;
        if (typeof origFetch === 'function') {
            win.fetch = function (...args) {
                const input = args[0];
                const init = args[1] || {};
                const url = typeof input === 'string' ? input : (input && input.url) || String(input);
                const method = (init.method || (input && input.method) || 'GET').toUpperCase();
                let req = '';
                try {
                    if (init.body != null) {
                        if (typeof init.body === 'string') req = init.body;
                        else if (typeof URLSearchParams !== 'undefined' && init.body instanceof URLSearchParams) req = init.body.toString();
                        else req = cut(init.body, 400);
                    }
                } catch (e) { }
                const r = { win: label, via: 'fetch', method, url, req };
                return origFetch.apply(this, args).then(res => {
                    r.status = res.status;
                    try {
                        res.clone().text().then(t => { r.res = cut(t, 800); add(r); }).catch(() => { add(r); });
                    } catch (e) { add(r); }
                    return res;
                }).catch(err => { r.err = String(err); add(r); throw err; });
            };
        }

        const OrigXHR = win.XMLHttpRequest;
        if (typeof OrigXHR === 'function') {
            function P() {
                const x = new OrigXHR();
                let method = 'GET', url = '', req = '';
                const oO = x.open;
                x.open = function (m, u, ...rest) {
                    method = (m || 'GET').toUpperCase();
                    url = u || '';
                    return oO.apply(x, [m, u, ...rest]);
                };
                const oS = x.send;
                x.send = function (b) {
                    try {
                        if (b != null) {
                            if (typeof b === 'string') req = b;
                            else if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) req = b.toString();
                            else req = cut(b, 400);
                        }
                    } catch (e) { }
                    return oS.apply(x, [b]);
                };
                x.addEventListener('loadend', () => {
                    const r = { win: label, via: 'xhr', method, url, req, status: x.status };
                    try {
                        if (!x.responseType || x.responseType === 'text') r.res = cut(x.responseText, 800);
                        else if (x.responseType === 'json') r.res = cut(x.response, 800);
                        else r.res = '(' + (x.responseType || 'bin') + ')';
                    } catch (e) { r.res = '(?)'; }
                    add(r);
                });
                return x;
            }
            P.prototype = OrigXHR.prototype;
            win.XMLHttpRequest = P;
        }

        // sendBeacon（视频进度常用）
        if (typeof win.navigator !== 'undefined' && win.navigator.sendBeacon) {
            const origBeacon = win.navigator.sendBeacon.bind(win.navigator);
            win.navigator.sendBeacon = function (url, data) {
                let req = '';
                try {
                    if (typeof data === 'string') req = data;
                    else if (data && typeof Blob !== 'undefined' && data instanceof Blob) req = '(Blob ' + data.size + ')';
                    else req = cut(data, 300);
                } catch (e) { }
                add({ win: label, via: 'beacon', method: 'BEACON', url: String(url), req });
                return origBeacon(url, data);
            };
        }
    }

    function hookAll(rootWin, label, depth) {
        if (depth > 6) return;
        try { hookWin(rootWin, label); } catch (e) { }
        try {
            const frames = rootWin.document.querySelectorAll('iframe');
            frames.forEach((f, i) => {
                const fl = `${label}>ifr${i}${f.id ? '#' + f.id : ''}`;
                try {
                    const w = f.contentWindow;
                    if (w) hookAll(w, fl, depth + 1);
                } catch (e) { /* cross-origin */ }
            });
        } catch (e) { }
    }

    hookAll(window, 'MAIN', 0);
    console.log(`%c[课舟] 已 hook ${hookedWins.length} 个窗口`, 'color:#2166ad;font-size:13px', hookedWins.map((w, i) => i));

    // iframe 后加载的也要 hook：轮询补挂
    const rehook = setInterval(() => {
        hookAll(window, 'MAIN', 0);
    }, 1500);
    setTimeout(() => clearInterval(rehook), 60000);

    const api = {
        rec, alive: true,
        save() {
            // 补 performance（含 iframe 文档的 performance）
            const dumpPerf = (win, label) => {
                try {
                    const seen = new Set(rec.map(r => r.url));
                    (win.performance || performance).getEntriesByType('resource')
                        .filter(e => ['xmlhttprequest', 'fetch', 'other', 'beacon'].includes(e.initiatorType))
                        .forEach(e => {
                            if (!seen.has(e.name) && !skip(e.name)) {
                                rec.push({
                                    id: rec.length + 1, time: '(perf)', win: label, via: 'perf',
                                    method: '?', url: e.name, dur: Math.round(e.duration),
                                    type: e.initiatorType
                                });
                            }
                        });
                } catch (e) { }
            };
            dumpPerf(window, 'MAIN');
            hookedWins.forEach((w, i) => { if (w !== window) dumpPerf(w, 'win' + i); });

            const withBody = rec.filter(r => r.req || r.res || r.via === 'beacon' || r.via === 'xhr' || r.via === 'fetch');
            const header =
                `=== 课舟·接口捕获 v3 ===\npage: ${location.href}\ntime: ${new Date().toISOString()}\n` +
                `hookedWins: ${hookedWins.length}\ntotal: ${rec.length}\n\n--- 有请求体的 ---\n`;
            const body1 = withBody.map(r =>
                `#${r.id} [${r.time}] (${r.win||''}/${r.via}) ${r.method} ${r.url}${r.status ? ' →' + r.status : ''}\n` +
                (r.req ? `  REQ: ${cut(r.req, 700)}\n` : '') +
                (r.res ? `  RES: ${cut(r.res, 700)}\n` : '')
            ).join('\n');
            const body2 = `\n--- 全部 URL ---\n` + rec.map(r =>
                `#${r.id} [${r.time}] (${r.win||''}/${r.via}) ${r.method} ${r.url}${r.status ? ' →' + r.status : ''}`
            ).join('\n');

            const fn = `kezhou-net3-${Date.now().toString(36)}.txt`;
            const blob = new Blob([header + body1 + body2], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fn;
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
            console.log('%c✅ 已下载 ' + fn + '  共 ' + rec.length + ' 条', 'color:#287047;font-size:14px;font-weight:bold');
            api.alive = false;
            clearInterval(rehook);
            return fn;
        },
        stop() {
            // 不还原（iframe 里的还原复杂），仅停止记录
            api.alive = false;
            clearInterval(rehook);
        }
    };
    window.__KZ3__ = api;

    console.log('%c=== 课舟·接口捕获 v3 已启动 ===', 'color:#c2352b;font-size:15px;font-weight:bold');
    console.log('现在操作：测验点选项+保存 | 视频播放20秒');
    console.log('25 秒后自动下载；也可手动 __KZ3__.save()');

    setTimeout(() => {
        if (api.alive && rec.length > 0) {
            console.log('%c[课舟] 25 秒到，自动保存…', 'color:#2166ad');
            api.save();
        } else if (api.alive) {
            console.log('%c[课舟] 还没抓到请求，请继续操作，再等一会儿手动 __KZ3__.save()', 'color:#c2352b');
        }
    }, 25000);
})();
