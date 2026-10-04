// ========== 关于 / 打赏（参考 AI-Marker-Suite） ==========

function showKezhouAbout() {
    // 关掉旧的
    const old = document.getElementById('kz-about-overlay');
    if (old) { old.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'kz-about-overlay';
    overlay.style.cssText = 'all:initial;position:fixed;inset:0;background:rgba(0,0,0,0.32);backdrop-filter:blur(6px);z-index:2147483647;display:flex;justify-content:center;align-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Inter",sans-serif;box-sizing:border-box;';
    overlay.innerHTML = `
        <div style="background:#fff;border:1px solid #e1e6ef;border-radius:16px;box-shadow:0 28px 80px rgba(18,28,45,0.22);width:min(480px,92vw);max-height:84vh;overflow-y:auto;padding:28px;color:#172033;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div style="font-size:17px;font-weight:700;">关于 课舟</div>
                <button id="kz-about-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#667085;padding:4px 8px;border-radius:6px;">×</button>
            </div>
            <div style="width:64px;height:64px;margin:0 auto 12px;background:linear-gradient(135deg,#172033,#2166ad);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;font-weight:700;">舟</div>
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:18px;font-weight:700;">课舟 · 网课学习助手</div>
                <div style="font-size:12px;color:#667085;margin-top:4px;">v${SCRIPT_CONFIG.VERSION}
                    <span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:11px;background:rgba(33,102,173,0.1);color:#2166ad;margin-left:6px;">学习通</span>
                </div>
            </div>

            <div style="font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">功能</div>
            <div style="font-size:13px;color:#344054;line-height:1.8;">
                · 自动播放视频（可跳过已看）<br>
                · 视频中插题 / 章节测验自动作答<br>
                · AI 答案 + 详细解析，确认后提交<br>
                · 字体反爬解码，多供应商模型
            </div>

            <div style="font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:0.8px;margin:18px 0 10px;">帮助与支持</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <a href="https://github.com/five-plus-one/CourseFlow" target="_blank"
                   style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f7f8fa;border:1px solid #e1e6ef;border-radius:8px;color:#172033;text-decoration:none;font-size:13px;">
                    <span>📦</span><span>开源仓库 · 提交反馈</span>
                </a>
                <a href="https://r-l.ink/contact" target="_blank"
                   style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f7f8fa;border:1px solid #e1e6ef;border-radius:8px;color:#172033;text-decoration:none;font-size:13px;">
                    <span>✉️</span><span>联系作者</span>
                </a>
            </div>

            <div style="margin-top:20px;background:linear-gradient(135deg,#fff9e6,#fff3cc);border:1px solid rgba(255,193,7,0.3);border-radius:12px;padding:16px;">
                <div style="font-size:14px;font-weight:700;color:#172033;margin-bottom:8px;">☕ 支持作者</div>
                <div style="font-size:12px;color:#667085;margin-bottom:12px;line-height:1.5;">如果课舟对你有帮助，欢迎请作者喝杯咖啡。</div>
                <div style="display:flex;gap:16px;justify-content:center;">
                    <div style="text-align:center;">
                        <img src="https://r-l.ink/paywx1" alt="微信赞赏"
                             style="width:120px;height:120px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);"
                             onerror="this.style.display='none'">
                        <div style="font-size:11px;color:#666;margin-top:6px;">微信赞赏</div>
                    </div>
                    <div style="text-align:center;">
                        <img src="https://r-l.ink/payzfb1" alt="支付宝赞赏"
                             style="width:120px;height:120px;border-radius:8px;border:1px solid rgba(0,0,0,0.1);"
                             onerror="this.style.display='none'">
                        <div style="font-size:11px;color:#666;margin-top:6px;">支付宝赞赏</div>
                    </div>
                </div>
            </div>

            <div style="text-align:center;font-size:11px;color:#aaa;margin-top:16px;">
                本工具仅供学习交流，请遵守学校相关规定
            </div>
        </div>`;
    (document.body || document.documentElement).appendChild(overlay);

    overlay.querySelector('#kz-about-close').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}
