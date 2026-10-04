# AI-Marker-Suite 调研摘要

> 供「课舟」界面/架构对齐用。源仓库：`D:\5plus1\DEV\AI-Marker-Suite`

## 一、项目是什么

油猴脚本「AI 批改助手」：在 22 个阅卷平台上自动识别手写答题卡 → LLM 评分 → 填分 → 提交。
口号：晚上挂机睡觉，早上起来全改完。

## 二、架构

```
Core/                        脚本主体
├── build.js                 零依赖 Node 构建，合并模块 → dist/*.user.js
├── src/
│   ├── core/
│   │   ├── config.js        版本号唯一来源、CHANGELOG、默认 API 端点
│   │   ├── state.js         全局运行状态
│   │   ├── ai-engine.js     ProviderManager + GM_xmlhttpRequest 调 LLM
│   │   ├── prompt.js        提示词构建与解析
│   │   ├── main.js          主流程编排（startAutoGrading 等）
│   │   ├── ui-*.js          按钮/弹窗/Toast/设置/流式输出/Markdown
│   │   ├── history.js       评阅历史
│   │   └── updater.js       OTA 更新
│   └── adapters/<platform>/
│       ├── adapter.js       平台适配器（实现 PlatformAdapter 接口）
│       └── selectors.js     该平台全部 DOM 选择器常量
Account/                     账号服务（后端）
Docs/                        VitePress 文档站
diagnose-*.js                新平台控制台诊断脚本（调研入口）
```

### 适配器接口（可借鉴到课舟）

每个平台实现：`name / id / urlPatterns / shouldInitialize() / detectXxxPage() /
getTaskIdentifier() / gatherXxx() / fillXxx() / submit() / waitForNext()`
核心层通过 `window.__AI_MARKER_ADAPTER__` 访问当前适配器。

### 构建与发布

- `npm run build -- --channel=dev`，产物 `dist/`
- 版本 4 段式 `1.21.11.3`，写在 `config.js`
- `GM_xmlhttpRequest` 跨域调 LLM；`GM_setValue/getValue` 存配置
- @grant: GM_xmlhttpRequest, GM_setValue, GM_getValue, GM_registerMenuCommand

## 三、视觉设计 token（课舟必须对齐）

### 字体

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "SF Pro Display", sans-serif;
```

### 颜色

| 用途 | 色值 |
|------|------|
| 主文字 | `#172033` / `#1a1a1a` / `#1d1d1f` |
| 次要文字 | `#667085` / `#86868b` / `#4a4a4a` |
| 品牌/链接蓝 | `#2166ad`（新） / `#0052FF`（旧） |
| 成功 | `#287047` / `#34A853` / `#2f9e44` |
| 错误 | `#c2352b` / `#D93025` |
| 信息 | `#2166ad` |
| 边框 | `#e1e6ef` / `#d8dee8` / `rgba(0,0,0,0.08)` |
| 卡片底 | `#ffffff` |
| 软背景 | `#f6f6f7` / `#f7f8fa` / `#f3f6fa` |
| 遮罩 | `rgba(0,0,0,0.25)` + `backdrop-filter: blur(6px)` |

状态色（浮动按钮边框脉冲）：
- 运行中 蓝 `rgba(64,158,255,0.5)`
- 暂停 琥珀 `rgba(230,162,60,0.5)`
- 无人值守 红 `rgba(245,108,108,0.5)`
- 试用 紫 `rgba(124,58,237,0.5)`

### 形状与阴影

| 元素 | 圆角 | 阴影 |
|------|------|------|
| 主按钮（胶囊） | `40px` | `0 12px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)` |
| 模态卡片 | `14px` | `0 28px 80px rgba(18,28,45,0.22), 0 2px 8px rgba(18,28,45,0.08)` |
| Toast | `10px` | `0 16px 42px rgba(18,28,45,0.18), 0 2px 8px rgba(18,28,45,0.08)` |
| 输入框 | `8px` | focus: `0 0 0 3px rgba(33,102,173,0.12)` |
| 小按钮 | `7px` | — |
| 圆形小钮 | `50%` | `0 4px 16px rgba(0,0,0,0.08)` |

### 动效

- 缓动：`cubic-bezier(0.16, 1, 0.3, 1)`，时长 `0.25–0.3s`
- 入场：模态 `scale(0.96) translateY(8px) → 1`；Toast `translate(-50%, -20px) → 0`
- Hover：按钮 `translateY(-2px) scale(1.02–1.05)`
- 状态脉冲：`box-shadow` 扩散 keyframes（见 ui-button.js）

### 样式隔离（必做）

```css
.ai-xxx-btn, .ai-xxx-panel {
    all: initial;
    position: fixed !important;
    z-index: 99999 !important; /* 模态用 2147483647 */
    font-family: -apple-system, ... !important;
    box-sizing: border-box !important;
}
```

## 四、交互模式

1. **右下角浮动按钮组**：主操作胶囊按钮 + 圆形历史 + 圆形设置，间距约 55px
2. **Toast**：顶部居中，左侧色条（成功绿/错误红/信息蓝）
3. **模态**：居中卡片，标题 17px/700，正文 14px，底部取消(描边)+确认(深色实心)
4. **设置面板**：右侧滑出大面板（ui-settings.js 体量最大）
5. **流式输出**：ui-stream.js 展示 AI 思考过程
6. **诊断日志**：`console.log('🔎 [诊断] ...')` 统一前缀，方便用户反馈

## 五、对课舟的启示

| 维度 | 借鉴 | 差异 |
|------|------|------|
| 适配器模式 | 一平台一目录，selectors 与逻辑分离 | 课舟任务是「看课+答题」，不是「阅卷打分」 |
| 诊断先行 | diagnose-*.js 控制台脚本采集 | 已写入 `research/` |
| UI | 设计 token 原样迁移 | 主操作改为「开始学习 / 自动答题」 |
| AI 调用 | GM_xmlhttpRequest + 多 Provider | 可复用 ProviderManager 思路 |
| 配置 | GM_setValue + 导出导入 | 加 API Key 配置面板 |
| 构建 | 零依赖 Node 合并打包 | 课舟初期可单文件，规模大了再拆 |

## 六、学习通页面清单（用户提供的 URL 形态）

| 页面 | URL 特征 | 作用 |
|------|----------|------|
| 工作台/课程列表 | `i.xuexitong.com/base` `i.chaoxing.com/base` | 入口，可不做自动化 |
| 章节列表(旧) | `mooc2-ans.{xuexitong,chaoxing}.com/mooc2-ans/mycourse/stu?courseid=&clazzid=&cpi=&enc=` | 章节导航、任务点进度 |
| 章节列表(新 Vue) | `mooc2-ans.chaoxing.com/mooc2-ans-vue/fanyav3/stu?courseId=&clazzId=&cpi=&enc=` | 同上，UI 不同 |
| 视频/测验详情 | `mooc{1}.{chaoxing,xuexitong}.com/mycourse/studentstudy?chapterId=&courseId=&clazzid=&cpi=&enc=&mooc2=1` | **核心**：视频播放 + 章节测验 |

视频页与测验页常在同一 studentstudy URL 下，靠「1 视频 / 2 章节测验」Tab 切换。
