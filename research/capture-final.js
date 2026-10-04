// ============================================
// 课舟 · 最后一轮接口补缺
// 目标：只抓两个还缺的接口
//   A. 视频进度上报
//   B. 答题「暂时保存 / 提交」
//
// 用法（分开做两次）：
//
// 【第一次 · 测验】
//   1. 打开章节测验，等题目出来
//   2. 粘贴本脚本 → 回车
//   3. 点 2 个选项 → 点「暂时保存」→ 弹确认就点「提交/确定」
//   4. 等 8 秒自动下载 kezhou-final-*.txt
//
// 【第二次 · 视频】
//   1. 切到「1 视频」（切换 Tab 后必须重新粘贴本脚本！）
//   2. 粘贴本脚本 → 回车
//   3. 点播放，看 15 秒以上
//   4. 等 8 秒自动下载
//
// 把两个 txt 都发回。
// ============================================

(() => {
    'use strict';
    if (window.__KZ_FIN__) { console.log('已在运行'); return; }

    const rec = [];
    const origFetch = window.fetch;
    const OrigXHR = window.XMLHttpRequest;
    const cut = (v, n = 800) => {
        if (v == null) return '';
        const s = typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch (e) { return String(v); } })();
        return s.length > n ? s.slice(0, n) + '…' : s;
    };

    // 不跳过 mp4/m3u8 —— 进度上报有时和媒体同域；只跳纯静态
    const skip = u => !u || /\.(css|js|png|jpe?g|gif|svg|woff2?|ttf|ico)(\?|$)/i.test(u)
        || /hm\.baidu|google-analytics|cnzz|umeng|doubleclick|sentry/i.test(u);

    const hot = u => /work|homework|job|video|multimedia|study|log|answer|question|save|submit|visit|progress|play|record|report|fystat|multimedia\/log/i.test(u);

    const add = r => {
        if (skip(r.url)) return;
        r.id = rec.length + 1;
        r.time = new Date().toLocaleTimeString();
        rec.push(r);
        const flag = hot(r.url) ? '%c★' : '%c ';
        console.log(flag, hot(r.url) ? 'color:#c2352b;font-weight:bold;font-size:13px' : 'color:#999',
            r.method, cut(r.url, 140), r.status || '', r.req ? 'REQ:' + cut(r.req, 100) : '');
    };

    window.fetch = function (...args) {
        const input = args[0], init = args[1] || {};
        const url = typeof input === 'string' ? input : (input?.url || '');
        const method = (init.method || input?.method || 'GET').toUpperCase();
        let req = '';
        try {
            if (init.body) {
                if (typeof init.body === 'string') req = init.body;
                else if (init.body instanceof URLSearchParams) req = init.body.toString();
                else req = cut(init.body, 300);
            }
        } catch (e) { }
        const r = { via: 'fetch', method, url, req };
        return origFetch.apply(this, args).then(res => {
            r.status = res.status;
            res.clone().text().then(t => { r.res = cut(t, 800); add(r); }).catch(() => { r.res = '?'; add(r); });
            return res;
        }).catch(e => { r.err = String(e); add(r); throw e; });
    };

    function X() {
        const x = new OrigXHR();
        let method = 'GET', url = '', req = '';
        const oO = x.open;
        x.open = function (m, u, ...rest) { method = (m || 'GET').toUpperCase(); url = u || ''; return oO.apply(x, [m, u, ...rest]); };
        const oS = x.send;
        x.send = function (b) {
            try {
                if (b != null) {
                    if (typeof b === 'string') req = b;
                    else if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) req = b.toString();
                    else req = cut(b, 300);
                }
            } catch (e) { }
            return oS.apply(x, [b]);
        };
        x.addEventListener('loadend', () => {
            const r = { via: 'xhr', method, url, req, status: x.status };
            try {
                if (!x.responseType || x.responseType === 'text') r.res = cut(x.responseText, 800);
                else if (x.responseType === 'json') r.res = cut(x.response, 800);
                else r.res = '(' + (x.responseType || 'bin') + ')';
            } catch (e) { r.res = '(read fail)'; }
            add(r);
        });
        return x;
    }
    X.prototype = OrigXHR.prototype;
    window.XMLHttpRequest = X;

    const api = {
        rec, alive: true,
        save() {
            // 补 performance
            try {
                const seen = new Set(rec.map(r => r.url));
                performance.getEntriesByType('resource')
                    .filter(e => ['xmlhttprequest', 'fetch'].includes(e.initiatorType))
                    .forEach(e => {
                        if (!seen.has(e.name) && !skip(e.name)) {
                            rec.push({ id: rec.length + 1, time: '(perf)', via: 'perf', method: '?', url: e.name, dur: Math.round(e.duration) });
                        }
                    });
            } catch (e) { }

            const list = rec.filter(r => hot(r.url) || r.via === 'xhr' || r.via === 'fetch');
            const header =
                `=== 课舟·最后补缺 ===\npage: ${location.href}\ntime: ${new Date().toISOString()}\n` +
                `total=${rec.length} hot=${rec.filter(r => hot(r.url)).length}\n\n` +
                `--- 有请求体/响应体的 ---\n`;
            const body1 = list.filter(r => r.req || r.res).map(r =>
                `#${r.id} [${r.time}] ${r.method} ${r.url}${r.status ? ' →' + r.status : ''}\n` +
                (r.req ? `  REQ: ${cut(r.req, 600)}\n` : '') +
                (r.res ? `  RES: ${cut(r.res, 600)}\n` : '')
            ).join('\n');
            const body2 = `\n--- 全部 URL ---\n` + rec.map(r =>
                `#${r.id} [${r.time}] ${r.method} ${r.url}${r.status ? ' →' + r.status : ''}`
            ).join('\n');

            const fn = `kezhou-final-${Date.now().toString(36)}.txt`;
            const blob = new Blob([header + body1 + body2], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fn;
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
            console.log('%c✅ 已下载 ' + fn, 'color:#287047;font-size:14px;font-weight:bold');
            api.alive = false;
            return fn;
        },
        stop() {
            window.fetch = origFetch;
            window.XMLHttpRequest = OrigXHR;
            api.alive = false;
        }
    };
    window.__KZ_FIN__ = api;

    console.log('%c=== 课舟·最后补缺已启动 ===', 'color:#c2352b;font-size:15px;font-weight:bold');
    console.log('请立刻操作（测验：点选项+暂时保存 | 视频：播放15秒）');
    console.log('12 秒后自动下载');
    setTimeout(() => { if (api.alive) api.save(); }, 12000);
})();
