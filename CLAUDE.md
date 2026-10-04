# 课舟 (CourseFlow) 开发约定

油猴脚本项目：辅助网课学习（自动播放视频、LLM 答题等）。首个目标平台：学习通/超星（多域名）。

## 项目结构约定

```
CourseFlow/
├── CLAUDE.md              # 本文件：项目规则
├── docs/                  # 设计文档、调研笔记
├── research/              # 页面诊断脚本（控制台用，供采集 DOM/网络）
├── src/                   # 脚本源码（后续建立）
│   ├── core/              # 核心模块（配置、AI 引擎、UI、主流程）
│   └── adapters/          # 平台适配器（每个平台一个目录）
│       └── xuexitong/     # 学习通/超星
└── dist/                  # 构建产物 *.user.js（gitignore）
```

## 设计对齐

界面风格与整体设计参考 `D:\5plus1\DEV\AI-Marker-Suite`（AI 批改助手）。
关键设计 token 见 `docs/aimarker-research.md`，实现时严格对齐，不要自创一套。

## 工程纪律

- 调研优先于猜测：页面 DOM/接口必须通过控制台诊断脚本实测，不许凭经验硬编码选择器
- 诊断脚本放在 `research/`，新增平台先补诊断再写 adapter
- 改完必须本地验证（构建 + 页面实测），不要只改不验
- 密钥、API key 不进代码、不进 commit（用 GM_setValue / 用户配置面板）
- 大改动先出方案，确认后再动手

## 命名

- 脚本名 / 产品名：课舟 / CourseFlow / kezhou
- 油猴脚本产物：`courseflow.user.js`
- 平台 id 用小写英文（如 `xuexitong`、`chaoxing`），域名匹配写在各 adapter 的 `urlPatterns`
