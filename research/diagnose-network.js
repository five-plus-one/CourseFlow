// ============================================
// 课舟 · 学习通网络请求拦截脚本 (v2 · 自动下载)
// 用法：
//   1. 打开视频页或测验页（先按 DEBUGGER.md 关掉 debugger 暂停）
//   2. F12 → Console → 粘贴全部 → 回车
//   3. 手动操作：点播放 / 切到章节测验 / 点选项 / 点「暂时保存」
//   4. 操作完后，控制台输入:  __KEZHOU_NET__.save()
//      会自动下载 kezhou-net-*.txt，把文件发回
// 其他命令: .dump() 打印 | .relevant() 只看学习相关 | .clear() 清空 | .stop() 停止
// ============================================

(() => {
    'use strict';
    if (window.__KEZHOU_NET__) {
        console.log('⚠️ 已在运行。先 __KEZHOU_NET__.stop() 再重装');
        return;
    }

    const records = [];
    const MAX = 300;
    const origFetch = window.fetch;
    const OrigXHR = window.XMLHttpRequest;

    const skipUrl = (url) => {
        if (!url) return true;
        return /\.(css|js|png|jpg|jpeg|gif|svg|woff2?|ttf|ico|mp4|webm|m3u8|ts|otf)(\?|$)/i.test(url)
            || /google-analytics|hm\.baidu|cnzz|umeng|sentry|log\.baidu|doubleclick/i.test(url);
    };
    const safe = (v, max = 600) => {
        if (v == null) return '';
        let s = typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch (e) { return String(v); } })();
        return s.length > max ? s.slice(0, max) + '…(trunc)' : s;
    };
    const push = (rec) => {
        if (skipUrl(rec.url)) return;
        rec.id = records.length + 1;
        rec.time = new Date().toLocaleTimeString();
        records.push(rec);
        if (records.length > MAX) records.shift();
        const interesting = /quiz|exam|test|work|job|answer|question|video|progress|study|log|score|submit|save|chapter|knowledge|mooc|ans|visit|multimedia|fystat/i.test(rec.url);
        console.log('%c[课舟·网]', interesting ? 'color:#2166ad;font-weight:bold' : 'color:#667085',
            rec.method, safe(rec.url, 160), rec.status ? '→' + rec.status : '',
            rec.reqBody ? ' req:' + safe(rec.reqBody, 100) : '');
    };

    window.fetch = function (...args) {
        const input = args[0];
        const init = args[1] || {};
        const url = typeof input === 'string' ? input : (input?.url || '');
        const method = (init.method || input?.method || 'GET').toUpperCase();
        let reqBody = '';
        try { if (init.body) reqBody = typeof init.body === 'string' ? init.body : safe(init.body, 300); } catch (e) { }
        const rec = { source: 'fetch', method, url, reqBody };
        return origFetch.apply(this, args).then(res => {
            rec.status = res.status;
            const clone = res.clone();
            clone.text().then(t => {
                rec.resBody = safe(t, 500);
                push(rec);
            }).catch(() => {
                rec.resBody = '(unreadable)';
                push(rec);
            });
            return res;
        }).catch(err => {
            rec.error = String(err);
            push(rec);
            throw err;
        });
    };

    function PatchedXHR() {
        const xhr = new OrigXHR();
        let method = 'GET', url = '', reqBody = '';
        const origOpen = xhr.open;
        xhr.open = function (m, u, ...rest) {
            method = (m || 'GET').toUpperCase();
            url = u || '';
            return origOpen.apply(xhr, [m, u, ...rest]);
        };
        const origSend = xhr.send;
        xhr.send = function (body) {
            try { if (body) reqBody = typeof body === 'string' ? body : safe(body, 300); } catch (e) { }
            return origSend.apply(xhr, [body]);
        };
        xhr.addEventListener('loadend', () => {
            const rec = { source: 'xhr', method, url, reqBody, status: xhr.status };
            try {
                if (xhr.responseType === '' || xhr.responseType === 'text') rec.resBody = safe(xhr.responseText, 500);
                else if (xhr.responseType === 'json') rec.resBody = safe(xhr.response, 500);
                else rec.resBody = '(' + (xhr.responseType || 'binary') + ')';
            } catch (e) {
                rec.resBody = '(read fail: ' + e.message + ')';
            }
            push(rec);
        });
        return xhr;
    }
    PatchedXHR.prototype = OrigXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;

    const dumpFromPerf = () => {
        try {
            const entries = performance.getEntriesByType('resource')
                .filter(e => ['xmlhttprequest', 'fetch'].includes(e.initiatorType));
            const seen = new Set(records.map(r => r.url));
            let n = 0;
            for (const e of entries) {
                if (seen.has(e.name) || skipUrl(e.name)) continue;
                records.push({
                    id: records.length + 1,
                    time: '(performance)',
                    source: 'performance',
                    method: '?',
                    url: e.name,
                    duration: Math.round(e.duration),
                });
                n++;
            }
            return n;
        } catch (e) { return 0; }
    };

    const api = {
        records,
        stop() {
            window.fetch = origFetch;
            window.XMLHttpRequest = OrigXHR;
            console.log('已停止拦截');
        },
        clear() { records.length = 0; console.log('已清空'); },
        dump(filter) {
            const list = filter
                ? records.filter(r => (r.url + (r.reqBody || '')).includes(filter))
                : records;
            console.log('共', list.length, '条');
            list.forEach(r => {
                console.log('#' + r.id, r.time, r.method, r.url, r.status ? '→' + r.status : '');
                if (r.reqBody) console.log('   req:', safe(r.reqBody, 250));
                if (r.resBody) console.log('   res:', safe(r.resBody, 250));
            });
            return list;
        },
        relevant() {
            return records.filter(r =>
                /quiz|exam|test|work|job|answer|question|video|progress|study|log|score|submit|save|chapter|knowledge|mooc|ans|visit|multimedia|fystat/i.test(r.url)
            );
        },
        /** 自动下载全部记录 */
        save() {
            const n = dumpFromPerf();
            if (n) console.log('补录 performance', n, '条');
            const header =
                `=== 课舟网络捕获 ===\n` +
                `page: ${location.href}\n` +
                `title: ${document.title}\n` +
                `time: ${new Date().toISOString()}\n` +
                `count: ${records.length}\n\n`;
            const body = records.map(r => {
                let s = `#${r.id} [${r.time}] ${r.method} ${r.url}`;
                if (r.status) s += ` → ${r.status}`;
                if (r.duration) s += ` (${r.duration}ms)`;
                if (r.reqBody) s += `\n   req: ${safe(r.reqBody, 400)}`;
                if (r.resBody) s += `\n   res: ${safe(r.resBody, 400)}`;
                if (r.error) s += `\n   error: ${r.error}`;
                return s;
            }).join('\n\n');

            const filename = `kezhou-net-${Date.now().toString(36)}.txt`;
            const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
            console.log('%c✅ 已下载: ' + filename, 'color:#287047;font-weight:bold');
            return filename;
        },
    };

    window.__KEZHOU_NET__ = api;

    console.log('%c=== 课舟·网络拦截已启动 ===', 'color:#2166ad;font-size:14px;font-weight:bold');
    console.log('请操作页面：播放视频 / 打开章节测验 / 点选项 / 点「暂时保存」');
    console.log('然后输入 __KEZHOU_NET__.save() 下载结果');
})();
