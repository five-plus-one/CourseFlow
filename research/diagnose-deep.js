// ============================================
// 课舟 · 学习通深度诊断 v3
// 解决 v2 的两个盲区：
//   1. 题目/视频都在嵌套 iframe 里，v2 没钻进去
//   2. 字体反爬导致复制乱码 — 本脚本直接从 DOM/API 拿原始结构
//
// 用法（视频页 或 测验页 都跑一遍）：
//   F12 → Console → 粘贴全部 → 回车 → 自动下载 kezhou-deep-*.txt
//
// 建议：
//   A. 先打开「2 章节测验」等题目显示出来，跑本脚本
//   B. 再切到「1 视频」等播放器出来，跑本脚本
// ============================================

(() => {
    'use strict';
    const out = [];
    const log = (...a) => out.push(a.map(x => {
        if (x === null || x === undefined) return String(x);
        if (typeof x === 'object') { try { return JSON.stringify(x, null, 2); } catch (e) { return String(x); } }
        return String(x);
    }).join(' '));
    const sec = t => log('\n========== ' + t + ' ==========');

    const brief = (el, max = 160) => {
        if (!el) return 'null';
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 6).join('.');
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
        if (t) s += ' 「' + t + '」';
        return s.slice(0, max);
    };
    const path = (el) => {
        if (!el || el.nodeType !== 1) return '';
        const p = []; let cur = el, d = 0;
        while (cur && cur.nodeType === 1 && d < 10) {
            let s = cur.tagName.toLowerCase();
            if (cur.id) { p.unshift(s + '#' + cur.id); break; }
            if (cur.className && typeof cur.className === 'string') {
                const c = cur.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
                if (c) s += '.' + c;
            }
            const par = cur.parentElement;
            if (par) {
                const sibs = Array.from(par.children).filter(x => x.tagName === cur.tagName);
                if (sibs.length > 1) s += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
            }
            p.unshift(s); cur = cur.parentElement; d++;
        }
        return p.join(' > ');
    };

    // 递归收集所有可访问的 document（含嵌套 iframe）
    function collectDocs(rootDoc, label, depth, acc) {
        acc.push({ doc: rootDoc, label, depth });
        const iframes = Array.from(rootDoc.querySelectorAll('iframe'));
        iframes.forEach((f, i) => {
            const fl = `${label} > iframe[${i}]${f.id ? '#' + f.id : ''}${f.className ? '.' + String(f.className).split(/\s+/)[0] : ''}`;
            try {
                const d = f.contentDocument || f.contentWindow?.document;
                if (d && d.documentElement) {
                    collectDocs(d, fl, depth + 1, acc);
                } else {
                    acc.push({ doc: null, label: fl, depth: depth + 1, crossOrigin: true, src: (f.src || '').slice(0, 200) });
                }
            } catch (e) {
                acc.push({ doc: null, label: fl, depth: depth + 1, crossOrigin: true, src: (f.src || '').slice(0, 200), err: e.message });
            }
        });
    }

    log('=== 课舟深度诊断开始 v3 ===');
    log('时间:', new Date().toISOString());
    log('URL:', location.href);
    log('title:', document.title);

    sec('0. 文档树 / 嵌套 iframe');
    const docs = [];
    collectDocs(document, 'MAIN', 0, docs);
    docs.forEach((e, i) => {
        if (e.doc) {
            log(`[${i}] d=${e.depth} ${e.label}`);
            log(`     title="${e.doc.title}" bodyClass="${e.doc.body?.className || ''}" ` +
                `video=${e.doc.querySelectorAll('video').length} ` +
                `iframe=${e.doc.querySelectorAll('iframe').length} ` +
                `input=${e.doc.querySelectorAll('input').length} ` +
                `textLen=${(e.doc.body?.innerText || '').length}`);
        } else {
            log(`[${i}] d=${e.depth} ${e.label} [跨域/不可访问] src=${e.src || ''} ${e.err || ''}`);
        }
    });

    // ========== 每个可访问文档：视频 ==========
    sec('1. 各层文档中的视频 / 播放器');
    docs.forEach((e, i) => {
        if (!e.doc) return;
        const vids = Array.from(e.doc.querySelectorAll('video'));
        if (vids.length === 0 && !/video|player|attach|job|card/i.test(e.label)) {
            // 即使没有 video，也检查播放器容器
        }
        const containers = e.doc.querySelectorAll(
            '.ans-attach-ct, .videoContainer, .ans-job-icon, .ans-job-video, ' +
            '.ans-insertvideo-online, .ans-attach-online, [class*="player"], [class*="Player"], ' +
            '.prism-player, .video-js, .dplayer, [class*="bigplay"]');
        if (vids.length || containers.length) {
            log(`\n【doc ${i}】${e.label}`);
            vids.forEach((v, j) => {
                log(`  video[${j}]:`, {
                    src: (v.src || v.currentSrc || '(空)').slice(0, 200),
                    duration: v.duration,
                    currentTime: v.currentTime,
                    paused: v.paused,
                    playbackRate: v.playbackRate,
                    readyState: v.readyState,
                    videoWidth: v.videoWidth,
                    sel: path(v),
                });
            });
            containers.forEach((c, j) => {
                log(`  容器[${j}]`, brief(c, 140), '\n     sel=', path(c));
            });
            // 嵌套的视频 iframe src
            e.doc.querySelectorAll('iframe').forEach((f, j) => {
                if (/video|player|ans-insert|ans-attach|multimedia/i.test(f.className + f.src + f.id)) {
                    log(`  视频iframe[${j}] class=${f.className} src=${(f.src || '').slice(0, 220)}`);
                }
            });
        }
    });

    // ========== 每个可访问文档：题目 ==========
    sec('2. 各层文档中的测验题目');
    docs.forEach((e, i) => {
        if (!e.doc) return;
        const doc = e.doc;

        // 题型标题块
        const typeHeads = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,div,p,span,li'))
            .filter(el => {
                const t = (el.textContent || '').trim();
                return t.length < 80 && /^(一|二|三|四|五|六|七|八|九|十|\d+)[\.、．]?\s*(单选题|多选题|判断题|填空题|简答题|论述题|选择题)/.test(t);
            });
        // 题干（含【多选题】等）
        const stems = Array.from(doc.querySelectorAll('div,p,li,td,span'))
            .filter(el => {
                const t = (el.textContent || '').trim();
                return t.length > 5 && t.length < 500 && /【(单选题|多选题|判断题|填空题|简答题|选择题)】/.test(t);
            })
            .filter(el => !Array.from(el.children).some(c => /【(单选题|多选题|判断题)/.test(c.textContent || '')));

        // 选项
        const radios = Array.from(doc.querySelectorAll('input[type=radio], input[type=checkbox]'));
        const optLabels = Array.from(doc.querySelectorAll(
            'label, .answer-item, [class*="option"], [class*="xuanxiang"], [class*="choice"], .chooseOption'));

        if (typeHeads.length || stems.length || radios.length) {
            log(`\n【doc ${i}】${e.label}`);
            log(`  题型标题: ${typeHeads.length}  题干候选: ${stems.length}  radio/checkbox: ${radios.length}`);

            typeHeads.slice(0, 10).forEach((el, j) => {
                log(`  题型[${j}]`, (el.textContent || '').trim(), '|', path(el));
            });

            stems.slice(0, 20).forEach((el, j) => {
                // 用 textContent（字体反爬时可能是乱码，但结构在）
                const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
                log(`  题干[${j}]`, raw.slice(0, 200));
                log(`       sel=`, path(el));
                log(`       html=`, el.outerHTML.slice(0, 300));
            });

            radios.slice(0, 30).forEach((r, j) => {
                // 找旁边的文本
                let label = '';
                if (r.id) {
                    const lab = doc.querySelector(`label[for="${r.id}"]`);
                    if (lab) label = (lab.textContent || '').trim().slice(0, 80);
                }
                if (!label && r.parentElement) label = (r.parentElement.textContent || '').trim().slice(0, 80);
                log(`  选项[${j}] type=${r.type} name=${r.name} value=${r.value} checked=${r.checked} label="${label}"`);
                log(`       sel=`, path(r));
            });

            // 提交/保存按钮
            const btns = Array.from(doc.querySelectorAll('button, input[type=button], input[type=submit], a, div'))
                .filter(b => {
                    const t = ((b.textContent || b.value || '') + (b.className || '')).trim();
                    return /提交|暂时保存|暂存|保存答案|交卷|确定/.test(t) && t.length < 30;
                });
            log(`  提交类按钮: ${btns.length}`);
            btns.slice(0, 10).forEach((b, j) => {
                log(`    btn[${j}]`, brief(b, 120), '| sel=', path(b), '| id=', b.id, '| disabled=', !!b.disabled);
            });
        }
    });

    // ========== 字体反爬线索 ==========
    sec('3. 字体反爬 / 自定义字体');
    docs.forEach((e, i) => {
        if (!e.doc) return;
        const styleSheets = Array.from(e.doc.styleSheets || []);
        styleSheets.forEach((ss, j) => {
            try {
                const rules = ss.cssRules || [];
                for (const r of rules) {
                    if (r.cssText && /@font-face|font-family/i.test(r.cssText) && /font-face/i.test(r.type || r.constructor.name || '')) {
                        log(`【doc ${i}】@font-face:`, r.cssText.slice(0, 300));
                    }
                    if (r.cssText && /url\([^)]+\.(ttf|otf|woff2?|eot)/i.test(r.cssText)) {
                        log(`【doc ${i}】字体URL规则:`, r.cssText.slice(0, 300));
                    }
                }
            } catch (err) {
                // cross-origin stylesheet
            }
        });
        // 页面上的 @font-face style 标签
        e.doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el, j) => {
            const t = el.textContent || el.href || '';
            if (/font-face|\.ttf|\.otf|\.woff|font-family/i.test(t)) {
                log(`【doc ${i}】样式[${j}]`, t.slice(0, 400));
            }
        });
    });

    // 测试：对比 innerText 与 outerHTML 中的字符
    sec('4. 文本乱码采样（对比用户看到 vs 复制结果）');
    docs.forEach((e, i) => {
        if (!e.doc) return;
        const t = (e.doc.body?.innerText || '').replace(/\s+/g, ' ').trim();
        if (t.includes('【') || /单选|多选|判断|填空|题量|满分/.test(t)) {
            log(`【doc ${i}】innerText 采样:`, t.slice(0, 500));
        }
    });

    // ========== 关键 hidden / 全局 ==========
    sec('5. 关键字段与全局变量');
    ['curCourseId', 'curChapterId', 'curCpi', 'curClazzId', 'videoJobId', 'chapterVideoObjectId',
        'videoNoteMid', 'videoRandomCollectTime', 'collectionTime', 'mid', 'tab', 'cardcount',
        'stuMoocClassId', 'stuMoocCourseId', 'stuUserId', 'stuSchoolId', 'chapterId', 'chapterIdid',
        'currentTime', 'uploadEnc', 'uploadUid', 'jumpCount', 'jumpType', 'curcount'].forEach(id => {
        try {
            const el = document.getElementById(id);
            if (el) log(`  #${id} =`, (el.value || el.textContent || '').slice(0, 80));
        } catch (e) { }
    });
    ['courseId', 'clazzid', 'clazzId', 'cpi', 'enc', 'chapterId', 'fid', 'mid', 'openc'].forEach(k => {
        try {
            if (typeof window[k] !== 'undefined') log(`  window.${k} =`, typeof window[k] === 'object' ? window[k] : String(window[k]).slice(0, 80));
        } catch (e) { }
    });

    // ========== 性能网络 ==========
    sec('6. performance 请求（重点 API）');
    try {
        const entries = performance.getEntriesByType('resource')
            .filter(e => ['xmlhttprequest', 'fetch'].includes(e.initiatorType));
        entries.forEach(e => {
            const u = e.name;
            if (/work|job|video|study|log|answer|question|card|knowledge|multimedia|visit|fystat|save|submit|homework/i.test(u)) {
                log(' ', u.slice(0, 250));
            }
        });
    } catch (e) { log('performance 不可用'); }

    // ========== 尝试直接拉测验 HTML（绕过字体反爬） ==========
    sec('7. 直接请求测验接口（可能拿到干净题面）');
    const url = new URL(location.href);
    const courseId = url.searchParams.get('courseId') || document.getElementById('curCourseId')?.value;
    const clazzid = url.searchParams.get('clazzid') || url.searchParams.get('clazzId') || document.getElementById('curClazzId')?.value;
    const cpi = url.searchParams.get('cpi') || document.getElementById('curCpi')?.value;
    const chapterId = url.searchParams.get('chapterId') || document.getElementById('curChapterId')?.value;
    log('参数:', { courseId, clazzid, cpi, chapterId });

    const ajaxUrl = `/mooc-ans/mycourse/studentstudyAjax?courseId=${courseId}&clazzid=${clazzid}&chapterId=${chapterId}&cpi=${cpi}&verificationcode=&mooc2=1&microTopicId=0&editorPreview=0&isPreviewVideo=false`;
    log('尝试:', ajaxUrl);
    fetch(ajaxUrl, { credentials: 'include' })
        .then(r => r.text())
        .then(html => {
            log('studentstudyAjax 响应长度:', html.length);
            // 提取其中的 work / quiz 线索
            const workMatches = html.match(/doHomeWorkNew[^"'<\s]{0,300}/g) || [];
            const quizMatches = html.match(/workId=\d+|workAnswerId=\d+|jobid=[^&"'\s]+/g) || [];
            log('  内含 work 线索:', workMatches.slice(0, 10));
            log('  内含 id 线索:', [...new Set(quizMatches)].slice(0, 20));
            // 保存 HTML 片段样本
            const textSample = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            log('  纯文本样本:', textSample.slice(0, 1500));
            // 再存一份完整 HTML 便于分析
            try {
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'kezhou-studentstudyAjax.html';
                document.body.appendChild(a); a.click();
                setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
                log('  ✅ 已下载 studentstudyAjax 原始 HTML');
            } catch (e) { }

            // 触发最终下载
            finish();
        })
        .catch(err => {
            log('  studentstudyAjax 请求失败:', err);
            finish();
        });

    function finish() {
        sec('深度诊断完成');
        log('=== 课舟深度诊断结束 ===');
        const filename = `kezhou-deep-${Date.now().toString(36)}.txt`;
        const blob = new Blob([out.join('\n')], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        console.log('%c✅ 深度诊断完成，已下载: ' + filename, 'color:#287047;font-size:14px;font-weight:bold');
        window.__KEZHOU_DEEP__ = { filename, ts: Date.now() };
    }
})();
