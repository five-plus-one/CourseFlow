// ========== DOM 截图（SVG foreignObject → canvas → PNG） ==========
// 关键：把 @font-face（含 data URL 的 font-cxsecret）一并嵌入，
// 这样截图里渲染出的是「视觉正确」的字形，视觉 AI 才能读对。

const Capture = {
    /** 采集元素及其样式（只取 @font-face + 命中 class 的规则，控制体积） */
    _collectCSS(doc, clone) {
        let fontCss = '';
        let ruleCss = '';
        const classes = new Set();
        try {
            clone.querySelectorAll('*').forEach(n => {
                if (n.className && typeof n.className === 'string') {
                    n.className.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
                }
                if (n.id) classes.add(n.id);
            });
            if (clone.className && typeof clone.className === 'string') {
                clone.className.split(/\s+/).filter(Boolean).forEach(c => classes.add(c));
            }
        } catch (e) { }

        try {
            for (const sheet of doc.styleSheets) {
                let rules;
                try { rules = sheet.cssRules; } catch (e) { continue; }
                for (const rule of rules) {
                    const t = rule.cssText || '';
                    if (!t) continue;
                    if (t.includes('@font-face')) {
                        fontCss += t + '\n';
                        continue;
                    }
                    // 只保留命中元素 class/id 的规则，避免整页 CSS 撑爆 data URL
                    const sel = rule.selectorText || '';
                    if (sel && [...classes].some(c => sel.includes('.' + c) || sel.includes('#' + c))) {
                        ruleCss += t + '\n';
                    }
                }
            }
        } catch (e) { }

        // 基础排版兜底
        const base = `
            .kz-capture-root { background:#fff; color:#172033; font-size:15px; line-height:1.7;
                font-family:"Microsoft YaHei","PingFang SC",sans-serif; padding:16px 18px; box-sizing:border-box; }
            .kz-capture-root img { max-width:100%; }
        `;
        return fontCss + ruleCss + base;
    },

    /** 解除克隆体的高度/溢出裁剪约束，让完整内容能被渲染出来 */
    _releaseClipping(el) {
        try {
            el.style.height = 'auto';
            el.style.minHeight = '0';
            el.style.maxHeight = 'none';
            el.style.overflow = 'visible';
        } catch (e) { }
        for (const child of Array.from(el.children || [])) this._releaseClipping(child);
    },

    /**
     * 元素 → PNG dataURL
     * 用离屏克隆实测完整尺寸（getBoundingClientRect 会被滚动容器/视口裁剪）
     */
    async elementToDataUrl(el, scale = 2) {
        const doc = el.ownerDocument || document;
        const rect = el.getBoundingClientRect();
        const w = Math.max(80, Math.ceil(rect.width));

        const clone = el.cloneNode(true);
        const css = this._collectCSS(doc, clone);

        // 离屏测量完整尺寸（含折叠/溢出内容）
        const measure = doc.createElement('div');
        measure.style.cssText = 'position:absolute;left:-99999px;top:0;width:' + w + 'px;';
        const mRoot = doc.createElement('div');
        mRoot.setAttribute('class', 'kz-capture-root');
        mRoot.style.width = w + 'px';
        const mStyle = doc.createElement('style');
        mStyle.textContent = css;
        mRoot.appendChild(mStyle);
        const mClone = clone.cloneNode(true);
        this._releaseClipping(mClone);          // ← 解除裁剪再测量
        mRoot.appendChild(mClone);
        measure.appendChild(mRoot);
        (doc.body || doc.documentElement).appendChild(measure);

        let fullH = Math.ceil(rect.height);
        try {
            fullH = Math.max(
                fullH,
                mRoot.scrollHeight || 0,
                Math.ceil(mRoot.getBoundingClientRect().height) || 0,
                Math.ceil(mClone.scrollHeight) || 0,
                Math.ceil(mClone.getBoundingClientRect().height) || 0
            );
        } catch (e) { }
        // 安全余量：字体换行差异/边框舍入，宁多勿少（多出来是白边，少一行选项就废了）
        fullH = Math.ceil(fullH * 1.12) + 32;
        measure.remove();

        // 最终渲染：解除克隆体裁剪约束 + 用完整高度
        this._releaseClipping(clone);
        const root = doc.createElement('div');
        root.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        root.setAttribute('class', 'kz-capture-root');
        root.style.width = w + 'px';
        root.style.minHeight = fullH + 'px';
        root.style.height = 'auto';

        const styleEl = doc.createElement('style');
        styleEl.textContent = css;
        root.appendChild(styleEl);
        root.appendChild(clone);

        const xml = new XMLSerializer().serializeToString(root);
        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${fullH * scale}">` +
            `<rect width="100%" height="100%" fill="#ffffff"/>` +
            `<foreignObject width="${w}" height="${fullH}" transform="scale(${scale})">${xml}</foreignObject>` +
            `</svg>`;

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = doc.createElement('canvas');
                    canvas.width = w * scale;
                    canvas.height = fullH * scale;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (e) {
                    reject(new Error('canvas 绘制失败: ' + e.message));
                }
            };
            img.onerror = () => reject(new Error('SVG 渲染失败'));
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        });
    },

    /** 截取整块题目区域 */
    async captureQuizRoot(root) {
        try {
            return await this.elementToDataUrl(root, 2);
        } catch (e) {
            if (typeof KZLog !== 'undefined') KZLog.add('截图失败: ' + e.message, 'e');
            return null;
        }
    },
};
