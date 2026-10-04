// ============================================
// 课舟 · 学习通页面诊断脚本 (v2 · 自动下载)
// 变化：结果自动下载为 txt 文件，不需要在控制台里复制
// 用法：F12 → Console → 粘贴全部 → 回车 → 浏览器会自动下载
//       kezhou-diag-<页面类型>.txt，把这个文件发回即可
// 若一直弹 debugger：先看文件 research/DEBUGGER.md
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

    const brief = (el, max = 140) => {
        if (!el) return 'null';
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            s += '.' + el.className.trim().split(/\s+/).slice(0, 5).join('.');
        }
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
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
            if (cur.className && typeof cur.className === 'string') {
                const cls = cur.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
                if (cls) part += '.' + cls;
            }
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

    log('=== 课舟诊断开始 v2 ===');
    log('时间:', new Date().toISOString());

    // ---- 1. 基本信息 ----
    section('1. 基本信息');
    const loc = window.location;
    log('URL:', loc.href);
    log('hostname:', loc.hostname);
    log('pathname:', loc.pathname);
    log('search:', loc.search);
    log('title:', document.title);
    const params = Object.fromEntries(new URLSearchParams(loc.search));
    log('URL 参数:', params);

    let pageType = 'unknown';
    if (/\/mycourse\/studentstudy/.test(loc.pathname)) pageType = 'studentstudy';
    else if (/fanyav3\/stu/.test(loc.pathname)) pageType = 'fanyav3-chapter-list';
    else if (/mooc2-ans.*\/mycourse\/stu/.test(loc.pathname)) pageType = 'mooc2-chapter-list';
    else if (/\/base/.test(loc.pathname)) pageType = 'i-base';
    else if (/\/mycourse\//.test(loc.pathname)) pageType = 'mycourse-other';
    log('页面类型:', pageType);

    // ---- 2. 技术栈 + 全局变量 ----
    section('2. 技术栈 / 全局变量');
    log({
        jQuery: typeof window.jQuery !== 'undefined' ? window.jQuery.fn.jquery : '无',
        Vue2: (window.Vue && window.Vue.version) || (document.querySelector('[data-v-]') ? '有data-v-' : '无'),
        Vue3: (document.querySelector('[data-v-app]') || window.__VUE_PROD_DEVTOOLS_GLOBAL_HOOK__) ? '是' : '否',
        React: !!(document.querySelector('[data-reactroot]') || window.__REACT_DEVTOOLS_GLOBAL_HOOK__),
        videojs: typeof window.videojs !== 'undefined' ? (window.videojs.VERSION || '有') : '无',
    });
    const gKeys = ['mArg', 'courseId', 'clazzId', 'clazzid', 'knowledgeId', 'chapterId', 'cpi', 'enc',
        'uid', 'utoken', 'personid', 'userid', 'fid', 'batchCourseId', 'openc', 'mooc2',
        'ansJobCard', 'jobList', 'jobindex', 'mid', 'rt'];
    const foundGlobals = {};
    for (const k of gKeys) {
        try {
            if (typeof window[k] !== 'undefined') {
                const v = window[k];
                foundGlobals[k] = (typeof v === 'object' && v !== null) ? v : String(v).slice(0, 120);
            }
        } catch (e) { }
    }
    log('窗口变量:', foundGlobals);

    // ---- 3. iframe ----
    section('3. iframe 扫描');
    const iframes = Array.from(document.querySelectorAll('iframe'));
    log('iframe 数量:', iframes.length);
    iframes.forEach((f, i) => {
        let inner = '(跨域)';
        try {
            const d = f.contentDocument || f.contentWindow?.document;
            if (d) {
                inner = `可访问 title="${d.title}" video=${d.querySelectorAll('video').length} ` +
                    `input=${d.querySelectorAll('input').length} button=${d.querySelectorAll('button,a.btn,[class*=btn]').length} ` +
                    `bodyClass="${(d.body && d.body.className) || ''}"`;
            }
        } catch (e) { inner = '(跨域)'; }
        log(`[${i}] ${brief(f)}\n    src=${(f.src || '(none)').slice(0, 180)}\n    name=${f.name || '(none)'} size=${f.clientWidth}x${f.clientHeight}\n    ${inner}\n    sel=${selPath(f)}`);
    });

    // ---- 4. 视频 ----
    section('4. 视频 / 播放器');
    function scanVideos(doc, label) {
        const vids = Array.from(doc.querySelectorAll('video'));
        log(`【${label}】video 数量: ${vids.length}`);
        vids.forEach((v, i) => {
            log(`  video[${i}]:`, {
                src: (v.src || v.currentSrc || '(空)').slice(0, 180),
                duration: v.duration,
                currentTime: v.currentTime,
                paused: v.paused,
                playbackRate: v.playbackRate,
                muted: v.muted,
                readyState: v.readyState,
                size: v.videoWidth + 'x' + v.videoHeight,
                sel: selPath(v),
                parent: brief(v.parentElement),
            });
        });
        const sels = ['#video', '#player', '.ans-video', '.ans-video-wrap', '.video-js', '.dplayer',
            '[class*="video"]', '[class*="player"]', '[class*="Video"]', '.prism-player', '.prism-big-play-btn',
            '.ans-job-icon', '.ans-job-item', '[class*="jobicon"]', '[class*="job-icon"]', '[class*="jobItem"]'];
        log(`【${label}】播放器/任务点容器:`);
        sels.forEach(sel => {
            try {
                const els = doc.querySelectorAll(sel);
                if (els.length > 0 && els.length < 40) {
                    log(`  ✓ ${sel}: ${els.length}`);
                    if (els.length <= 6) els.forEach(el => log('     ', brief(el, 100), '|', selPath(el)));
                } else if (els.length >= 40) {
                    log(`  ~ ${sel}: ${els.length} (过多)`);
                }
            } catch (e) { }
        });
        const playBtns = Array.from(doc.querySelectorAll(
            '.vjs-big-play-button, .prism-big-play-btn, [class*="bigplay"], [class*="play-btn"], [class*="playBtn"], [title*="播放"]'));
        log(`【${label}】播放按钮: ${playBtns.length}`);
        playBtns.slice(0, 8).forEach((b, i) => log(`  [${i}]`, brief(b, 100), '|', selPath(b)));
    }
    scanVideos(document, '主文档');
    iframes.forEach((f, i) => {
        try {
            const d = f.contentDocument || f.contentWindow?.document;
            if (d) scanVideos(d, `iframe[${i}]`);
        } catch (e) { }
    });

    // ---- 5. 测验题目 ----
    section('5. 测验 / 题目 DOM');
    const qSels = ['.question', '.timu', '[class*="question"]', '[class*="timu"]', '[class*="topic"]',
        '[class*="stem"]', '[class*="option"]', '[class*="xuanxiang"]', '[class*="answer"]',
        '.mark_question', '[class*="exam"]', '[class*="quiz"]', '[class*="work"]',
        '[class*="danxuan"]', '[class*="duoxuan"]', '[class*="panduan"]', '[class*="fill"]',
        '.singleChoice', '.multiChoice', '.judge', '.blank'];
    log('题目相关选择器:');
    qSels.forEach(sel => {
        try {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) log(`  ${els.length < 50 ? '✓' : '~'} ${sel}: ${els.length}`);
        } catch (e) { }
    });

    // 题干文本块
    log('\n含题型关键词的文本块:');
    const textHits = Array.from(document.querySelectorAll('div, p, li, section'))
        .filter(el => {
            const t = (el.textContent || '').trim();
            return t.length > 8 && t.length < 400 &&
                /判断题|单选题|多选题|填空题|简答题|选择题|【判断】|【单选】|【多选】|【填空】/.test(t);
        })
        .slice(0, 15);
    textHits.forEach((el, i) => log(`  [${i}]`, brief(el, 160), '\n      sel:', selPath(el)));

    // 选项
    const opts = Array.from(document.querySelectorAll(
        'input[type=radio], input[type=checkbox], [class*="option"], [class*="xuanxiang"], label[class*="choice"]'));
    log('\n选项元素数量:', opts.length);
    opts.slice(0, 25).forEach((o, i) => {
        log(`  [${i}]`, brief(o, 110),
            o.name ? 'name=' + o.name : '',
            o.type ? 'type=' + o.type : '',
            'sel=' + selPath(o));
    });

    // 任务点
    section('5b. 任务点状态');
    ['[class*="task"]', '[class*="job"]', '[class*="Job"]', '.ans-job-icon', '.ans-job-item',
        '[class*="完成"]', '[class*="finish"]', '[class*="complete"]', '[class*="知识点"]'].forEach(sel => {
        try {
            const els = document.querySelectorAll(sel);
            if (els.length > 0 && els.length < 50) {
                log(`  ✓ ${sel}: ${els.length}`);
                if (els.length <= 8) els.forEach(el => {
                    const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
                    log('     ', brief(el, 90), t ? 'text=' + t : '');
                });
            }
        } catch (e) { }
    });

    // Tab
    section('5c. Tab 切换 (视频/章节测验)');
    Array.from(document.querySelectorAll('[class*="tab"], [role="tab"], .tab, [class*="switch"]'))
        .filter(el => /视频|测验|任务点/.test(el.textContent || ''))
        .slice(0, 12)
        .forEach((t, i) => log(`  [${i}]`, brief(t, 120), '|', selPath(t)));

    // ---- 6. 按钮 ----
    section('6. 按钮');
    const kw = ['提交', '保存', '暂存', '暂时保存', '确定', '开始', '播放', '下一', '上一', '交卷', '完成', '确认', '继续'];
    const btns = Array.from(document.querySelectorAll('button, input[type=button], input[type=submit], a.btn, [role="button"], .layui-btn'));
    log('按钮总数:', btns.length);
    btns.filter(b => kw.some(k => ((b.textContent || b.value || b.title || '').includes(k))))
        .slice(0, 25)
        .forEach((b, i) => log(`  [${i}]`, brief(b, 130), '| sel=', selPath(b), '| disabled=', !!b.disabled));

    // ---- 7. 章节目录 ----
    section('7. 章节目录/导航');
    ['[class*="catalog"]', '[class*="chapter"]', '[class*="directory"]', '[class*="outline"]',
        '[class*="tree"]', '[class*="sidebar"]', '[class*="side"]', '[class*="menu"]'].forEach(sel => {
        try {
            const els = document.querySelectorAll(sel);
            if (els.length > 0 && els.length < 15) {
                log(`  ✓ ${sel}: ${els.length}`);
                els.forEach(el => {
                    const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
                    if (t) log('     ', brief(el, 90));
                });
            }
        } catch (e) { }
    });

    // ---- 8. 网络线索 ----
    section('8. performance 网络请求');
    try {
        performance.getEntriesByType('resource')
            .filter(e => ['xmlhttprequest', 'fetch', 'other'].includes(e.initiatorType))
            .slice(-40)
            .forEach(e => log(' ', e.initiatorType, e.name.slice(0, 200)));
    } catch (e) { log('performance 不可用', e.message); }

    try {
        log('cookie 名:', document.cookie.split(';').map(c => c.split('=')[0].trim()));
        log('localStorage keys:', Object.keys(localStorage).slice(0, 50));
        log('sessionStorage keys:', Object.keys(sessionStorage).slice(0, 50));
    } catch (e) { }

    // ---- 9. 文本采样 ----
    section('9. 页面文本采样 (2500 字)');
    log((document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2500));

    // ---- 10. HTML 骨架 ----
    section('10. body HTML 骨架 (depth<=6, 12000 字)');
    function skeleton(el, depth = 0) {
        if (!el || depth > 6) return '';
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'].includes(el.tagName)) return '';
        let s = '  '.repeat(depth) + '<' + el.tagName.toLowerCase();
        if (el.id) s += ' id="' + el.id + '"';
        if (el.className && typeof el.className === 'string') s += ' class="' + el.className.trim().slice(0, 90) + '"';
        if (el.tagName === 'IFRAME') s += ' src="' + (el.src || '').slice(0, 120) + '"';
        if (el.tagName === 'VIDEO') s += ' src="' + (el.src || el.currentSrc || '').slice(0, 100) + '"';
        if (el.tagName === 'A') s += ' href="' + (el.href || '').slice(0, 120) + '"';
        if (el.tagName === 'INPUT') s += ' type="' + el.type + '" name="' + (el.name || '') + '"';
        s += '>';
        const onlyText = el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3;
        if (onlyText) s += el.firstChild.textContent.trim().slice(0, 50);
        s += '\n';
        for (const c of el.children) s += skeleton(c, depth + 1);
        return s;
    }
    log(skeleton(document.body || document.documentElement).slice(0, 12000));

    section('诊断完成');
    log('=== 课舟诊断结束 ===');

    // ---- 自动下载 ----
    const typeTag = pageType.replace(/[^\w-]/g, '');
    const filename = `kezhou-diag-${typeTag}-${Date.now().toString(36)}.txt`;
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

    console.log('%c✅ 诊断完成，已自动下载: ' + filename, 'color:#287047;font-size:14px;font-weight:bold');
    console.log('把下载的 txt 文件发回即可。页面类型:', pageType);

    window.__KEZHOU_DIAG__ = { pageType, url: loc.href, filename, ts: Date.now() };
})();
