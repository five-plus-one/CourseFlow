// ========== 历史数据看板（参考 AI-Marker-Suite 评阅历史） ==========
// 筛选：日期区间 / 来源 / 对错状态 / 关键词搜索
// 排序：时间倒序（最新在前，不依赖数组顺序）

function showKezhouHistory() {
    const old = document.getElementById('kz-history-overlay');
    if (old) { old.remove(); return; }

    // 筛选状态
    const filterState = { startDate: '', endDate: '', source: '', status: '', keyword: '' };

    const overlay = document.createElement('div');
    overlay.id = 'kz-history-overlay';
    overlay.style.cssText = 'all:initial;position:fixed;inset:0;background:rgba(18,28,45,0.45);z-index:2147483647;display:flex;justify-content:center;align-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Inter",sans-serif;box-sizing:border-box;padding:24px;';
    document.body.appendChild(overlay);

    const card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:16px;width:min(880px,96vw);max-height:88vh;min-height:120px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 28px 80px rgba(18,28,45,0.22);color:#172033;';
    overlay.appendChild(card);

    // 关闭事件先绑死
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    /** 按筛选条件过滤 + 时间倒序 */
    const getFiltered = () => {
        return KZHistory.getSorted().filter(e => {
            // 来源
            if (filterState.source) {
                const src = e.source || 'auto-answer';
                if (src !== filterState.source) return false;
            }
            // 对错状态
            if (filterState.status) {
                const qs = e.questions || [];
                const wrong = qs.filter(q => q.isWrong === true).length;
                const right = qs.filter(q => q.isWrong === false).length;
                const unjudged = qs.length - wrong - right;
                if (filterState.status === 'all-right' && wrong > 0) return false;
                if (filterState.status === 'has-wrong' && wrong === 0) return false;
                if (filterState.status === 'unjudged' && unjudged === 0) return false;
            }
            // 日期（闭区间到当天末）
            if (filterState.startDate) {
                const t = new Date(e.time || 0).getTime();
                if (t < new Date(filterState.startDate).getTime()) return false;
            }
            if (filterState.endDate) {
                const t = new Date(e.time || 0).getTime();
                if (t > new Date(filterState.endDate).getTime() + 86400000) return false;
            }
            // 关键词（搜题干）
            if (filterState.keyword) {
                const kw = filterState.keyword.toLowerCase();
                const hit = (e.questions || []).some(q =>
                    String(q.stem || '').toLowerCase().includes(kw)
                    || String(q.answer || '').toLowerCase().includes(kw)
                );
                if (!hit) return false;
            }
            return true;
        });
    };

    const render = () => {
        const all = KZHistory.getAll();
        const items = getFiltered();
        const sizeKB = Math.round(JSON.stringify(all).length / 1024);
        const hasFilter = filterState.startDate || filterState.endDate || filterState.source || filterState.status || filterState.keyword;

        card.innerHTML = `
        <div style="padding:22px 26px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eef1f6;">
            <div style="font-size:19px;font-weight:700;">作答历史</div>
            <button id="kz-hist-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#667085;padding:2px 8px;">×</button>
        </div>

        <div style="padding:12px 26px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid #eef1f6;">
            <span style="padding:5px 12px;background:#f3f6fa;border-radius:8px;font-size:12px;font-weight:600;">${hasFilter ? `筛选 ${items.length} / 共 ${all.length} 条` : `记录 ${all.length} 条`}</span>
            <span style="padding:5px 12px;background:#f3f6fa;border-radius:8px;font-size:12px;font-weight:600;">存储 ${sizeKB} KB</span>
            <span style="flex:1"></span>
            <button class="kz-hist-btn" id="kz-hist-filter-toggle">筛选条件</button>
            <button class="kz-hist-btn" id="kz-hist-json">JSON</button>
            <button class="kz-hist-btn" id="kz-hist-csv">CSV</button>
            <button class="kz-hist-btn" id="kz-hist-html">HTML</button>
            <button class="kz-hist-btn kz-hist-danger" id="kz-hist-clear">清空全部</button>
        </div>

        <div id="kz-hist-filter" style="display:${hasFilter ? 'grid' : 'none'};grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;padding:12px 26px;background:#fbfcfe;border-bottom:1px solid #eef1f6;align-items:center;">
            <div style="display:flex;gap:4px;align-items:center;">
                <input type="date" id="kf-start" value="${filterState.startDate}" style="flex:1;height:30px;padding:0 6px;border:1px solid #d8dee8;border-radius:6px;font-size:11px;">
                <span style="color:#aaa;font-size:11px;">~</span>
                <input type="date" id="kf-end" value="${filterState.endDate}" style="flex:1;height:30px;padding:0 6px;border:1px solid #d8dee8;border-radius:6px;font-size:11px;">
            </div>
            <select id="kf-source" style="height:30px;padding:0 6px;border:1px solid #d8dee8;border-radius:6px;font-size:11px;">
                <option value="" ${!filterState.source ? 'selected' : ''}>全部来源</option>
                <option value="auto-answer" ${filterState.source === 'auto-answer' ? 'selected' : ''}>自动答题</option>
                <option value="graded-view" ${filterState.source === 'graded-view' ? 'selected' : ''}>已作答导入</option>
                <option value="ai-history-recover" ${filterState.source === 'ai-history-recover' ? 'selected' : ''}>旧记录恢复</option>
            </select>
            <select id="kf-status" style="height:30px;padding:0 6px;border:1px solid #d8dee8;border-radius:6px;font-size:11px;">
                <option value="" ${!filterState.status ? 'selected' : ''}>全部对错</option>
                <option value="all-right" ${filterState.status === 'all-right' ? 'selected' : ''}>全对</option>
                <option value="has-wrong" ${filterState.status === 'has-wrong' ? 'selected' : ''}>有错</option>
                <option value="unjudged" ${filterState.status === 'unjudged' ? 'selected' : ''}>未判定</option>
            </select>
            <div style="display:flex;gap:6px;">
                <input type="text" id="kf-keyword" value="${filterState.keyword}" placeholder="搜索题干/答案…" style="flex:1;height:30px;padding:0 8px;border:1px solid #d8dee8;border-radius:6px;font-size:11px;min-width:0;">
                <button class="kz-hist-btn" id="kf-apply" style="padding:0 12px;height:30px;font-size:11px;background:#eef7f1;color:#287047;border-color:#cfe8d7;">筛选</button>
                <button class="kz-hist-btn" id="kf-reset" style="padding:0 10px;height:30px;font-size:11px;">重置</button>
            </div>
        </div>

        <div style="flex:1;overflow-y:auto;padding:16px 26px;min-height:200px;">
            ${items.length === 0 ? `<div style="color:#667085;font-size:13px;padding:32px 0;text-align:center;">${hasFilter ? '没有符合筛选条件的记录' : '暂无作答记录'}</div>` : ''}
            ${items.map((e, idx) => {
            const wrong = (e.questions || []).filter(q => q.isWrong === true).length;
            const right = (e.questions || []).filter(q => q.isWrong === false).length;
            const src = e.source === 'graded-view' ? '已作答导入' : e.source === 'ai-history-recover' ? '旧记录恢复' : '自动答题';
            return `
                <div style="border:1px solid #e1e6ef;border-radius:12px;padding:14px 16px;margin-bottom:12px;background:#fafbfd;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                        <span style="font-size:12px;font-weight:700;color:#172033;">${new Date(e.time).toLocaleString()}</span>
                        <span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;background:rgba(33,102,173,0.1);color:#2166ad;">${src}</span>
                        <span style="padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;${wrong ? 'background:rgba(194,53,43,0.1);color:#c2352b;' : right ? 'background:rgba(40,112,71,0.1);color:#287047;' : 'background:rgba(152,162,179,0.1);color:#667085;'}">${right}对 ${wrong}错${right + wrong < (e.questions || []).length ? ' ' + ((e.questions || []).length - right - wrong) + '未判' : ''}</span>
                        <span style="flex:1"></span>
                        <button class="kz-hist-btn kz-hist-sm" data-detail="${idx}">详情</button>
                        <button class="kz-hist-btn kz-hist-sm kz-hist-danger" data-del="${e.id}">删除</button>
                    </div>
                    ${(e.questions || []).slice(0, 3).map(q => `
                    <div style="font-size:12.5px;color:#344054;line-height:1.6;margin:4px 0;">
                        <span style="color:${q.isWrong === true ? '#c2352b' : q.isWrong === false ? '#287047' : '#667085'};font-weight:700;">${q.isWrong === true ? '✗' : q.isWrong === false ? '✓' : '·'}</span>
                        ${escapeHtml((q.stem || '').slice(0, 60))}
                        <span style="color:#667085;"> → ${escapeHtml(String(q.answer || '').slice(0, 12))}</span>
                    </div>`).join('')}
                    ${(e.questions || []).length > 3 ? `<div style="font-size:11px;color:#98a2b3;">…共 ${e.questions.length} 题</div>` : ''}
                    <div id="kz-detail-${idx}" style="display:none;margin-top:10px;padding:10px;background:#fff;border-radius:8px;border:1px solid #eef1f6;">
                        ${(e.questions || []).map(q => `
                        <div style="margin:8px 0;font-size:12.5px;line-height:1.7;">
                            <div style="font-weight:600;color:#172033;">${escapeHtml(q.stem || '')}</div>
                            ${(q.options || []).map(o => `<div style="color:#667085;padding-left:8px;">${escapeHtml(o.key || '')}. ${escapeHtml(o.text || '')}</div>`).join('')}
                            <div style="margin-top:4px;"><span style="color:#287047;font-weight:700;">答案 ${escapeHtml(String(q.answer || ''))}</span>
                            ${q.correct ? `<span style="color:#c2352b;margin-left:10px;">正确 ${escapeHtml(String(q.correct))}</span>` : ''}</div>
                            ${q.explain ? `<div style="color:#667085;margin-top:4px;">解析：${escapeHtml(q.explain)}</div>` : ''}
                        </div>`).join('')}
                    </div>
                </div>`;
        }).join('')}
        </div>
        <style>
            .kz-hist-btn{padding:8px 14px;border-radius:8px;border:1px solid #d8dee8;background:#fff;color:#344054;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;}
            .kz-hist-btn:hover{background:#f3f6fa;}
            .kz-hist-sm{padding:5px 12px;font-size:11px;}
            .kz-hist-danger{color:#c2352b;border-color:rgba(194,53,43,0.35);}
            .kz-hist-danger:hover{background:rgba(194,53,43,0.06);}
        </style>`;

        // ---- 事件绑定 ----
        card.querySelector('#kz-hist-close').onclick = () => overlay.remove();

        // 筛选栏折叠/展开
        const filterToggle = card.querySelector('#kz-hist-filter-toggle');
        const filterBar = card.querySelector('#kz-hist-filter');
        filterToggle.onclick = () => {
            filterBar.style.display = filterBar.style.display === 'none' ? 'grid' : 'none';
        };

        // 应用筛选
        const applyBtn = card.querySelector('#kf-apply');
        if (applyBtn) applyBtn.onclick = () => {
            filterState.startDate = card.querySelector('#kf-start').value;
            filterState.endDate = card.querySelector('#kf-end').value;
            filterState.source = card.querySelector('#kf-source').value;
            filterState.status = card.querySelector('#kf-status').value;
            filterState.keyword = card.querySelector('#kf-keyword').value.trim();
            render();
        };

        // 回车触发筛选
        const kwInput = card.querySelector('#kf-keyword');
        if (kwInput) kwInput.onkeydown = (e) => { if (e.key === 'Enter') applyBtn.click(); };

        // 重置
        const resetBtn = card.querySelector('#kf-reset');
        if (resetBtn) resetBtn.onclick = () => {
            filterState.startDate = '';
            filterState.endDate = '';
            filterState.source = '';
            filterState.status = '';
            filterState.keyword = '';
            render();
        };

        // 详情展开/收起
        card.querySelectorAll('[data-detail]').forEach(btn => {
            btn.onclick = () => {
                const d = card.querySelector('#kz-detail-' + btn.dataset.detail);
                if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
            };
        });

        // 删除单条
        card.querySelectorAll('[data-del]').forEach(btn => {
            btn.onclick = () => {
                const arr = KZHistory.getAll().filter(x => x.id !== btn.dataset.del);
                try { GM_setValue(KZHistory.KEY, JSON.stringify(arr)); } catch (e) { }
                render();
            };
        });

        // 导出（用筛选后的结果）
        const download = (content, type, ext) => {
            const blob = new Blob([content], { type });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `kezhou-history-${Date.now().toString(36)}.${ext}`;
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        };

        card.querySelector('#kz-hist-json').onclick = () => {
            download(JSON.stringify(items, null, 2), 'application/json', 'json');
        };
        card.querySelector('#kz-hist-csv').onclick = () => {
            const rows = [['时间', '章节', '题干', '答案', '正确答案', '对错', '解析']];
            items.forEach(e => (e.questions || []).forEach(q => rows.push([
                e.time, e.chapterId || '', q.stem || '', q.answer || '', q.correct || '',
                q.isWrong === true ? '错' : q.isWrong === false ? '对' : '', (q.explain || '').slice(0, 200)
            ])));
            const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            download(csv, 'text/csv', 'csv');
        };
        card.querySelector('#kz-hist-html').onclick = () => {
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>课舟作答历史</title>
<style>body{font-family:sans-serif;margin:24px;color:#172033}h2{font-size:20px}.rec{border:1px solid #e1e6ef;border-radius:10px;padding:14px;margin:12px 0}.q{margin:8px 0}.ans{color:#287047;font-weight:600}.exp{color:#667085;font-size:13px}</style></head>
<body><h2>课舟作答历史（${items.length} 条）</h2>
${items.map(e => `<div class="rec"><b>${new Date(e.time).toLocaleString()}</b>
${(e.questions || []).map(q => `<div class="q"><div>${escapeHtml(q.stem || '')}</div>
<div class="ans">答案：${escapeHtml(String(q.answer || ''))}${q.correct ? '　正确：' + escapeHtml(String(q.correct)) : ''}</div>
${q.explain ? `<div class="exp">解析：${escapeHtml(q.explain)}</div>` : ''}</div>`).join('')}
</div>`).join('')}</body></html>`;
            download(html, 'text/html', 'html');
        };

        // 清空
        card.querySelector('#kz-hist-clear').onclick = () => {
            if (confirm('确定清空全部作答历史？')) {
                try { GM_setValue(KZHistory.KEY, '[]'); } catch (e) { }
                render();
            }
        };
    };

    try {
        // 自动恢复旧版本未落盘的记录
        const recovered = KZHistory.importFromAiHistory();
        if (recovered > 0 && typeof kzToast === 'function') {
            kzToast(`已恢复 ${recovered} 条旧作答记录`, 'success');
        }
        render();
    } catch (e) {
        card.innerHTML = `
            <div style="padding:22px 26px;display:flex;align-items:center;justify-content:space-between;">
                <div style="font-size:19px;font-weight:700;">作答历史</div>
                <button id="kz-hist-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#667085;padding:2px 8px;">×</button>
            </div>
            <div style="padding:16px 26px 28px;color:#c2352b;font-size:13px;">
                历史面板加载失败：${String(e && e.message || e).slice(0, 120)}
            </div>`;
        const closeBtn = card.querySelector('#kz-hist-close');
        if (closeBtn) closeBtn.onclick = () => overlay.remove();
    }
}
