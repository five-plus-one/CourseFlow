// ========== 测验确认弹窗（AI-Marker-Suite 风格） ==========
// 原题 + AI 答案 + 解析，10 秒倒计时，可暂停 / 提前确认 / 取消

function ensureConfirmStyles() {
    if (document.getElementById('kz-confirm-styles')) return;
    const s = document.createElement('style');
    s.id = 'kz-confirm-styles';
    s.textContent = `
        .kz-qc-overlay {
            all: initial;
            position: fixed !important; inset: 0 !important;
            background: rgba(0,0,0,0.32) !important;
            backdrop-filter: blur(6px) !important; -webkit-backdrop-filter: blur(6px) !important;
            z-index: 2147483646 !important;
            display: flex !important; justify-content: center !important; align-items: center !important;
            animation: kz-qc-fade 0.25s ease-out !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif !important;
            box-sizing: border-box !important;
        }
        @keyframes kz-qc-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes kz-qc-pop { from { transform: scale(0.96) translateY(8px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }

        .kz-qc-card {
            background: #ffffff !important;
            border: 1px solid #e1e6ef !important;
            border-radius: 16px !important;
            box-shadow: 0 28px 80px rgba(18,28,45,0.22), 0 2px 8px rgba(18,28,45,0.08) !important;
            width: min(560px, 92vw) !important;
            height: min(82vh, 720px) !important;
            display: flex !important; flex-direction: column !important;
            color: #172033 !important;
            animation: kz-qc-pop 0.3s cubic-bezier(0.16,1,0.3,1) !important;
            overflow: hidden !important;
        }
        .kz-qc-head {
            padding: 20px 24px 12px !important;
            display: flex !important; align-items: center !important; justify-content: space-between !important;
            border-bottom: 1px solid #eef1f6 !important;
        }
        .kz-qc-title { font-size: 17px !important; font-weight: 700 !important; color: #172033 !important; }
        .kz-qc-count {
            font-size: 13px !important; font-weight: 600 !important;
            padding: 4px 12px !important; border-radius: 20px !important;
            background: rgba(33,102,173,0.1) !important; color: #2166ad !important;
        }
        .kz-qc-count.paused { background: rgba(230,162,60,0.12) !important; color: #b45309 !important; }

        .kz-qc-body {
            padding: 12px 24px !important;
            overflow-y: auto !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            -webkit-overflow-scrolling: touch !important;
        }
        .kz-qc-q {
            padding: 12px 0 !important;
            border-bottom: 1px solid #f2f4f8 !important;
        }
        .kz-qc-q:last-child { border-bottom: none !important; }
        .kz-qc-shot {
            width: 100% !important;
            border-radius: 8px !important;
            border: 1px solid #e1e6ef !important;
            margin-bottom: 8px !important;
            cursor: zoom-in !important;
            display: block !important;
            background: #fff !important;
        }
        .kz-qc-qi { font-size: 12px !important; font-weight: 700 !important; color: #667085 !important; margin-bottom: 4px !important; }
        .kz-qc-stem { font-size: 14px !important; font-weight: 600 !important; color: #172033 !important; line-height: 1.55 !important; margin-bottom: 6px !important; }
        .kz-qc-opts { font-size: 13px !important; color: #4a5568 !important; line-height: 1.7 !important; margin-bottom: 6px !important; }
        .kz-qc-opts .picked { color: #2166ad !important; font-weight: 700 !important; }
        .kz-qc-ans {
            display: inline-block !important;
            font-size: 12px !important; font-weight: 700 !important;
            padding: 3px 10px !important; border-radius: 6px !important;
            background: #eef7f1 !important; color: #287047 !important;
            border: 1px solid #cfe8d7 !important; margin-bottom: 6px !important;
        }
        .kz-qc-exp {
            font-size: 12px !important; color: #667085 !important; line-height: 1.6 !important;
            background: #f7f8fa !important; border-radius: 8px !important;
            padding: 8px 12px !important;
        }

        .kz-qc-foot {
            padding: 14px 24px 20px !important;
            display: flex !important; gap: 10px !important;
            border-top: 1px solid #eef1f6 !important;
        }
        .kz-qc-btn {
            flex: 1 !important; padding: 11px 0 !important;
            border-radius: 8px !important; font-size: 13px !important; font-weight: 700 !important;
            cursor: pointer !important; border: none !important; text-align: center !important;
            transition: all 0.25s cubic-bezier(0.16,1,0.3,1) !important;
            font-family: inherit !important;
        }
        .kz-qc-btn:disabled { opacity: 0.5 !important; cursor: not-allowed !important; }
        .kz-qc-primary {
            background: #172033 !important; color: #fff !important;
            box-shadow: 0 6px 16px rgba(18,28,45,0.18) !important;
        }
        .kz-qc-primary:hover:not(:disabled) { background: #0f1725 !important; transform: translateY(-1px) !important; }
        .kz-qc-ghost {
            background: #fff !important; color: #344054 !important;
            border: 1px solid #d8dee8 !important;
        }
        .kz-qc-ghost:hover:not(:disabled) { background: #f3f6fa !important; }
        .kz-qc-pause {
            background: #fff !important; color: #b45309 !important;
            border: 1px solid rgba(230,162,60,0.4) !important;
        }
    `;
    document.head.appendChild(s);
}

/**
 * 显示测验确认弹窗
 * @param {Array} results  [{index, type, stem, options:[{key,text,picked}], answer, explain}]
 * @param {object} opts    {seconds, onSubmit, onCancel, submitLabel}
 * @returns {{close:Function}}
 */
function showQuizConfirm(results, opts = {}) {
    ensureConfirmStyles();
    const seconds = opts.seconds || 10;
    const submitLabel = opts.submitLabel || '确认提交';

    // 关掉旧的
    const old = document.querySelector('.kz-qc-overlay');
    if (old) old.remove();

    const root = document.body || document.documentElement;
    const overlay = document.createElement('div');
    overlay.className = 'kz-qc-overlay';

    const typeLabel = { single: '单选', multi: '多选', judge: '判断', blank: '填空', essay: '简答' };

    const items = results.map((r, i) => {
        const optsHtml = (r.options || []).map(o => {
            const picked = o.picked || String(r.answer || '').toUpperCase().includes(o.key);
            return `<div class="${picked ? 'picked' : ''}">${o.key}${o.key && o.text ? '. ' : ''}${o.text}${picked ? ' ✓' : ''}</div>`;
        }).join('');
        return `
            <div class="kz-qc-q">
                <div class="kz-qc-qi">第 ${r.index != null ? r.index + 1 : i + 1} 题 · ${typeLabel[r.type] || r.type || ''}</div>
                ${r.screenshot ? `<img class="kz-qc-shot" src="${r.screenshot}" alt="题目截图">` : ''}
                <div class="kz-qc-stem">${escapeHtml(r.stem || '')}</div>
                ${optsHtml ? `<div class="kz-qc-opts">${optsHtml}</div>` : ''}
                <div class="kz-qc-ans">答案：${escapeHtml(String(r.answer || ''))}</div>
                ${r.explain ? `<div class="kz-qc-exp">解析：${escapeHtml(r.explain)}</div>` : ''}
            </div>`;
    }).join('');

    overlay.innerHTML = `
        <div class="kz-qc-card">
            <div class="kz-qc-head">
                <div class="kz-qc-title">测验作答完成</div>
                <div class="kz-qc-count" id="kz-qc-count">${seconds}s 后自动${submitLabel.includes('提交') ? '提交' : '保存'}</div>
            </div>
            <div class="kz-qc-body">${items}</div>
            <div class="kz-qc-foot">
                <button class="kz-qc-btn kz-qc-ghost" id="kz-qc-cancel">取消</button>
                <button class="kz-qc-btn kz-qc-pause" id="kz-qc-pause">暂停</button>
                <button class="kz-qc-btn kz-qc-primary" id="kz-qc-ok">${submitLabel}</button>
            </div>
        </div>`;
    root.appendChild(overlay);

    // 截图点击放大
    overlay.querySelectorAll('.kz-qc-shot').forEach(img => {
        img.onclick = () => {
            const zoom = document.createElement('div');
            zoom.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:2147483647;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
            const big = document.createElement('img');
            big.src = img.src;
            big.style.cssText = 'max-width:92vw;max-height:90vh;border-radius:12px;background:#fff;';
            zoom.appendChild(big);
            zoom.onclick = () => zoom.remove();
            document.body.appendChild(zoom);
        };
    });

    let left = seconds;
    let paused = false;
    let done = false;
    const countEl = overlay.querySelector('#kz-qc-count');
    const pauseBtn = overlay.querySelector('#kz-qc-pause');
    const okBtn = overlay.querySelector('#kz-qc-ok');
    const cancelBtn = overlay.querySelector('#kz-qc-cancel');

    const tick = () => {
        if (done || paused) return;
        left--;
        if (left <= 0) {
            finish(true);
            return;
        }
        countEl.textContent = `${left}s 后自动${submitLabel.includes('提交') ? '提交' : '保存'}`;
    };
    const timer = setInterval(tick, 1000);

    function finish(auto) {
        if (done) return;
        done = true;
        clearInterval(timer);
        overlay.remove();
        if (auto) {
            if (opts.onSubmit) opts.onSubmit(true);
        }
    }

    pauseBtn.onclick = () => {
        paused = !paused;
        pauseBtn.textContent = paused ? '继续' : '暂停';
        countEl.classList.toggle('paused', paused);
        countEl.textContent = paused
            ? '已暂停'
            : `${left}s 后自动${submitLabel.includes('提交') ? '提交' : '保存'}`;
    };
    okBtn.onclick = () => {
        done = true;
        clearInterval(timer);
        overlay.remove();
        if (opts.onSubmit) opts.onSubmit(false);
    };
    cancelBtn.onclick = () => {
        done = true;
        clearInterval(timer);
        overlay.remove();
        if (opts.onCancel) opts.onCancel();
    };

    return {
        close() { done = true; clearInterval(timer); overlay.remove(); },
    };
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
