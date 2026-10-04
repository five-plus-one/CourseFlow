// ============================================
// 课舟 · 视频/答题接口捕获 (v2)
// 和 diagnose-network.js 的区别：这份更「傻瓜」，
// 装上后只需要操作页面，结束时自动下载，不需要记命令。
//
// 用法：
//   1. 打开视频页（视频能播）或测验页（题目能显示）
//   2. F12 → Console → 粘贴全部 → 回车
//   3. 【测验页】点几个选项 → 点「暂时保存」→ 等 2 秒
//      【视频页】点播放 → 看 10 秒以上 → 暂停
//   4. 等 5 秒，会自动下载 kezhou-net-*.txt
//      （若没下载，手动输入: __KEZHOU_NET__.save() ）
//
// 注意：切换章节/切换视频测验 Tab 会刷新 JS 环境，需要重新粘贴本脚本
// ============================================

(() => {
    'use strict';
    if (window.__KEZHOU_NET__ && window.__KEZHOU_NET__.alive) {
        console.log('已在运行，先 __KEZHOU_NET__.stop()');
        return;
    }

    const rec = [];
    const origFetch = window.fetch;
    const OrigXHR = window.XMLHttpRequest;

    const skip = u => !u || /\.(css|js|png|jpe?g|gif|svg|woff2?|ttf|ico|mp4|m3u8|ts)(\?|$)/i.test(u)
        || /hm\.baidu|google-analytics|cnzz|umeng|doubleclick|sentry/i.test(u);
    const cut = (v, n = 500) => {
        if (v == null) return '';
        const s = typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch (e) { return String(v); } })();
        return s.length > n ? s.slice(0, n) + '…' : s;
    };
    const isHot = u => /work|homework|job|video|multimedia|study|log|answer|question|save|submit|visit|card|knowledge|fystat|progress|playlog/i.test(u);

    const add = r => {
        if (skip(r.url)) return;
        r.id = rec.length + 1;
        r.t = new Date().toLocaleTimeString();
        rec.push(r);
        if (rec.length > 400) rec.shift();
        console.log('%c[课舟]', isHot(r.url) ? 'color:#c2352b;font-weight:bold' : 'color:#667085',
            r.method, cut(r.url, 150), r.status ? '→' + r.status : '', r.req ? ' req:' + cut(r.req, 80) : '');
    };

    window.fetch = function (...args) {
        const input = args[0], init = args[1] || {};
        const url = typeof input === 'string' ? input : (input?.url || '');
        const method = (init.method || input?.method || 'GET').toUpperCase();
        let req = '';
        try { if (init.body) req = typeof init.body === 'string' ? init.body : cut(init.body, 250); } catch (e) { }
        const r = { src: 'fetch', method, url, req };
        return origFetch.apply(this, args).then(res => {
            r.status = res.status;
            res.clone().text().then(t => { r.res = cut(t, 600); add(r); }).catch(() => { r.res = '(?)'; add(r); });
            return res;
        }).catch(e => { r.error = String(e); add(r); throw e; });
    };

    function X() {
        const x = new OrigXHR();
        let method = 'GET', url = '', req = '';
        const oOpen = x.open;
        x.open = function (m, u, ...rest) { method = (m || 'GET').toUpperCase(); url = u || ''; return oOpen.apply(x, [m, u, ...rest]); };
        const oSend = x.send;
        x.send = function (b) { try { if (b) req = typeof b === 'string' ? b : cut(b, 250); } catch (e) { } return oSend.apply(x, [b]); };
        x.addEventListener('loadend', () => {
            const r = { src: 'xhr', method, url, req, status: x.status };
            try {
                if (!x.responseType || x.responseType === 'text') r.res = cut(x.responseText, 600);
                else if (x.responseType === 'json') r.res = cut(x.response, 600);
                else r.res = '(' + x.responseType + ')';
            } catch (e) { r.res = '(read fail)'; }
            add(r);
        });
        return x;
    }
    X.prototype = OrigXHR.prototype;
    window.XMLHttpRequest = X;

    const api = {
        alive: true,
        rec,
        stop() { window.fetch = origFetch; window.XMLHttpRequest = OrigXHR; api.alive = false; console.log('已停止'); },
        dump() {
            console.log('共', rec.length, '条');
            rec.forEach(r => {
                console.log('#' + r.id, r.t, r.method, r.url, r.status ? '→' + r.status : '');
                if (r.req) console.log('  req:', cut(r.req, 200));
                if (r.res) console.log('  res:', cut(r.res, 200));
            });
        },
        save() {
            // 补 performance
            try {
                const seen = new Set(rec.map(r => r.url));
                performance.getEntriesByType('resource')
                    .filter(e => ['xmlhttprequest', 'fetch'].includes(e.initiatorType))
                    .forEach(e => {
                        if (!seen.has(e.name) && !skip(e.name)) {
                            rec.push({ id: rec.length + 1, t: '(perf)', src: 'performance', method: '?', url: e.name, duration: Math.round(e.duration) });
                        }
                    });
            } catch (e) { }

            const hot = rec.filter(r => isHot(r.url));
            const header =
                `=== 课舟网络捕获 ===\npage: ${location.href}\ntitle: ${document.title}\n` +
                `time: ${new Date().toISOString()}\ntotal: ${rec.length}  hot: ${hot.length}\n\n` +
                `--- 重点接口 ---\n`;
            const bodyHot = hot.map(r =>
                `#${r.id} [${r.t}] ${r.method} ${r.url}${r.status ? ' →' + r.status : ''}\n` +
                (r.req ? `   req: ${cut(r.req, 400)}\n` : '') +
                (r.res ? `   res: ${cut(r.res, 400)}\n` : '')
            ).join('\n');
            const bodyAll = `\n--- 全部 ---\n` + rec.map(r =>
                `#${r.id} [${r.t}] ${r.method} ${r.url}${r.status ? ' →' + r.status : ''}`
            ).join('\n');

            const filename = `kezhou-net-${Date.now().toString(36)}.txt`;
            const blob = new Blob([header + bodyHot + bodyAll], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
            console.log('%c✅ 已下载 ' + filename + '  (重点接口 ' + hot.length + ' 条)', 'color:#287047;font-weight:bold');
            return filename;
        },
    };
    window.__KEZHOU_NET__ = api;

    console.log('%c=== 课舟·接口捕获已启动 ===', 'color:#c2352b;font-size:14px;font-weight:bold');
    console.log('现在操作页面：');
    console.log('  测验页 → 点选项 → 点「暂时保存」');
    console.log('  视频页 → 点播放，看 10 秒以上');
    console.log('约 8 秒后自动下载；没下载就输 __KEZHOU_NET__.save()');

    // 操作完自动保存（首次 45 秒，够点几下）
    setTimeout(() => {
        if (api.alive && rec.length > 0) {
            console.log('%c[课舟] 45 秒到，自动保存…', 'color:#2166ad');
            api.save();
        }
    }, 45000);
})();
