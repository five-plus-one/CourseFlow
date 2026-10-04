// ========== font-cxsecret 字体反爬解码 v5 ==========
// 系统性方案：同一字在「自定义字体」和「系统字体」下渲染是否相同
//   相同 → 该字未被替换，保留（绝不动常用字）
//   不同 → 该字被替换，用自定义字体的字形去匹配系统字体候选
// 这比任何生僻字区间表都可靠。

const FontDecoder = {
    _atlas: null,          // 系统字体下候选字位图
    _cache: {},
    _realFont: '',
    _sysFont: '"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif',
    _fontLoaded: false,

    _getCandidates() {
        const chars = [];
        for (let i = 33; i <= 126; i++) chars.push(String.fromCharCode(i));
        '，。、；：？！“”‘’（）《》【】—…·　'.split('').forEach(c => chars.push(c));
        for (let i = 0x4E00; i <= 0x9FA5; i++) chars.push(String.fromCharCode(i));
        return chars;
    },

    _resolveFont(el, doc) {
        if (this._realFont) return this._realFont;
        const win = (doc || document).defaultView || window;
        try {
            const cs = win.getComputedStyle(el);
            let ff = cs.fontFamily || '';
            if (!ff || /inherit|initial|unset|^$/.test(ff)) {
                const child = el.querySelector('p, span, a') || el;
                ff = win.getComputedStyle(child).fontFamily || '';
            }
            this._realFont = ff || 'sans-serif';
            if (typeof KZLog !== 'undefined') KZLog.add('字体: computed font-family = ' + this._realFont.slice(0, 100), 'i');
        } catch (e) { this._realFont = 'sans-serif'; }
        return this._realFont;
    },

    async _forceLoadFont(el, doc) {
        if (this._fontLoaded) return true;
        const targetDoc = doc || document;
        const win = targetDoc.defaultView || window;
        const family = this._resolveFont(el, targetDoc);
        const firstFamily = family.split(',')[0].replace(/["']/g, '').trim();

        try {
            if (win.document.fonts && win.document.fonts.load) {
                await win.document.fonts.load('24px ' + firstFamily, '永A列哪项能特点');
                await win.document.fonts.ready;
            }
        } catch (e) { }

        try {
            const faces = [];
            const walk = (rules) => {
                for (const r of rules) {
                    if (r.cssRules) walk(r.cssRules);
                    if (r.type === 5 || (r.cssText && r.cssText.includes('@font-face'))) {
                        const m = (r.cssText || '').match(/font-family:\s*["']?([^"';]+)["']?/);
                        const u = (r.cssText || '').match(/url\(["']?([^"')]+)["']?\)/);
                        if (m && u) faces.push({ family: m[1].trim(), url: u[1] });
                    }
                }
            };
            for (const ss of targetDoc.styleSheets) {
                try { walk(ss.cssRules); } catch (e) { }
            }
            const hit = faces.find(f => /cxsecret|lanting|webfont|secret/i.test(f.family + f.url))
                || faces.find(f => firstFamily && f.family.includes(firstFamily))
                || faces[faces.length - 1];
            if (hit && hit.url) {
                let abs = hit.url;
                try { abs = new URL(hit.url, targetDoc.baseURI).href; } catch (e) { }
                if (typeof KZLog !== 'undefined') KZLog.add('字体: 找到 ' + hit.family + ' → ' + (abs.startsWith('data:') ? 'data:font' : abs.slice(0, 80)), 'i');
                const buf = await new Promise((resolve) => {
                    if (abs.startsWith('data:')) {
                        try {
                            const bin = atob(abs.split(',')[1]);
                            const arr = new Uint8Array(bin.length);
                            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                            resolve(arr.buffer);
                        } catch (e) { resolve(null); }
                    } else if (typeof GM_xmlhttpRequest === 'function') {
                        GM_xmlhttpRequest({ method: 'GET', url: abs, responseType: 'arraybuffer',
                            onload: r => resolve(r.response || null), onerror: () => resolve(null) });
                    } else {
                        fetch(abs).then(r => r.arrayBuffer()).then(resolve).catch(() => resolve(null));
                    }
                });
                if (buf) {
                    try {
                        const face = new win.FontFace('kz-cx-custom', buf);
                        await face.load();
                        win.document.fonts.add(face);
                        this._realFont = '"kz-cx-custom", ' + (this._realFont || 'sans-serif');
                        if (typeof KZLog !== 'undefined') KZLog.add('字体: FontFace 加载成功', 'o');
                    } catch (e) {
                        if (typeof KZLog !== 'undefined') KZLog.add('字体: FontFace 失败 ' + e.message, 'e');
                    }
                }
            }
        } catch (e) {
            if (typeof KZLog !== 'undefined') KZLog.add('字体: 加载异常 ' + e.message, 'e');
        }
        this._fontLoaded = true;
        return true;
    },

    _render(ch, fontFamily, doc, size = 28) {
        const S = 32;
        const targetDoc = doc || document;
        if (!this._cv || this._cvDoc !== targetDoc) {
            this._cv = targetDoc.createElement('canvas');
            this._cvDoc = targetDoc;
        }
        const cv = this._cv;
        cv.width = S; cv.height = S;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, S, S);
        ctx.fillStyle = '#000';
        ctx.font = size + 'px ' + fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, S / 2, S / 2);
        const img = ctx.getImageData(0, 0, S, S).data;
        const raw = new Float32Array(S * S);
        for (let i = 0; i < S * S; i++) raw[i] = img[i * 4 + 3];
        return this._normalize(raw, S);
    },

    _normalize(bmp, S) {
        let minX = S, minY = S, maxX = -1, maxY = -1;
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                if (bmp[y * S + x] > 40) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        const out = new Float32Array(S * S);
        if (maxX < 0) return out;
        const w = maxX - minX + 1, h = maxY - minY + 1;
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                const sx = minX + Math.floor(x * w / S);
                const sy = minY + Math.floor(y * h / S);
                out[y * S + x] = bmp[sy * S + sx] > 128 ? 1 : 0;
            }
        }
        return out;
    },

    _diff(a, b) {
        let s = 0;
        for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
        return s;
    },

    /** 该字是否被字体替换过：自定义字体渲染 vs 系统字体渲染差异大 → 是 */
    _isRemapped(ch, doc) {
        const a = this._render(ch, this._realFont, doc);
        const b = this._render(ch, this._sysFont, doc);
        const d = this._diff(a, b);
        return d > 80;   // 渲染不同 = 被替换
    },

    /** 候选库：用系统字体渲染（我们要找的是「看起来像哪个正常字」） */
    async buildAtlas(doc) {
        if (this._atlas) return this._atlas;
        this._atlas = {};
        const cands = this._getCandidates();
        let n = 0;
        for (const c of cands) {
            this._atlas[c] = this._render(c, this._sysFont, doc);
            n++;
            if (n % 1500 === 0) await new Promise(r => setTimeout(r, 0));
        }
        if (typeof KZLog !== 'undefined') KZLog.add('字体: 候选库 ' + n + ' 字（系统字体）', 'i');
        return this._atlas;
    },

    async decode(text, sampleEl, doc) {
        if (!text) return text;
        const realFont = this._realFont || (sampleEl ? this._resolveFont(sampleEl, doc) : 'sans-serif');
        this._realFont = realFont;
        let out = '';
        let dbg = 0;
        for (const ch of text) {
            if (/\s/.test(ch)) { out += ch; continue; }
            if (this._cache[ch] !== undefined) { out += this._cache[ch]; continue; }

            // 核心判据：该字在两种字体下渲染是否相同
            let remapped = false;
            try {
                remapped = this._isRemapped(ch, doc);
            } catch (e) { }

            if (!remapped) {
                // 未被替换 → 保留
                this._cache[ch] = ch;
                out += ch;
                continue;
            }

            // 被替换 → 用自定义字体字形去匹配系统字体候选
            try {
                if (!this._atlas) await this.buildAtlas(doc);
                const garbledBmp = this._render(ch, realFont, doc);
                let best = ch, bestD = Infinity;
                for (const [cand, bmp] of Object.entries(this._atlas)) {
                    if (cand === ch) continue;
                    const d = this._diff(garbledBmp, bmp);
                    if (d < bestD) { bestD = d; best = cand; }
                }
                this._cache[ch] = bestD < 80 ? best : ch;
                if (dbg < 10) {
                    dbg++;
                    if (typeof KZLog !== 'undefined') {
                        KZLog.add(`解码: "${ch}"(U+${ch.codePointAt(0).toString(16)}) → "${this._cache[ch]}" (d=${bestD})`, bestD < 80 ? 'i' : 'e');
                    }
                }
            } catch (e) {
                this._cache[ch] = ch;
            }
            out += this._cache[ch];
        }
        return out;
    },

    async decodeElement(el, doc) {
        if (!el || el.__kzDecoded) return 0;
        el.__kzDecoded = true;
        doc = doc || el.ownerDocument || document;
        const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        let changed = 0;
        for (const node of nodes) {
            const t = node.nodeValue;
            if (!t || !t.trim()) continue;
            const before = t.trim();
            node.nodeValue = await this.decode(t, el, doc);
            const after = node.nodeValue.trim();
            if (before !== after) {
                changed++;
                if (typeof KZLog !== 'undefined' && changed <= 8) {
                    KZLog.add(`解码结果: "${before.slice(0, 35)}" → "${after.slice(0, 35)}"`, 'i');
                }
            }
        }
        return changed;
    },

    async decodeQuizRoot(root) {
        const doc = root.ownerDocument || document;
        const sample = root.querySelector('.font-cxsecret, .fontLabel') || root;
        await this._forceLoadFont(sample, doc);

        const targets = root.querySelectorAll('.font-cxsecret, .fontLabel');
        let changed = 0;
        for (const t of targets) {
            changed += (await this.decodeElement(t, doc)) || 0;
        }
        if (typeof KZLog !== 'undefined') {
            KZLog.add(`字体解码: ${targets.length} 节点，${changed} 处变化`, changed > 0 ? 'o' : 'e');
        }
        return changed;
    },
};
