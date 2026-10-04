# 一直弹 debugger 怎么办

打开章节测验后控制台一直停在 `debugger`，不是课舟脚本的问题，是**页面反调试**或**浏览器扩展**注入了 `debugger` 语句。DevTools 一打开就会反复暂停。

常见来源：
1. 超星/学习通自带的 `enc_js_work.js`（混淆脚本里埋了反调试）
2. 油猴/扩展注入的脚本，例如你截图里出现过的 **SuperCopy Pro - 超级复制**
3. 其他会注入 `debugger` 的插件

## 处理办法（按顺序试）

### 方法 1：取消所有断点（最快）

1. F12 打开 DevTools
2. 切到 **Sources（源代码）** 面板
3. 右侧 **Breakpoints** 区域，取消勾选 **Activate breakpoints**（或按 `Ctrl + F8`）
4. 图标变成空心/斜杠即关闭，再操作页面不会暂停

### 方法 2：Never pause here（针对那一行）

1. 暂停在 `debugger` 那一行时
2. 在该行**右键** → **Never pause here（永不在此暂停）**
3. 点 ▶ 继续运行

### 方法 3：临时关掉可疑扩展

1. 地址栏打开 `chrome://extensions`
2. 暂时关闭 **SuperCopy Pro** 以及其他脚本注入类扩展
3. 刷新学习通页面再跑诊断
4. 诊断完再把扩展打开

### 方法 4：诊断时不开 Sources 面板

跑 `diagnose-page.js` 时只开 **Console**，不要停在 Sources。部分反调试只在断点面板激活时触发。

## 推荐做法

先用**方法 1**（Ctrl+F8 关断点），再刷新页面跑诊断脚本。如果还弹，用**方法 3** 临时关 SuperCopy。

---

## 记住这两条命令

诊断跑完后：
- `diagnose-page.js`：会**自动下载** `kezhou-diag-*.txt`，直接把文件发我
- `diagnose-network.js`：操作完页面后输入 `__KEZHOU_NET__.save()`，也会**自动下载** `kezhou-net-*.txt`
