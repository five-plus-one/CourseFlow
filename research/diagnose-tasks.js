// ============================================
// 课舟 · 多任务点诊断脚本 (v1 · 自动下载)
// 用途：一页多个任务点（视频/作业/文档等混排）时，
//       抓每个任务点的容器、图标、jobid、iframe、完成态挂载位置。
// 用法：F12 → Console → 粘贴全部 → 回车 → 自动下载
//       kezhou-tasks-<时间戳>.txt，把这个文件发回即可
// 建议：
//   1) 尽量找一页「有未完成作业任务点」的页面跑一次
//   2) 再找一页「有未完成视频 + 未完成作业」的跑一次
//   3) 若一直弹 debugger：先看文件 research/DEBUGGER.md
// ============================================

(() => {
    'use strict';
    const out = [];
    const log = (...args) => {
        out.push(args.map(a => {
            if (a === null || a === undefined) return String(a);
            if (typeof a === 'object') {
                try { return JSON.stringify(a, null, 2); } catch (e) { return String(a); }
            }
            return String(a);
        }).join(' '));
    };
    const section = (t) => log('\n========== ' + t + ' ==========');

    const classList = (el) => {
        if (!el || !el.className || typeof el.className !== 'string') return [];
        return el.className.trim().split(/\s+/).filter(Boolean);
    };

    const brief = (el, max = 140) => {
        if (!el) return 'null';
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        const cls = classList(el);
        if (cls.length) s += '.' + cls.slice(0, 8).join('.');
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (t) s += ' 「' + t + '」';
        return s.slice(0, max);
    };

    const selPath = (el) => {
        if (!el || el.nodeType !== 1) return '';
        const parts = [];
        let cur = el, depth = 0;
        while (cur && cur.nodeType === 1 && depth < 10) {
            let part = cur.tagName.toLowerCase();
            if (cur.id) { parts.unshift(part + '#' + cur.id); break; }
            const cls = classList(cur).slice(0, 3).join('.');
            if (cls) part += '.' + cls;
            const parent = cur.parentElement;
            if (parent) {
                const sibs = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
                if (sibs.length > 1) part += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
            }
            parts.unshift(part);
            cur = cur.parentElement;
            depth++;
        }
        return parts.join(' > ');
    };

    // 收集主文档 + 同源 iframe 文档
    const collectDocs = (rootDoc) => {
        const list = [{ doc: rootDoc, label: 'main' }];
        const walk = (doc, label, depth) => {
            if (depth > 5) return;
            let frames = [];
            try { frames = Array.from(doc.querySelectorAll('iframe')); } catch (e) { return; }
            frames.forEach((f, i) => {
                let d = null;
                try { d = f.contentDocument || (f.contentWindow && f.contentWindow.document); } catch (e) { d = null; }
                const l = label + '>iframe[' + i + ']';
                if (d) {
                    list.push({ doc: d, label: l, frame: f });
                    walk(d, l, depth + 1);
                } else {
                    list.push({ doc: null, label: l + '(跨域)', frame: f });
                }
            });
        };
        walk(rootDoc, 'main', 0);
        return list;
    };

    log('=== 课舟多任务点诊断 v1 ===');
    log('时间:', new Date().toISOString());
    log('URL:', location.href);
    log('title:', document.title);

    const docs = collectDocs(document);
    section('0. 文档树');
    docs.forEach(d => {
        log(` ${d.label}: ${d.doc ? '可访问' : '跨域/不可访问'}`);
        if (d.frame) log(`    frame src=${(d.frame.src || '(none)').slice(0, 160)}`);
    });

    // ---- 1. 任务点容器枚举 ----
    section('1. 任务点容器 (.ans-attach-ct) 枚举');
    const containers = [];
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        let els = [];
        try { els = Array.from(doc.querySelectorAll('.ans-attach-ct')); } catch (e) { }
        els.forEach((el, i) => containers.push({ el, doc, label, idx: i }));
    });
    log('找到 .ans-attach-ct 数量:', containers.length);

    containers.forEach(({ el, label }, i) => {
        log(`\n--- 容器[${i}] @ ${label} ---`);
        log('  brief:', brief(el, 200));
        log('  class:', classList(el));
        log('  id:', el.id || '(无)');
        log('  sel:', selPath(el));
        // 父链
        let p = el.parentElement, chain = [];
        for (let d = 0; d < 4 && p; d++) { chain.push(brief(p, 80)); p = p.parentElement; }
        log('  父链:', chain.join(' < '));
        // 完成态相关 class 信号
        const cls = classList(el);
        log('  完成态信号:', {
            'ans-job-finished': cls.includes('ans-job-finished'),
            'ans-job-icon-clear': cls.includes('ans-job-icon-clear'),
            'videoContainer': cls.includes('videoContainer'),
            'ans-job-video': cls.includes('ans-job-video'),
            'ans-job-work': cls.includes('ans-job-work'),
            '其他 job 相关 class': cls.filter(c => /job|finish|clear|done|complete/i.test(c) && !['ans-job-finished', 'ans-job-icon-clear', 'ans-job-video', 'ans-job-work'].includes(c)),
        });

        // 图标
        let icons = [];
        try { icons = Array.from(el.querySelectorAll('.ans-job-icon, [class*="job-icon"], [class*="jobicon"]')); } catch (e) { }
        log('  图标数量:', icons.length);
        icons.forEach((ic, j) => {
            log(`    icon[${j}]:`, brief(ic, 160));
            log('      class:', classList(ic));
            log('      aria-label:', ic.getAttribute('aria-label'));
            log('      title:', ic.getAttribute('title'));
            log('      role:', ic.getAttribute('role'));
            log('      sel:', selPath(ic));
            // 图标内子元素
            const kids = Array.from(ic.children).slice(0, 5);
            kids.forEach((k, kidx) => log(`      kid[${kidx}]:`, brief(k, 100), 'class=', classList(k)));
        });

        // iframe
        let frames = [];
        try { frames = Array.from(el.querySelectorAll('iframe')); } catch (e) { }
        log('  iframe 数量:', frames.length);
        frames.forEach((f, j) => {
            log(`    iframe[${j}]: src=${(f.src || '(none)').slice(0, 200)}`);
            log('      class:', classList(f));
            log('      jobid attr:', f.getAttribute('jobid'));
            log('      objectid attr:', f.getAttribute('objectid'));
            log('      mid attr:', f.getAttribute('mid'));
            log('      _src attr:', (f.getAttribute('_src') || '(无)').slice(0, 200));
            log('      name:', f.name || '(无)', 'size:', f.clientWidth + 'x' + f.clientHeight);
            // data 属性（video/work 的元数据 JSON）
            const dataAttr = f.getAttribute('data');
            if (dataAttr) {
                try {
                    const meta = JSON.parse(dataAttr.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
                    log('      data(JSON):', meta);
                } catch (e) {
                    log('      data(raw):', dataAttr.slice(0, 300));
                }
            }
            // 从 src 提取 jobid / workid
            try {
                const u = new URL(f.src, location.origin);
                const q = Object.fromEntries(u.searchParams);
                log('      src path:', u.pathname);
                log('      src query:', q);
            } catch (e) { }
            // iframe 内部可访问性
            try {
                const d = f.contentDocument || (f.contentWindow && f.contentWindow.document);
                if (d) {
                    log('      内部: video=', d.querySelectorAll('video').length,
                        '题目=', d.querySelectorAll('div.singleQuesId, #ZyBottom, [class*="question"]').length,
                        'input=', d.querySelectorAll('input').length,
                        'bodyClass=', (d.body && d.body.className) || '');
                } else {
                    log('      内部: (跨域)');
                }
            } catch (e) { log('      内部: (跨域)'); }
        });

        // 容器内其他值得注意的元素
        let topics = [];
        try { topics = Array.from(el.querySelectorAll('#topicList, #topicContent, [class*="topic"]')); } catch (e) { }
        if (topics.length) log('  topic 元素:', topics.map(t => brief(t, 80)));

        // 文本采样
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 150);
        if (txt) log('  text:', txt);
    });

    // ---- 2. 所有 ans-job* class 元素 ----
    section('2. 全部 [class*="ans-job"] 元素');
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        let els = [];
        try { els = Array.from(doc.querySelectorAll('[class*="ans-job"]')); } catch (e) { }
        if (!els.length) return;
        log(`【${label}】${els.length} 个:`);
        els.forEach((el, i) => {
            log(`  [${i}]`, brief(el, 140));
            log('      class:', classList(el));
            log('      aria-label:', el.getAttribute('aria-label'));
            log('      sel:', selPath(el));
        });
    });

    // ---- 3. 图标 aria-label 全量（完成/未完成判定金标准候选）----
    section('3. 任务点图标 aria-label 采样');
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        let els = [];
        try { els = Array.from(doc.querySelectorAll('.ans-job-icon, [class*="job-icon"]')); } catch (e) { }
        if (!els.length) return;
        log(`【${label}】${els.length} 个图标:`);
        els.forEach((el, i) => {
            log(`  [${i}] aria="${el.getAttribute('aria-label')}" class=[${classList(el).join(' ')}]`);
        });
    });

    // ---- 4. Tab 结构（旧版两 Tab 页）----
    section('4. Tab 结构 (#dct1/#dct2 等)');
    ['#dct1', '#dct2', '.tab', '[class*="tab"]'].forEach(sel => {
        try {
            const els = Array.from(document.querySelectorAll(sel));
            if (els.length && els.length < 20) {
                log(`  ${sel}: ${els.length}`);
                els.forEach(el => {
                    const cls = classList(el);
                    log('    ', brief(el, 120),
                        'active=', cls.includes('active') || cls.includes('current'),
                        'sel=', selPath(el));
                });
            }
        } catch (e) { }
    });

    // ---- 5. 视频元素（scoped 到容器）----
    section('5. video 元素（按所在容器归组）');
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        let vids = [];
        try { vids = Array.from(doc.querySelectorAll('video')); } catch (e) { }
        if (!vids.length) return;
        log(`【${label}】video 数量: ${vids.length}`);
        vids.forEach((v, i) => {
            // 找所属任务点容器
            let host = null, p = v.parentElement;
            for (let d = 0; d < 8 && p; d++) {
                if (classList(p).includes('ans-attach-ct')) { host = p; break; }
                p = p.parentElement;
            }
            log(`  video[${i}]: src=${(v.src || v.currentSrc || '(空)').slice(0, 120)}`);
            log('      duration=', v.duration, 'currentTime=', v.currentTime, 'paused=', v.paused,
                'playbackRate=', v.playbackRate, 'ended=', v.ended);
            log('      所属容器:', host ? brief(host, 120) : '(未找到 ans-attach-ct 祖先)');
        });
    });

    // ---- 6. 题目/作业（scoped 到容器）----
    section('6. 题目/作业 DOM（按所在容器归组）');
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        let qs = [];
        try { qs = Array.from(doc.querySelectorAll('div.singleQuesId, #ZyBottom, div[id^="question"], [class*="work"]')); } catch (e) { }
        if (!qs.length) return;
        log(`【${label}】${qs.length} 个题目相关元素`);
        qs.slice(0, 10).forEach((q, i) => {
            let host = null, p = q.parentElement;
            for (let d = 0; d < 8 && p; d++) {
                if (classList(p).includes('ans-attach-ct')) { host = p; break; }
                p = p.parentElement;
            }
            log(`  [${i}]`, brief(q, 120));
            log('      所属容器:', host ? brief(host, 120) : '(无)');
        });
    });

    // ---- 7. 完成态 class 对照表 ----
    section('7. 完成/未完成 class 对照（金标准）');
    const finishTokens = ['ans-job-finished', 'ans-job-icon-finished', 'ans-job-icon-clear',
        'finished', 'clear', 'done', 'ans-job-done', 'ans-job-complete'];
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        finishTokens.forEach(tok => {
            let n = 0;
            try { n = doc.querySelectorAll('.' + tok).length; } catch (e) { }
            if (n > 0) log(`  【${label}】 .${tok}: ${n}`);
        });
    });

    // ---- 8. 全局变量/隐藏字段 ----
    section('8. 隐藏字段 / 全局变量');
    ['courseId', 'knowledgeId', 'cpi', 'cardId', 'isDigitalTextbook'].forEach(id => {
        const el = document.getElementById(id);
        if (el) log(`  #${id} =`, el.value);
    });
    ['mArg', 'jobList', 'ansJobCard', 'jobindex', 'mid'].forEach(k => {
        try {
            if (typeof window[k] !== 'undefined') {
                const v = window[k];
                log(`  window.${k}:`, (typeof v === 'object' && v !== null) ? JSON.stringify(v).slice(0, 300) : String(v).slice(0, 200));
            }
        } catch (e) { }
    });

    // ---- 9. HTML 骨架（只抓任务点相关子树）----
    section('9. 任务点区域 HTML 骨架 (depth<=7)');
    function skeleton(el, depth) {
        if (!el || depth > 7) return '';
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) return '';
        let s = '  '.repeat(depth) + '<' + el.tagName.toLowerCase();
        if (el.id) s += ' id="' + el.id + '"';
        const cls = classList(el);
        if (cls.length) s += ' class="' + cls.join(' ').slice(0, 100) + '"';
        if (el.tagName === 'IFRAME') s += ' src="' + (el.src || '').slice(0, 120) + '"';
        if (el.tagName === 'A') s += ' href="' + (el.href || '').slice(0, 100) + '"';
        ['jobid', 'objectid', 'mid', 'sequence-id', 'data-pid', 'aria-label'].forEach(a => {
            const v = el.getAttribute && el.getAttribute(a);
            if (v) s += ' ' + a + '="' + v.slice(0, 60) + '"';
        });
        s += '>';
        const onlyText = el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3;
        if (onlyText) s += el.firstChild.textContent.trim().slice(0, 40);
        s += '\n';
        for (const c of el.children) s += skeleton(c, depth + 1);
        return s;
    }
    const pageDiv = document.getElementById('pageDiv') || document.querySelector('.ans-cc');
    if (pageDiv) {
        log('来源: #pageDiv / .ans-cc');
        log(skeleton(pageDiv, 0).slice(0, 12000));
    } else {
        log('未找到 #pageDiv/.ans-cc，抓 body 顶层含 job 的子树:');
        let targets = [];
        try { targets = Array.from(document.querySelectorAll('.ans-attach-ct, [class*="ans-job"]')); } catch (e) { }
        const seen = new Set();
        targets.slice(0, 6).forEach(t => {
            let root = t;
            for (let d = 0; d < 4 && root.parentElement; d++) root = root.parentElement;
            if (seen.has(root)) return;
            seen.add(root);
            log(skeleton(root, 0).slice(0, 4000));
        });
    }

    section('诊断完成');
    log('=== 课舟多任务点诊断结束 ===');

    // ---- 自动下载 ----
    const filename = `kezhou-tasks-${Date.now().toString(36)}.txt`;
    const fullText = out.join('\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 2000);

    console.log('%c✅ 多任务点诊断完成，已自动下载: ' + filename, 'color:#287047;font-size:14px;font-weight:bold');
    console.log('把下载的 txt 文件发回即可。');

    window.__KEZHOU_TASKS_DIAG__ = { url: location.href, filename, ts: Date.now() };
})();
