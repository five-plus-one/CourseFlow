# 学习通调研结论 v2（基于实测数据）

> 数据来源：`kezhou-deep-muh15fbo/156oj.txt`、`kezhou-net-muh16zkk.txt`、`kezhou-studentstudyAjax.html`
> 多任务点补测：`kezhou-tasks-mus0tvhw.txt`、`kezhou-tasks-mus0ui44.txt`（2026-10-03）

## 一、完整 iframe 地图（已实测）

```
MAIN  studentstudy (jQuery 1.7.2)
├── Tab: li#dct1 cardid=1246129991 「视频」
│        li#dct2 cardid=1246129993 「章节测验」
│        切换: changeDisplayContent(1|2, 2, chapterId, courseId, clazzid, '')
│        cardcount=2
│
├── iframe#iframe  →  /mooc-ans/knowledge/cards?knowledgeid=<chapterId>&num=N
│   │                 num=0 视频卡片   num=1 测验卡片
│   │
│   ├── 【视频分支】
│   │   ├── div.ans-attach-ct.videoContainer.ans-job-finished|.ans-job-icon-clear
│   │   ├── div.ans-job-icon.ans-job-video   ← 任务点状态
│   │   │     .ans-job-icon-clear = 未完成
│   │   │     .ans-job-finished  = 已完成
│   │   └── iframe.ans-attach-online.ans-insertvideo-online
│   │         → /ananas/modules/video/index.html?v=...
│   │         └── div#video.video-js.vjs-default-skin   ← video.js 播放器
│   │             └── video#video_html5_api             ← 真正的 video 元素
│   │                 duration=855s  playbackRate 可调 2x/1.5x/1.2x
│   │
│   └── 【测验分支】
│       └── iframe (中间层)
│           └── iframe#frame_content   title=「查看已批阅作业」或作答页
│               ├── div#ZyBottom
│               │   └── h3.newTestType   「一. 多选题（共1题）」
│               ├── 题干 / 选项 / 我的答案 / AI讲解
│               └── 字体: @font-face marking.ttf
│
├── #prevNextFocusNext / #prevNextFocusPrev   ← 上一节/下一节
├── #workpop  确认提交弹窗 (a#popok / a#popno)
└── 右侧目录 #coursetree
```

**卡片 ID 示例**（随章节变化，从 studentstudyAjax 解析）：
- 视频卡片 `cardid="1246129991"`
- 测验卡片 `cardid="1246129993"`

## 一b、多任务点同界面形态（已实测 2026-10）

部分章节**一个界面并排多个任务点**（视频 + 作业混排），不是「一视频一测验」两卡结构。

```
MAIN  studentstudy
├── Tab: li#dct1 「1知识点1」 / li#dct2 「2知识点2」   ← 注意：是知识点切换，不是视频/测验 Tab！
│
├── iframe(cards) → /mooc-ans/knowledge/cards?...&num=0
│   └── div#pageDiv.ans-cc
│       ├── p > div.ans-attach-ct.videoContainer          ← 任务点 A：视频（未完成）
│       │   ├── div.ans-job-icon.ans-job-video.ans-job-icon-clear
│       │   │     aria-label="任务点未完成"
│       │   ├── iframe[src*="/ananas/modules/video/index.html"]
│       │   │     jobid="1560842944387137"  data="{objectid,name,type,jobid,...}"
│       │   │     └── (嵌套 iframe) → video#video_html5_api
│       │   └── div#topicList
│       │
│       └── p > div.ans-attach-ct.ans-job-finished        ← 任务点 B：作业（已完成）
│           ├── div.ans-job-icon                           ← 注意：无类型 class！
│           │     aria-label="任务点已完成"
│           └── iframe[src*="/ananas/modules/work/index.html"]
│                 jobid="work-dc3d472ac3274f468d1cf90fce23af39"
│                 data="{workid,title,worktype,mid,jobid,...}"
│                 └── iframe → /mooc-ans/api/work?... → div#ZyBottom + div.singleQuesId
```

**四种状态 DOM 对照（金标准）**：

| 状态 | 容器 class | 图标 class | aria-label |
|---|---|---|---|
| 视频未完成 | `videoContainer` | `ans-job-video ans-job-icon-clear` | 任务点未完成 |
| 作业未完成 | （无额外 class） | （只有 `ans-job-icon`） | 任务点未完成 |
| 作业已完成 | **`ans-job-finished`** | （只有 `ans-job-icon`） | **任务点已完成** |
| 视频已完成 | （推断同作业：容器加 `ans-job-finished`） | （推断去掉 clear） | 任务点已完成 |

**关键结论**：
1. **`aria-label` 是跨类型统一的完成判定**（"任务点未完成"/"任务点已完成"）。作业图标**不带类型 class**（没有 `ans-job-work`），不能靠 class 判类型
2. **类型判定看 iframe src**：`/ananas/modules/video/` → video，`/ananas/modules/work/` → work
3. **jobid 在 iframe 属性上**：video 是纯数字（`1560842944387137`），work 带前缀（`work-<hex>`）
4. **`#dct1/#dct2` 在这类页是知识点 Tab**（"1知识点1"/"2知识点2"），旧代码 `switchTab('quiz')` 点 `#dct2` 语义是错的
5. 旧版一页一视频一测验（`#dct1`「视频」/`#dct2`「章节测验」）继续走 legacy 路径

## 二、视频任务点规则（页面原文）

> 完成条件观看时长需 ≥ 总时长的 90%
> 未完成任务点前，当前视频不可拖拽、观看时不可离开或将页面最小化

另有上限弹窗：
- 「今日视频观看时长已达上限，您可继续观看视频，但无法完成任务点」
- 「今日视频任务点完成数已达上限」

**自动化含义**：
- 进度 = `video.currentTime / video.duration`，目标 ≥ 0.9
- 不能盲拉 `currentTime` 跳进度（未完成前可能被禁）
- 倍速可用（1.2x/1.5x/2x），但可能触发风控，建议默认 1x～1.5x
- 必须处理「已达上限」弹窗，识别后停止并提示用户

## 三、字体反爬真相（重要）

| 场景 | text/复制 |
|------|-----------|
| **已批阅/查看答案**（#frame_content title=查看已批阅作业） | ✅ **干净**（实测 innerText 正常） |
| **作答中**（用户手动复制） | ❌ 乱码（下列→下宭宯…） |

字体线索：
- cards iframe: `@font-face fzlantingheis-el-gbregular → fonts/_-webfont.ttf`
- frame_content: `@font-face marking.ttf`、`din` (DINMedium)

**推断**：乱码来自作答页的自定义字体映射（字形对、码位错），或 copy 事件被拦截篡改。已批阅页不用该字体，所以干净。

**课舟策略**：
1. 优先读 `textContent`（若已批阅/接口侧干净则直接用）
2. 作答页若乱码 → 解析 `_-webfont.ttf` 建码位映射还原
3. 备选：调 `doHomeWorkNew` / `selectWorkQuestionYiPiYue` 拿接口原文
4. 不依赖用户复制

## 四、接口清单

| 状态 | 接口 | 说明 |
|------|------|------|
| ✅ | `GET /mooc-ans/mycourse/studentstudyAjax` | 详情页外壳（含 cardid、tab 切换） |
| ✅ | `GET /mooc-ans/knowledge/cards?knowledgeid=&num=0\|1` | 视频/测验卡片 iframe |
| ✅ | `GET /mooc-ans/mycourse/studentstudycourselist` | 右侧章节树 |
| ✅ | `GET /mooc-ans/edit/validatejobcount?nodeid=` | 任务点校验，返回 `true` |
| ✅ | `GET /fystat-ans/log/setlog?personid=&courseId=&classId=&encode=&chapterId=` | 学习日志，返回 `'success'` |
| ✅ | `GET /mooc-ans/work/doHomeWorkNew?...&submit=false&jobid=work-*` | 打开测验（控制台见过） |
| ✅ | `GET /mooc-ans/work/selectWorkQuestionYiPiYue?...` | 拉题目（控制台见过） |
| ✅ | `GET /mooc-ans/multimedia/log/a/<userid>/<token>` | **视频进度上报**（见下） |
| ✅ | `POST /mooc-ans/work/addStudentWorkNew?...&tempsave=1` | **答题暂时保存**（见下） |

`doHomeWorkNew` 参数样例：
```
courseId=…&workAnswerId=…&workId=…&api=1&knowledgeid=…&classId=…
&oldWorkId=…&jobid=work-…&isphone=false&submit=false&enc=…&cpi=…&mooc2=1
&skipHeader=true&originJobId=work-…&wMicroNodeId=0
```

## 五、关键 DOM / 字段速查

| 目标 | 选择器 |
|------|--------|
| 视频元素 | `iframe#iframe → iframe.ans-attach-online → video#video_html5_api` |
| 播放器控件 | 同层 `div#video.video-js`（含播放/倍速按钮） |
| 任务点状态 | `.ans-job-icon.ans-job-video`（`ans-job-finished` / `ans-job-icon-clear`） |
| 测验容器 | `iframe#iframe → iframe → iframe#frame_content` |
| 题型标题 | `#ZyBottom h3.newTestType` |
| 上一节/下一节 | `#prevNextFocusPrev` / `#prevNextFocusNext` |
| 确认提交 | `#workpop a#popok` |
| 课程标识 | `#curCourseId` `#curClazzId` `#curCpi` `#curChapterId` |
| 任务进度 | `validatejobcount` + 章节树 |

## 六、课舟适配器接口映射

| 课舟 API | 实现 |
|----------|------|
| `shouldInitialize()` | hostname 匹配 `mooc1.*/mooc2-ans.*` + path 含 `studentstudy` |
| `detectVideoPage()` | 递归找 `video#video_html5_api` 或 `.ans-job-video` |
| `detectQuizPage()` | 递归找 `#frame_content` 或 `#ZyBottom` |
| `getVideoState()` | `video.currentTime/duration/paused/playbackRate` |
| `playVideo()` | `video.play()`；可设 `playbackRate` |
| `isVideoJobDone()` | `.ans-job-finished` 存在 或 `currentTime/duration ≥ 0.9` |
| `nextChapter()` | 点 `#prevNextFocusNext` 或调 `PCount.next(...)` |
| `gatherQuestions()` | 遍历 `#frame_content` 题目 DOM（+字体还原） |
| `selectAnswer()` | 点选项 radio/checkbox |
| `saveOrSubmit()` | 点「暂时保存」→ `#popok`（待接口确认后可改为直接 POST） |
| `getProgress()` | `validatejobcount` + 章节树完成标记 |

## 七、关键接口详情（已实测）

### 7.0 视频中插题（播放中途弹出）

```
GET /mooc-ans/question/quiz-validation
  ?classid=…&cpi=…&objectid=<视频objectId>
  &_dc=<时间戳>&eventid=<题事件id>&memberinfo=<hash>
  &answerContent=C
```

响应：`{"rightAnswerCount":1,"msg":"通过","isRight":true,"showTip":true,"showAnswer":0,"percent":95.0,"status":true}`

```
GET /mooc-ans/question/quiz-rightcount?classid=&cpi=&eventid=&memberinfo=
```

**现象**：视频播到某处自动暂停 → 弹出「单选题 / 共 1 题，已答对 0 题」+ 选项 + 提交。
**课舟策略**：检测浮层 → AI 答题 → 点选项 → 点提交（走 UI）。不直接伪造 `answerContent` 请求（`memberinfo` 有签名）。

**补充实测（2026-10-26，用户截图 + 日志）**：
- 答错后浮层**不关闭**，显示红色「回答错误」，底部「提交」按钮仍可点 → **可以换选项重试**
- 该题**不计入课程成绩**（用户确认），因此试错/枚举是安全的
- 旧版 bug：AI 答错后 `isMidQuizResolved()` 恒为 false，而 AI 缓存里就是那个错误答案 → 每轮 tick「命中缓存 → 提交同一个错误答案」无限循环

**课舟实现（v0.8.8）**：
1. 同一答案绝不重复提交（每题记录 `tried`）
2. 首次用 AI 答案；平台判错 → 换下一个没试过的答案
3. 枚举顺序：单选/判断按选项 A→B→C→D，多选先单字母再双字母
4. 判对 → 点「继续学习」；试满 10 个仍错 → 停止自动作答并提示用户手动选择
5. 只有 `running`（已点开始）时才应答，暂停后不会继续连续提交
6. 设置面板新增「插题作答方式」：
   - `AI 优先`（默认）：先 AI 答案，答错后自动枚举
   - `直接枚举`：不调 AI，从 A 开始逐个试（中插题不计成绩时最省额度）

### 7.1 答题保存 `addStudentWorkNew`

```
POST /mooc-ans/work/addStudentWorkNew
  ?_classId=…&courseid=…&token=…&totalQuestionNum=…&ua=pc
  &formType=post&saveStatus=1&version=1&tempsave=1
```

请求体（x-www-form-urlencoded）：
```
pyFlag=1
courseId=…  classId=…  api=1
workAnswerId=55945880  answerId=55945880
totalQuestionNum=<hash>  fullScore=100.0
knowledgeid=<chapterId>
oldWorkId=<hash>  jobid=work-<hash>  workRelationId=…
enc=  enc_work=<token>
userId=…  cpi=…
randomOptions=false  isAccessibleCustomFid=0

answer<qid>=<答案>  answertype<qid>=<题型>
answer215865826=A      answertype215865826=0   ← 单选，答案 A
answer215865827=       answertype215865827=1   ← 多选，答案 ABC（连写）
answer215865828=true   answertype215865828=3   ← 判断，true/false
answerwqbid=215865826,215865827,215865828,
```

响应：`{"msg":"保存成功！","status":true}`

**题型编码**（待更多样本确认）：
| answertype | 猜测 | 答案格式 |
|------------|------|----------|
| 0 | 单选 | `A` / `B` / `C` / `D` |
| 1 | 多选 | `ABC`（字母连写） |
| 2 | 填空? | ? |
| 3 | 判断 | `true` / `false` |

**课舟策略**：v1 优先**点 UI 按钮**（暂时保存 → 确认弹窗），不直接伪造请求（`token`/`enc`/`totalQuestionNum` 有签名）。等 UI 路径稳了再考虑 API 直调。

### 7.2 视频进度 `multimedia/log/a`

```
GET /mooc-ans/multimedia/log/a/<userid>/<token>
  ?clazzId=…&playingTime=<累计秒>&duration=<总长秒>&clipTime=0_<总长>
  &objectId=<视频对象id>&otherInfo=nodeId_<chapterId>-cpi_<cpi>-rt_d-ds_0-ff_1-be_0_0-vt_1-v_6-enc_<hash>
  &courseId=…&jobid=<任务id>&userid=<uid>
  &isdrag=2|3&view=pc&enc=<每次变>&rt=0.9
  &videoFaceCaptureEnc=<hash>&dtype=Video&_t=<时间戳>
  &attDuration=<总长>&attDurationEnc=<hash>&courseEngineInfo=false
```

实测 playingTime 序列：20 → 45 → 66 → 73 → 74 → 75（约每 15～30 秒一次，`isdrag` 2/3 交替）

**要点**：
- `rt=0.9` 就是「完成需 ≥90%」的参数
- `enc` / `videoFaceCaptureEnc` / `attDurationEnc` 每次请求都变（播放器算的签名）
- `jobid` 是任务点 id
- `isdrag`：2/3（播放/心跳？）

**课舟策略**：**不要伪造这个接口**。只要正常 `video.play()`，播放器自己会上报。课舟只负责：
1. 找到 `video#video_html5_api`
2. `play()` + 可选设 `playbackRate`
3. 监听 `timeupdate`，`currentTime/duration ≥ 0.9` 即任务点应完成
4. 处理「已达上限」弹窗

### 7.3 视频初始化相关（了解即可）

| 接口 | 作用 |
|------|------|
| `GET /mooc-ans/richvideo/initdatawithviewerV2?mid=&cpi=&classid=&courseid=` | 视频初始化 |
| `GET /ananas/status/<objectId>?k=<fid>` | 视频状态 |
| `GET /ananas/getpoints?courseid=&mid=` | 视频打点 |
| `GET /mooc-ans/richvideo/allsubtitle?mid=&objectid=&courseid=` | 字幕 |
| `GET /mooc-ans/chapter-document/marklists?...&cardid=` | 文档标注 |

### 7.4 卡片 id（随章节变化，从 studentstudyAjax 解析）

| 卡片 | 示例 cardid |
|------|-------------|
| 视频 | 1246129991 / 1246129999 |
| 测验 | 1246129993 / 1246130000 |

## 八、课舟实现原则（定稿）

1. **视频**：操作真实 `<video>` 元素，让平台播放器自己上报进度。不伪造 `multimedia/log/a`
2. **答题**：v1 走 UI（点选项 → 暂时保存 → 确认弹窗）。API 直调留作 v2
3. **题面**：读 `#frame_content` 的 `textContent`；作答页若乱码再做字体映射
4. **进度**：`.ans-job-finished` / `validatejobcount` / 章节树
5. **风险控制**：识别「今日上限」「验证码」弹窗，停下来交给用户，不硬闯
