<div align="center">
  <div style="width:80px;height:80px;background:linear-gradient(135deg,#172033,#2166ad);border-radius:20px;display:inline-flex;align-items:center;justify-content:center;font-size:36px;color:#fff;font-weight:700;">舟</div>

  # 课舟 CourseFlow

  **学习通 / 超星网课学习辅助工具**

  [![Build & Deploy](https://github.com/five-plus-one/CourseFlow/actions/workflows/build.yml/badge.svg)](https://github.com/five-plus-one/CourseFlow/actions/workflows/build.yml)
  [![Release](https://img.shields.io/github/v/release/five-plus-one/CourseFlow)](https://github.com/five-plus-one/CourseFlow/releases)
  [![License](https://img.shields.io/badge/仅供学习交流-orange)](https://github.com/five-plus-one/CourseFlow)

  [一键安装](https://five-plus-one.github.io/CourseFlow/) · [反馈问题](https://github.com/five-plus-one/CourseFlow/issues)
</div>

---

## 这是什么

课舟是一个**学习辅助工具**，帮助你更高效地完成网课学习中重复性、机械性的操作，让你把时间花在真正需要思考的内容上。

> **重要声明**：本工具定位为**辅助学习**，不是替代学习。
> 自动播放和记录功能是为了减少重复操作，AI 答题是学习参考而非应付考试。
> 请遵守学校相关规定，合理使用。使用本工具产生的一切后果由使用者自行承担。

## 核心功能

### 自动播放视频
- 自动播放课程视频，可调倍速（1x ~ 2x）
- 断点续播：刷新后从上次进度继续
- 跳过已看：已完成的视频自动跳过
- 完成阈值可调（90% / 95% / 100%）

### 智能答题（辅助参考）
- 视频中插题 / 章节测验自动识别作答
- AI 视觉识别截图 + 文本双重通道
- 答案附带详细解析，**确认后再提交**
- 提交后自动核对判卷结果，标记对错

### 多任务点队列
- 一页多个任务点（视频 + 作业混排）自动排队处理
- 完成后自动切换知识点 / 进入下一节
- 纯文本页自动跳过

### 自动讨论
- AI 生成课程相关讨论帖，一键发表
- 可设每门课发帖上限，按课程独立统计
- 支持自动点赞

### 作答历史
- 完整记录每次作答（题目 / 答案 / 解析 / 对错）
- 支持筛选（日期 / 来源 / 对错 / 关键词）
- 导出 JSON / CSV / HTML

### 其他
- 字体反爬解码（学习通字体加密自动还原）
- 多 AI 供应商支持（5+1 API / 自定义接口）
- 设置面板、自动更新、首次使用引导

## 快速开始

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 打开[安装页面](https://five-plus-one.github.io/CourseFlow/)，点击「一键安装脚本」
3. 在 Tampermonkey 弹窗中确认安装
4. 打开学习通课程页面，点击「课舟 · 开始学习」

> 已安装用户无需手动更新，脚本会在新版本发布后自动更新。

## 兼容平台

| 平台 | 域名 | 状态 |
|------|------|------|
| 学习通 | mooc1.xuexitong.com | ✅ 主要支持 |
| 学习通 | mooc2-ans.xuexitong.com | ✅ |
| 超星 | mooc1.chaoxing.com | ✅ |
| 超星 | mooc2-ans.chaoxing.com | ✅ |
| 讨论区 | groupweb.xuexitong.com | ✅ |

## 从源码构建

```bash
# 无外部依赖，只需 Node.js
node build.js

# 产物在 dist/courseflow.user.js
```

## 项目结构

```
CourseFlow/
├── CLAUDE.md              # 项目约定
├── build.js               # 构建脚本（零依赖）
├── .github/
│   ├── workflows/         # CI：自动构建发版 + Pages 部署
│   └── pages/             # GitHub Pages 安装页
├── docs/                  # 设计文档与调研笔记
├── research/              # 页面诊断脚本（控制台采集 DOM）
├── src/
│   ├── core/              # 核心模块（配置/AI/UI/调度）
│   └── adapters/
│       └── xuexitong/     # 学习通适配器
└── dist/                  # 构建产物（gitignore）
```

## 设计理念

- **辅助而非替代**：确认弹窗让你掌握最终决策，AI 答案仅供参考
- **真实可信**：不伪造进度、不跳过必要学习环节
- **透明可控**：完整日志、作答历史、所有操作可追溯
- **轻量专注**：零依赖、单文件、Tampermonkey 原生运行

## 反馈与支持

- 🐛 [提交 Issue](https://github.com/five-plus-one/CourseFlow/issues) 报告 bug 或建议
- 📧 联系作者：[r-l.ink/contact](https://r-l.ink/contact)
- 📦 [开源仓库](https://github.com/five-plus-one/CourseFlow)

---

<div align="center">
  <sub>本工具仅供学习交流，请遵守学校相关规定 · Made with care</sub>
</div>
