// ========== 学习通 DOM 选择器 ==========
// 全部来自实测诊断（docs/xuexitong-research.md）

const XXT_SELECTORS = {
    // ---- 主文档 ----
    // 视频 / 测验 Tab
    TAB_VIDEO: '#dct1',
    TAB_QUIZ: '#dct2',

    // 卡片 iframe（内容都在这里面）
    CARD_IFRAME: 'iframe#iframe',

    // 上一节 / 下一节
    BTN_NEXT: '#prevNextFocusNext',
    BTN_PREV: '#prevNextFocusPrev',

    // 确认提交弹窗
    CONFIRM_POPUP: '#workpop',
    CONFIRM_OK: '#popok',
    CONFIRM_CANCEL: '#popno',

    // 课程标识
    CUR_COURSE: '#curCourseId',
    CUR_CHAPTER: '#curChapterId',
    CUR_CPI: '#curCpi',
    CUR_CLAZZ: '#curClazzId',
    CARD_COUNT: '#cardcount',

    // ---- 视频（在卡片 iframe 内，可能再嵌一层）----
    VIDEO_JOB_ICON: '.ans-job-icon.ans-job-video',
    VIDEO_CONTAINER: '.ans-attach-ct.videoContainer',
    VIDEO_PLAYER_IFRAME: 'iframe.ans-attach-online',
    VIDEO_ELEMENT: 'video#video_html5_api',
    VIDEO_ELEMENT_FALLBACK: 'video',
    VIDEO_JS_BOX: '#video.video-js',

    // 任务点状态 class
    JOB_FINISHED: 'ans-job-finished',
    JOB_CLEAR: 'ans-job-icon-clear',

    // ---- 多任务点枚举（一页多个 .ans-attach-ct，实测 2026-10）----
    // 每个任务点：div.ans-attach-ct > div.ans-job-icon + iframe[src*="/ananas/modules/…"]
    TASK_CONTAINER: '.ans-attach-ct',
    TASK_ICON: '.ans-job-icon',
    TASK_IFRAME_VIDEO: 'iframe[src*="/ananas/modules/video/"]',
    TASK_IFRAME_WORK: 'iframe[src*="/ananas/modules/work/"]',
    // 完成判定金标准（跨类型统一，作业图标不带类型 class，只能靠 aria-label）
    JOB_ARIA_DONE: '任务点已完成',
    JOB_ARIA_UNDONE: '任务点未完成',
    // 知识点 Tab（多任务点页里 #dct1/#dct2 是「知识点1/知识点2」切换，不是视频/测验）
    KNOWLEDGE_TABS: ['#dct1', '#dct2', '#dct3', '#dct4'],

    // ---- 测验（在更深 iframe#frame_content）----
    QUIZ_FRAME: 'iframe#frame_content',
    QUIZ_ROOT: '#ZyBottom',
    QUIZ_TYPE_HEAD: '#ZyBottom h3.newTestType, h3.newTestType',

    // 上限 / 验证码弹窗
    LIMIT_POPUP: '.maskDiv.jobCountDiv, #chapterVerificationCode, .jobCountDiv',
    LIMIT_TEXT: '.videoLimitTip, .jobLimitTip',

    // ---- 视频中插题（视频播放中途弹出的答题层）----
    // 文案：「单选题 / 共 1 题，已答对 0 题」+ 选项 + 提交
    MID_QUIZ_ROOT: '.x-container, .ans-videoquiz, [class*="videoquiz"], [class*="quiz"], [class*="Quiz"]',
    MID_QUIZ_HINT: '单选题|多选题|判断题|共\\s*\\d+\\s*题|已答对',
    MID_QUIZ_SUBMIT: '提交',
};

// 题型编码（addStudentWorkNew 的 answertype 字段）
const XXT_ANSWER_TYPE = {
    0: 'single',   // 单选
    1: 'multi',    // 多选
    2: 'blank',    // 填空（待确认）
    3: 'judge',    // 判断
};
