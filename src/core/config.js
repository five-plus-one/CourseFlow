// ========== 课舟 全局配置 ==========
// 版本号唯一来源，构建脚本从这里提取

const SCRIPT_CONFIG = {
    NAME: '课舟',
    ID: 'courseflow',
    VERSION: '0.8.3',

    /** 默认 AI 端点（OpenAI 兼容） */
    DEFAULT_ENDPOINT: 'https://api.ai.five-plus-one.com/v1/chat/completions',
    DEFAULT_MODEL: 'courseflow',

    /** 倒计时结束后动作：submit=自动提交 | save=仅保存 */
    DEFAULT_SUBMIT_MODE: 'submit',

    /** 视频任务点完成阈值（可配置；学习通官方只要求 ≥90%，默认播完 100%） */
    VIDEO_COMPLETE_RATIO: 1.0,

    /** 自动播放默认倍速（默认 1 倍速，不快进） */
    DEFAULT_PLAYBACK_RATE: 1.0,

    /** 上限弹窗文案关键词 */
    LIMIT_KEYWORDS: ['已达上限', '无法完成任务点', '验证码', '为保障您的账号安全'],
};

// 支持的域名 / 页面
const SITE_PATTERNS = [
    '*://mooc1.xuexitong.com/mycourse/studentstudy*',
    '*://mooc1.chaoxing.com/mycourse/studentstudy*',
    '*://mooc2-ans.xuexitong.com/*',
    '*://mooc2-ans.chaoxing.com/*',
    '*://i.xuexitong.com/*',
    '*://i.chaoxing.com/*',
];
