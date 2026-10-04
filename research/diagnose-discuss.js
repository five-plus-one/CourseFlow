// ============================================
// 课舟 · 讨论区诊断脚本 (v1 · 自动下载)
// 用途：抓学习通讨论区 DOM，供自动发帖/点赞功能用。
// 用法：
//   1. 打开课程的「讨论」页面（能看到讨论区、发帖按钮的页面）
//   2. F12 → Console → 粘贴全部 → 回车
//   3. 自动下载 kezhou-discuss-<时间戳>.txt，发回即可
// 建议：
//   - 在「讨论」Tab 激活的状态下跑
//   - 如果讨论区有两种页面（列表页 + 发帖页），两种都跑一次
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

    const collectDocs = (rootDoc) => {
        const list = [{ doc: rootDoc, label: 'main' }];
        const walk = (doc, label, depth) => {
            if (depth > 4) return;
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

    log('=== 课舟讨论区诊断 v1 ===');
    log('时间:', new Date().toISOString());
    log('URL:', location.href);
    log('title:', document.title);

    const docs = collectDocs(document);
    section('0. 文档树');
    docs.forEach(d => {
        log(` ${d.label}: ${d.doc ? '可访问' : '跨域'}`);
        if (d.frame) log(`    src=${(d.frame.src || '(none)').slice(0, 140)}`);
    });

    // ---- 1. 讨论相关元素全扫 ----
    section('1. 讨论相关元素');
    const discussSels = [
        '[class*="discuss"]', '[class*="Discuss"]', '[id*="discuss"]', '[id*="Discuss"]',
        '[class*="topic"]', '[class*="Topic"]', '[id*="topic"]',
        '[class*="bbs"]', '[class*="BBS"]', '[id*="bbs"]',
        '[class*="reply"]', '[class*="Reply"]',
        '[class*="post"]', '[class*="Post"]',
        '[class*="like"]', '[class*="Like"]', '[class*="zan"]', '[class*="Zan"]',
        '[class*="praise"]', '[class*="Praise"]',
    ];
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        discussSels.forEach(sel => {
            try {
                const els = Array.from(doc.querySelectorAll(sel));
                if (els.length > 0 && els.length < 30) {
                    log(`  【${label}】✓ ${sel}: ${els.length}`);
                    els.slice(0, 6).forEach(el => log('    ', brief(el, 120), '|', selPath(el)));
                } else if (els.length >= 30) {
                    log(`  【${label}】~ ${sel}: ${els.length} (过多)`);
                }
            } catch (e) { }
        });
    });

    // ---- 2. 按钮/链接（发帖/回复/点赞等）----
    section('2. 按钮 / 链接（含关键词）');
    const kw = ['发表', '发帖', '发讨论', '新帖', '回复', '回帖', '评论', '点赞', '赞', '关注', '收藏',
        '发布', '提交', '发送', '新建', '讨论', '话题', '求助', '投票'];
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        const btns = Array.from(doc.querySelectorAll(
            'button, a, input[type=button], input[type=submit], [role="button"], [class*="btn"], [class*="Btn"]'
        ));
        const hits = btns.filter(b => {
            const t = ((b.textContent || b.value || b.title || '')).trim();
            return t && kw.some(k => t.includes(k));
        });
        if (hits.length) {
            log(`  【${label}】${hits.length} 个命中:`);
            hits.slice(0, 15).forEach(b => {
                const t = ((b.textContent || b.value || b.title || '')).trim().slice(0, 30);
                log(`    [${t}]`, brief(b, 100), '|', selPath(b), '| visible=', b.offsetParent !== null);
            });
        }
    });

    // ---- 3. 输入框（标题/内容编辑区）----
    section('3. 输入框 / 编辑区');
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        const inputs = Array.from(doc.querySelectorAll(
            'input[type=text], input[type=tel], textarea, [contenteditable="true"], [contenteditable=""], .edui-container, [class*="editor"], [class*="Editor"]'
        ));
        if (!inputs.length) return;
        log(`  【${label}】${inputs.length} 个输入元素:`);
        inputs.slice(0, 12).forEach(el => {
            log(`    ${brief(el, 120)}`);
            log(`      tag=${el.tagName} type=${el.type || '-'} placeholder="${(el.placeholder || el.getAttribute('data-placeholder') || '').slice(0, 40)}"`);
            log(`      name=${el.name || '-'} id=${el.id || '-'} visible=${el.offsetParent !== null}`);
            log(`      sel=${selPath(el)}`);
        });
    });

    // ---- 4. 已有帖子列表（了解讨论帖结构）----
    section('4. 讨论帖子列表');
    const postSels = [
        '[class*="topic-item"]', '[class*="topicItem"]', '[class*="discuss-item"]',
        '[class*="post-item"]', '[class*="reply-item"]', '[class*="replyItem"]',
        '[class*="bbs-item"]', '[class*="list-item"]',
        'li[class*="item"]', 'div[class*="item"]',
    ];
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        postSels.forEach(sel => {
            try {
                const els = Array.from(doc.querySelectorAll(sel));
                if (els.length >= 1 && els.length <= 20) {
                    log(`  【${label}】✓ ${sel}: ${els.length}`);
                    els.slice(0, 5).forEach((el, i) => {
                        log(`    [${i}]`, brief(el, 160));
                        const title = el.querySelector('h1,h2,h3,h4,h5,a,[class*="title"],[class*="Title"]');
                        if (title) log(`      title: ${brief(title, 100)}`);
                        const like = el.querySelector('[class*="like"],[class*="Like"],[class*="zan"],[class*="Zan"],[class*="praise"]');
                        if (like) log(`      like: ${brief(like, 80)}`);
                    });
                }
            } catch (e) { }
        });
    });

    // ---- 5. Tab / 导航（讨论区入口）----
    section('5. Tab / 导航入口');
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        const tabs = Array.from(doc.querySelectorAll('[class*="tab"], [role="tab"], [class*="nav"], .tab'));
        const hits = tabs.filter(t => /讨论|话题|求助|问答/.test(t.textContent || ''));
        if (hits.length) {
            log(`  【${label}】讨论相关 Tab:`);
            hits.slice(0, 8).forEach(t => {
                log(`    [${(t.textContent || '').trim().slice(0, 20)}]`, brief(t, 100), '| active=', classList(t).includes('active'), '|', selPath(t));
            });
        }
    });

    // ---- 6. 弹窗/表单（发帖弹窗）----
    section('6. 弹窗 / 发帖表单');
    docs.forEach(({ doc, label }) => {
        if (!doc) return;
        const pops = Array.from(doc.querySelectorAll(
            '[class*="dialog"]', '[class*="Dialog"]', '[class*="modal"]', '[class*="Modal"]',
            '[class*="pop"]', '[class*="Pop"]', '[class*="layer"]', '[class*="Layer"]',
            '[class*="mask"]', '[class*="Mask"]'
        )).filter(el => el.offsetParent !== null || getComputedStyle(el).display !== 'none');
        if (pops.length) {
            log(`  【${label}】${pops.length} 个可见弹层:`);
            pops.slice(0, 6).forEach(el => log(`    ${brief(el, 120)} | ${selPath(el)}`));
        }
    });

    // ---- 7. iframe 里的讨论内容 ----
    section('7. iframe 内部讨论元素');
    docs.forEach(({ doc, label }) => {
        if (!doc || label === 'main') return;
        try {
            const t = (doc.body ? doc.body.innerText : '').slice(0, 500);
            if (t) log(`  【${label}】文本采样: ${t.replace(/\n+/g, ' | ').slice(0, 300)}`);
        } catch (e) { }
    });

    // ---- 8. HTML 骨架（讨论区部分）----
    section('8. body 骨架（depth<=6，10000 字）');
    function skeleton(el, depth) {
        if (!el || depth > 6) return '';
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) return '';
        let s = '  '.repeat(depth) + '<' + el.tagName.toLowerCase();
        if (el.id) s += ' id="' + el.id + '"';
        const cls = classList(el);
        if (cls.length) s += ' class="' + cls.join(' ').slice(0, 80) + '"';
        s += '>';
        const onlyText = el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3;
        if (onlyText) s += el.firstChild.textContent.trim().slice(0, 40);
        s += '\n';
        for (const c of el.children) s += skeleton(c, depth + 1);
        return s;
    }
    log(skeleton(document.body || document.documentElement).slice(0, 10000));

    section('诊断完成');
    log('=== 课舟讨论区诊断结束 ===');

    // ---- 自动下载 ----
    const filename = `kezhou-discuss-${Date.now().toString(36)}.txt`;
    const blob = new Blob([out.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);

    console.log('%c✅ 讨论区诊断完成，已自动下载: ' + filename, 'color:#287047;font-size:14px;font-weight:bold');
    console.log('把下载的 txt 文件发回即可。');
})();
