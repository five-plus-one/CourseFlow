// ========== 课舟 历史记录（参考 AI-Marker-Suite） ==========
// 结构：一次作答 = 一条记录，含题目/选项/答案/解析/对错标记

const KZHistory = {
    KEY: 'kezhou-history',

    getAll() {
        try {
            return JSON.parse(GM_getValue(this.KEY) || '[]');
        } catch (e) { return []; }
    },

    /** 按时间倒序（最新在前）——不依赖数组顺序，恢复记录混入后也正确 */
    getSorted() {
        return this.getAll().slice().sort((a, b) => {
            const ta = new Date(a.time || 0).getTime();
            const tb = new Date(b.time || 0).getTime();
            return tb - ta;
        });
    },

    _save(arr) {
        try { GM_setValue(this.KEY, JSON.stringify(arr.slice(-1000))); } catch (e) { }
    },

    /**
     * 新增一条作答记录
     * @param {object} record
     *   {chapterId, courseId, mode, decodeOk, questions: [
     *     {qid, type, stem, options:[{key,text,picked}], answer, explain, correct?, isWrong?}
     *   ]}
     */
    add(record) {
        const arr = this.getAll();
        const entry = Object.assign({
            id: 'kz_' + Date.now().toString(36),
            time: new Date().toISOString(),
        }, record);
        arr.push(entry);
        this._save(arr);
        return entry.id;
    },

    /** 提交后回填对错 */
    markResult(id, verdict) {
        // verdict: {correctCount, wrongCount, detail:[{qid, isWrong, correct}]}
        const arr = this.getAll();
        const e = arr.find(x => x.id === id);
        if (!e) return;
        e.result = verdict;
        if (e.questions && verdict && verdict.detail) {
            verdict.detail.forEach(d => {
                const q = e.questions.find(q => String(q.qid) === String(d.qid));
                if (q) {
                    q.isWrong = !!d.isWrong;
                    if (d.correct) q.correct = d.correct;
                }
            });
        }
        this._save(arr);
    },

    /** 按章节查 */
    getByChapter(chapterId) {
        return this.getAll().filter(e => e.chapterId === chapterId);
    },

    /**
     * 从 AI 请求历史（kezhou-ai-history）恢复作答记录
     * 背景：旧版本 KZHistory 未打包导致作答记录从未落盘，
     *       但 AIEngine.saveHistory 一直在正常保存题干/答案/解析。
     * 幂等：首次导入后打标记，不重复导入。
     * @returns {number} 恢复的条数（0 = 无可恢复或已恢复过）
     */
    importFromAiHistory() {
        try {
            if (GM_getValue('kezhou-history-imported')) return 0;
            const raw = GM_getValue('kezhou-ai-history') || '[]';
            const aiList = JSON.parse(raw);
            if (!Array.isArray(aiList) || !aiList.length) {
                GM_setValue('kezhou-history-imported', true);
                return 0;
            }

            const arr = this.getAll();
            // 按题干前缀去重，避免和已正常记录的重复
            const seen = new Set(arr.flatMap(e => (e.questions || []).map(q => String(q.stem || '').slice(0, 40))));

            let count = 0;
            for (const item of aiList) {
                const stem = String(item.stem || '').slice(0, 200);
                const key = stem.slice(0, 40);
                if (!stem || seen.has(key)) continue;
                seen.add(key);

                // options 存的是 "A. xxx | B. yyy" 字符串，拆回结构
                const options = String(item.options || '').split('|').map(s => {
                    const m = s.trim().match(/^([A-H])[.、:：]?\s*(.+)$/);
                    return m ? { key: m[1], text: m[2].trim() } : { key: '', text: s.trim() };
                }).filter(o => o.text);

                arr.push({
                    id: 'kz_rec_' + Date.now().toString(36) + '_' + count,
                    time: item.t || new Date().toISOString(),
                    chapterId: '',
                    courseId: '',
                    mode: 'recovered',
                    decodeOk: true,
                    source: 'ai-history-recover',
                    questions: [{
                        qid: String(item.qid || ''),
                        type: item.type || 'unknown',
                        stem,
                        options,
                        answer: item.answer || '',
                        explain: item.explain || '',
                    }],
                });
                count++;
            }

            this._save(arr);
            GM_setValue('kezhou-history-imported', true);
            return count;
        } catch (e) {
            return 0;
        }
    },

    /** 判题（用户答案 vs 正确答案） */
    judge(q) {
        if (q.correct == null || q.correct === '') return null; // 未知
        const ua = String(q.answer || '').trim().toUpperCase();
        const ca = String(q.correct).trim().toUpperCase();
        if (q.type === 'judge') {
            const norm = s => (/^true$|^对$|^T$/.test(s) ? 'TRUE' : /^false$|^错$|^F$/.test(s) ? 'FALSE' : s);
            return norm(ua) === norm(ca);
        }
        if (q.type === 'multi') {
            const s1 = [...new Set(ua.replace(/[^A-H]/g, '').split(''))].sort().join('');
            const s2 = [...new Set(ca.replace(/[^A-H]/g, '').split(''))].sort().join('');
            return s1 === s2;
        }
        return ua === ca;
    },

    /** 导出 */
    export() {
        const arr = this.getAll();
        const header = `=== 课舟历史记录 ===\nexport: ${new Date().toISOString()}\ncount: ${arr.length}\n\n`;
        const body = arr.map(e => {
            let s = `[${e.time}] chapter=${e.chapterId} mode=${e.mode} decodeOk=${e.decodeOk}\n`;
            (e.questions || []).forEach((q, i) => {
                const mark = q.isWrong === true ? '✗答错' : q.isWrong === false ? '✓正确' : '—';
                s += `  ${i + 1}.[${q.type}] ${mark} ${String(q.stem || '').slice(0, 60)}\n`;
                s += `     答案=${q.answer}${q.correct ? ' 正确=' + q.correct : ''}\n`;
                if (q.explain) s += `     解析=${String(q.explain).slice(0, 500)}\n`;
            });
            return s;
        }).join('\n');

        const fn = `kezhou-history-${Date.now().toString(36)}.txt`;
        const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fn;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        return fn;
    },

    /** 渲染历史面板 HTML（给 UI 用） */
    renderPanelHtml() {
        const arr = this.getAll().slice(-30).reverse();
        if (!arr.length) return '<div style="color:#667085;font-size:13px;padding:12px">暂无历史记录</div>';
        return arr.map(e => {
            const wrong = (e.questions || []).filter(q => q.isWrong === true).length;
            const right = (e.questions || []).filter(q => q.isWrong === false).length;
            return `
            <div class="kz-hist-item">
                <div class="kz-hist-head">
                    <span class="kz-hist-time">${new Date(e.time).toLocaleString()}</span>
                    <span class="kz-hist-tag ${wrong ? 'has-wrong' : 'all-ok'}">${right}对 ${wrong}错</span>
                </div>
                ${(e.questions || []).map(q => `
                <div class="kz-hist-q ${q.isWrong === true ? 'wrong' : q.isWrong === false ? 'right' : ''}">
                    <div class="kz-hist-stem">${String(q.stem || '').slice(0, 70)}</div>
                    <div class="kz-hist-ans">答案 ${q.answer}${q.correct ? ' · 正确 ' + q.correct : ''}${q.isWrong === true ? ' · <b>答错</b>' : ''}</div>
                    ${q.explain ? `<div class="kz-hist-exp">${String(q.explain).slice(0, 300)}</div>` : ''}
                </div>`).join('')}
            </div>`;
        }).join('');
    },
};
