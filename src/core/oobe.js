// ========== 首次启动引导 OOBE（参考 AI-Marker-Suite） ==========

const OOBE = {
    KEY: 'kezhou-oobe-done',

    isDone() {
        try { return !!GM_getValue(this.KEY); } catch (e) { return true; }
    },

    markDone() {
        try { GM_setValue(this.KEY, true); } catch (e) { }
    },

    show() {
        if (document.getElementById('kz-oobe')) return;
        const overlay = document.createElement('div');
        overlay.id = 'kz-oobe';
        overlay.style.cssText = 'all:initial;position:fixed;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);z-index:2147483647;display:flex;justify-content:center;align-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Inter",sans-serif;box-sizing:border-box;';
        (document.body || document.documentElement).appendChild(overlay);

        let step = 0;
        const cfg = ProviderManager.getActiveConfig();

        const render = () => {
            if (step === 0) {
                overlay.innerHTML = `
                <div style="background:#fff;border-radius:16px;width:min(460px,92vw);padding:32px;color:#172033;box-shadow:0 28px 80px rgba(18,28,45,0.22);">
                    <div style="width:64px;height:64px;margin:0 auto 16px;background:linear-gradient(135deg,#172033,#2166ad);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff;font-weight:700;">舟</div>
                    <div style="text-align:center;font-size:20px;font-weight:700;margin-bottom:8px;">欢迎使用 课舟</div>
                    <div style="text-align:center;font-size:13px;color:#667085;line-height:1.7;margin-bottom:24px;">
                        网课自动学习助手：自动播放视频、AI 答题。<br>
                        三个步骤完成配置，大约 1 分钟。
                    </div>
                    <button id="kz-oobe-next" style="width:100%;padding:12px;background:#172033;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">开始配置</button>
                </div>`;
            } else if (step === 1) {
                overlay.innerHTML = `
                <div style="background:#fff;border-radius:16px;width:min(460px,92vw);padding:32px;color:#172033;box-shadow:0 28px 80px rgba(18,28,45,0.22);">
                    <div style="font-size:12px;color:#667085;margin-bottom:6px;">第 2 步 / 共 3 步</div>
                    <div style="font-size:18px;font-weight:700;margin-bottom:12px;">配置 AI 接口</div>
                    <div style="font-size:13px;color:#667085;line-height:1.6;margin-bottom:16px;">
                        默认使用 5+1 API（与 AI 批改助手相同）。
                        填入 API Key 即可开始；也可以稍后在设置里更换供应商。
                    </div>
                    <label style="font-size:12px;font-weight:600;color:#667085;">API Key</label>
                    <input id="kz-oobe-key" type="password" value="${cfg.apiKey || ''}"
                           placeholder="sk-..."
                           style="width:100%;padding:11px 12px;border:1px solid #d8dee8;border-radius:8px;font-size:13px;margin:6px 0 16px;box-sizing:border-box;">
                    <div style="font-size:12px;margin-bottom:16px;">
                        <a href="https://api.ai.five-plus-one.com/console/token" target="_blank"
                           style="color:#2166ad;font-weight:600;text-decoration:none;">点击获取访问凭证 →</a>
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button id="kz-oobe-back" style="flex:1;padding:12px;background:#fff;color:#344054;border:1px solid #d8dee8;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">上一步</button>
                        <button id="kz-oobe-next" style="flex:1;padding:12px;background:#172033;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">下一步</button>
                    </div>
                </div>`;
            } else {
                overlay.innerHTML = `
                <div style="background:#fff;border-radius:16px;width:min(460px,92vw);padding:32px;color:#172033;box-shadow:0 28px 80px rgba(18,28,45,0.22);">
                    <div style="font-size:12px;color:#667085;margin-bottom:6px;">第 3 步 / 共 3 步</div>
                    <div style="font-size:18px;font-weight:700;margin-bottom:12px;">选择模型</div>
                    <label style="font-size:12px;font-weight:600;color:#667085;">模型</label>
                    <select id="kz-oobe-model" style="width:100%;padding:11px 12px;border:1px solid #d8dee8;border-radius:8px;font-size:13px;margin:6px 0 16px;box-sizing:border-box;">
                        <option value="courseflow" selected>courseflow（课舟推荐）</option>
                        <option value="aimarker-fast">aimarker-fast</option>
                        <option value="aimarker-pro">aimarker-pro</option>
                    </select>
                    <div style="font-size:12px;color:#667085;line-height:1.6;margin-bottom:20px;">
                        遇到答题不准时，可随时在设置里换模型或供应商。
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button id="kz-oobe-back" style="flex:1;padding:12px;background:#fff;color:#344054;border:1px solid #d8dee8;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">上一步</button>
                        <button id="kz-oobe-next" style="flex:1;padding:12px;background:#172033;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">完成</button>
                    </div>
                </div>`;
            }

            const next = overlay.querySelector('#kz-oobe-next');
            const back = overlay.querySelector('#kz-oobe-back');
            if (back) back.onclick = () => { step--; render(); };
            if (next) next.onclick = () => {
                if (step === 1) {
                    const key = overlay.querySelector('#kz-oobe-key').value.trim();
                    if (key) ProviderManager.setKey(ProviderManager.get().active, key);
                }
                if (step === 2) {
                    const model = overlay.querySelector('#kz-oobe-model').value;
                    ProviderManager.setActive(ProviderManager.get().active, model);
                }
                step++;
                if (step > 2) {
                    this.markDone();
                    overlay.remove();
                    kzToast('配置完成，点击「课舟 · 开始学习」启动', 'success');
                    return;
                }
                render();
            };
        };
        render();
    },
};
