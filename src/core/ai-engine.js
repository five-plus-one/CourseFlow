// ========== AI 引擎（OpenAI 兼容）v2 ==========
// 加详细日志：请求、响应、解析结果全部留痕

const AIEngine = {
    getConfig() {
        try {
            const c = ProviderManager.getActiveConfig();
            if (c && c.endpoint) return c;
        } catch (e) { }
        return {
            endpoint: SCRIPT_CONFIG.DEFAULT_ENDPOINT,
            apiKey: '',
            model: SCRIPT_CONFIG.DEFAULT_MODEL,
        };
    },

    saveConfig(cfg) {
        const name = ProviderManager.get().active;
        if (cfg.apiKey !== undefined) ProviderManager.setKey(name, cfg.apiKey);
        if (cfg.endpoint !== undefined) ProviderManager.setEndpoint(name, cfg.endpoint);
        if (cfg.model !== undefined) ProviderManager.setActive(name, cfg.model);
    },

    chat(userPrompt, systemPrompt = '你是网课答题助手，直接给出正确答案。') {
        const cfg = this.getConfig();
        if (!cfg.apiKey) {
            KZLog.add('AI: 未配置 API Key', 'e');
            return Promise.resolve({ ok: false, error: '未配置 API Key' });
        }

        KZLog.add(`AI 请求 → ${cfg.model} | prompt=${userPrompt.slice(0, 80)}…`, 'i');

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: cfg.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + cfg.apiKey,
                },
                data: JSON.stringify({
                    model: cfg.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.2,
                }),
                timeout: 90000,
                onload(res) {
                    KZLog.add(`AI HTTP ${res.status}`, res.status === 200 ? 'i' : 'e');
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.error) {
                            KZLog.add(`AI 接口错误: ${JSON.stringify(data.error).slice(0, 200)}`, 'e');
                            resolve({ ok: false, error: data.error.message || JSON.stringify(data.error) });
                            return;
                        }
                        const text = data.choices && data.choices[0] && data.choices[0].message
                            ? (data.choices[0].message.content || '')
                            : '';
                        KZLog.add(`AI 原始响应: ${text.slice(0, 150) || '(空)'} | choices=${data.choices ? data.choices.length : 0}`, text.trim() ? 'o' : 'e');
                        resolve({ ok: !!text.trim(), text: text.trim(), raw: data, error: text.trim() ? '' : '响应内容为空' });
                    } catch (e) {
                        KZLog.add(`AI 解析失败: ${res.responseText.slice(0, 150)}`, 'e');
                        resolve({ ok: false, error: '解析响应失败: ' + res.responseText.slice(0, 150) });
                    }
                },
                onerror(err) {
                    KZLog.add(`AI 网络错误: ${err.error || err.statusText || 'unknown'}`, 'e');
                    resolve({ ok: false, error: '网络错误: ' + (err.error || err.statusText || 'unknown') });
                },
                ontimeout() {
                    KZLog.add('AI 请求超时', 'e');
                    resolve({ ok: false, error: '请求超时' });
                },
            });
        });
    },

    /**
     * 视觉识别 + 答题（截图发给视觉模型）
     * @param {string} imageDataUrl data:image/png;base64,...
     * @returns {Promise<{ok,answer,explain,stem,options,raw}>}
     */
    answerWithVision(imageDataUrl) {
        const cfg = this.getConfig();
        if (!cfg.apiKey) return Promise.resolve({ ok: false, error: '未配置 API Key' });

        const prompt = `这是网课测验的截图。请完成三件事：
1. 完整识别题干和所有选项的文字（截图可能经过字体替换显示为正确字形，请按你看到的正确文字输出）
2. 给出正确答案
3. 给出详细解析

严格按下面的文本格式输出（不要 JSON）：
题目：<识别出的完整题干>
选项：
A. <选项A完整文本>
B. <选项B完整文本>
C. <...>
答案：<答案，单选一个字母如 A；多选如 ABC；判断写 对 或 错>
解析：<详细解析，不限字数>`;

        const url = imageDataUrl.startsWith('data:') ? imageDataUrl : 'data:image/png;base64,' + imageDataUrl;
        KZLog.add(`AI 视觉请求 → ${cfg.model} | 图片 ${Math.round(url.length / 1024)}KB`, 'i');

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: cfg.endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + cfg.apiKey,
                },
                data: JSON.stringify({
                    model: cfg.model,
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'image_url', image_url: { url } },
                            { type: 'text', text: prompt },
                        ],
                    }],
                    temperature: 0.1,
                }),
                timeout: 120000,
                onload(res) {
                    KZLog.add(`AI 视觉 HTTP ${res.status}`, res.status === 200 ? 'i' : 'e');
                    try {
                        const data = JSON.parse(res.responseText);
                        if (data.error) {
                            const msg = data.error.message || JSON.stringify(data.error);
                            KZLog.add(`AI 视觉错误: ${msg.slice(0, 150)}`, 'e');
                            resolve({ ok: false, error: msg });
                            return;
                        }
                        const text = data.choices && data.choices[0] && data.choices[0].message
                            ? (data.choices[0].message.content || '') : '';
                        KZLog.add(`AI 视觉响应长度=${text.length} 字`, 'i');

                        // 解析
                        let stem = '', answer = '', explain = '';
                        let options = [];
                        const stemM = text.match(/题目[:：]\s*([\s\S]+?)(?=\n\s*选项|\n\s*答案)/);
                        if (stemM) stem = stemM[1].trim();
                        const ansM = text.match(/答案[:：]\s*(.+)/);
                        if (ansM) answer = ansM[1].trim().replace(/["'}]/g, '');
                        const expIdx = text.search(/解析[:：]/);
                        if (expIdx >= 0) explain = text.slice(expIdx).replace(/^解析[:：]\s*/, '').trim();

                        const optBlock = text.match(/选项[:：]\s*([\s\S]+?)(?=\n\s*答案|\n\s*解析|$)/);
                        if (optBlock) {
                            const re = /([A-H])[、.．:：]\s*(.+)/g;
                            let m;
                            while ((m = re.exec(optBlock[1])) !== null) {
                                options.push({ key: m[1], text: m[2].trim() });
                            }
                        }

                        // 归一化答案
                        let ans = answer;
                        if (/对|true/i.test(ans) && ans.length < 8) ans = 'true';
                        else if (/错|false/i.test(ans) && ans.length < 8) ans = 'false';
                        else {
                            const mm = ans.match(/[A-H]{1,8}/);
                            if (mm) ans = mm[0];
                        }

                        KZLog.add(`AI 视觉解析: answer="${ans}" stem="${stem.slice(0, 40)}"`, ans ? 'o' : 'e');
                        resolve({
                            ok: !!ans,
                            answer: ans, explain, stem, options, raw: text,
                            error: ans ? '' : '未能解析出答案',
                        });
                    } catch (e) {
                        KZLog.add(`AI 视觉解析失败: ${res.responseText.slice(0, 120)}`, 'e');
                        resolve({ ok: false, error: '解析响应失败' });
                    }
                },
                onerror(err) {
                    KZLog.add('AI 视觉网络错误: ' + (err.error || ''), 'e');
                    resolve({ ok: false, error: '网络错误' });
                },
                ontimeout() {
                    KZLog.add('AI 视觉超时', 'e');
                    resolve({ ok: false, error: '超时' });
                },
            });
        });
    },

    async answerQuestion(q) {
        const typeMap = {
            single: '单选题（只选一个选项字母）',
            multi: '多选题（选出所有正确选项的字母，如 ABC）',
            judge: '判断题（只答 对 或 错）',
            blank: '填空题',
            essay: '简答题',
        };
        const typeDesc = typeMap[q.type] || q.type;

        let prompt = `题型：${typeDesc}\n题干：${q.stem}\n`;
        if (q.options && q.options.length > 0) {
            prompt += '选项：\n';
            q.options.forEach(o => {
                prompt += `${o.key}. ${o.text}\n`;
            });
        }

        prompt += `\n请严格按下面的文本格式作答（不要 JSON，不要多余文字）：
答案：<答案>
解析：<详细解析，把你的推理过程写清楚，不限字数>

示例：
答案：A
解析：Python 语法简洁、生态丰富（NumPy/Pandas/PyTorch/TensorFlow），是人工智能领域最主流的入门语言；相比之下 Java/C++ 更偏工程，JavaScript 偏前端，都不是 AI 初学者的首选。

- 单选：答案写一个字母，如 A
- 多选：答案写字母连写，如 ABC
- 判断：答案写「对」或「错」
- 填空/简答：答案写答案文本
解析部分尽量完整，包含判断依据。`;

        const systemPrompt = '你是网课答题助手。题目可能有乱码，请根据上下文和选项推断题意再作答。严格按「答案：」和「解析：」两行输出，解析要详细完整。';
        const r = await this.chat(prompt, systemPrompt);
        if (!r.ok) {
            KZLog.add(`AI 失败: ${r.error}`, 'e');
            return r;
        }

        // 解析：兼容「答案：/解析：」文本格式 和 JSON 格式
        const text = r.text || '';
        let rawAnswer = '';
        let explain = '';

        // 优先文本格式
        const ansM = text.match(/答案[:：]\s*(.+)/);
        const expIdx = text.search(/解析[:：]/);
        if (ansM) {
            rawAnswer = ansM[1].trim().replace(/["'}]/g, '');
            if (expIdx >= 0) explain = text.slice(expIdx).replace(/^解析[:：]\s*/, '').trim().replace(/^["']|["']$/g, '');
        } else {
            // 兼容 JSON {"answer":"...","explain":"..."}
            const jm = text.match(/\{[\s\S]*\}/);
            if (jm) {
                try {
                    const obj = JSON.parse(jm[0]);
                    rawAnswer = String(obj.answer || obj.ans || '').trim();
                    explain = String(obj.explain || obj.analysis || obj.reason || '').trim();
                } catch (e) { }
            }
        }
        if (!rawAnswer) rawAnswer = text.replace(/解析[:：][\s\S]*/, '').replace(/[{}"']/g, '').trim();

        let answer = rawAnswer;
        if (q.type === 'multi') {
            const multiMatch = answer.match(/[A-H]{1,8}/);
            if (multiMatch) answer = [...new Set(multiMatch[0].split(''))].sort().join('');
        } else if (q.type === 'single') {
            const m = answer.match(/[A-H]/);
            if (m) answer = m[0];
        } else if (q.type === 'judge') {
            if (/对|true|T|正确/i.test(answer)) answer = 'true';
            else if (/错|false|F|错误/i.test(answer)) answer = 'false';
        }

        KZLog.add(`AI 解析: answer="${answer}" explain长度=${explain.length} 字`, answer ? 'o' : 'e');

        this.saveHistory({
            t: new Date().toISOString(),
            type: q.type,
            stem: q.stem.slice(0, 200),
            options: q.options.map(o => o.key + '.' + o.text).join(' | '),
            aiRaw: text.slice(0, 500),
            answer,
            explain,
            qid: q.qid || '',
        });

        return { ok: !!answer, answer, reason: text, explain, raw: rawAnswer };
    },

    saveHistory(entry) {
        try {
            const key = 'kezhou-ai-history';
            const arr = JSON.parse(GM_getValue(key) || '[]');
            arr.push(entry);
            GM_setValue(key, JSON.stringify(arr.slice(-500)));
        } catch (e) { }
    },

    getHistory() {
        try {
            return JSON.parse(GM_getValue('kezhou-ai-history') || '[]');
        } catch (e) { return []; }
    },
};
