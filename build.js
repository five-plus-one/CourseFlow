// ========== 课舟 构建脚本（零依赖） ==========
// 合并 src/ 下模块，输出 dist/courseflow.user.js
// 用法: node build.js

const fs = require('fs');
const path = require('path');

// terser：优先本项目 node_modules，其次 AI-Marker-Suite 的
function loadTerser() {
    const candidates = [
        path.join(ROOT, 'node_modules', 'terser'),
        'D:\\5plus1\\DEV\\AI-Marker-Suite\\Core\\node_modules\\terser',
        process.env.MIMO_NODE_MODULES ? path.join(process.env.MIMO_NODE_MODULES, 'terser') : '',
    ].filter(Boolean);
    for (const p of candidates) {
        try { return require(p); } catch (e) { }
    }
    try { return require('terser'); } catch (e) { return null; }
}

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const MODULES = [
    'core/config.js',
    'core/log.js',
    'core/history.js',
    'core/providers.js',
    'core/font-decode.js',
    'core/capture.js',
    'core/ui-confirm.js',
    'core/ui-about.js',
    'core/ui-history.js',
    'core/oobe.js',
    'core/discuss.js',
    'adapters/xuexitong/selectors.js',
    'adapters/xuexitong/adapter.js',
    'adapters/xuexitong/quiz.js',
    'core/ai-engine.js',
    'core/ui.js',
    'core/main.js',
];

function readConfig() {
    const cfgPath = path.join(SRC, 'core', 'config.js');
    const text = fs.readFileSync(cfgPath, 'utf8');
    const ver = (text.match(/VERSION:\s*'([^']+)'/) || [])[1] || '0.0.0';
    return { version: ver };
}

function buildHeader(version) {
    const matches = [
        '*://mooc1.xuexitong.com/*',
        '*://mooc1.chaoxing.com/*',
        '*://mooc2-ans.xuexitong.com/*',
        '*://mooc2-ans.chaoxing.com/*',
        '*://groupweb.xuexitong.com/*',
        '*://groupweb.chaoxing.com/*',
        '*://i.xuexitong.com/*',
        '*://i.chaoxing.com/*',
    ];
    const lines = [
        '// ==UserScript==',
        `// @name         课舟 · 学习通助手`,
        `// @namespace    https://github.com/five-plus-one/CourseFlow`,
        `// @version      ${version}`,
        `// @description  网课自动学习：自动播放视频、LLM 自动答题（学习通/超星）`,
        `// @author       five-plus-one`,
        ...matches.map(m => `// @match        ${m}`),
        `// @grant        GM_xmlhttpRequest`,
        `// @grant        GM_setValue`,
        `// @grant        GM_getValue`,
        `// @grant        GM_registerMenuCommand`,
        `// @connect      *`,
        `// @run-at       document-idle`,
        `// @updateURL    https://five-plus-one.github.io/CourseFlow/courseflow.user.js`,
        `// @downloadURL  https://five-plus-one.github.io/CourseFlow/courseflow.user.js`,
        `// ==/UserScript==`,
        '',
    ];
    return lines.join('\n');
}

function main() {
    const { version } = readConfig();
    if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

    let body = buildHeader(version);
    body += '\n(function () {\n\'use strict\';\n\n';

    for (const rel of MODULES) {
        const p = path.join(SRC, rel);
        if (!fs.existsSync(p)) {
            console.error('✗ 缺少模块:', rel);
            process.exit(1);
        }
        const code = fs.readFileSync(p, 'utf8');
        body += `\n// ===== ${rel} =====\n`;
        body += code;
        body += '\n';
        console.log('  +', rel);
    }

    body += '\n})();\n';

    // 压缩 IIFE（保留 UserScript header 可读）— 与 AI-Marker-Suite 一致
    const out = path.join(DIST, 'courseflow.user.js');
    const terser = loadTerser();
    if (terser && terser.minify) {
        terser.minify(body, {
            compress: { passes: 2, drop_console: false },
            mangle: { toplevel: false },
            format: { comments: false },
        }).then(minified => {
            if (minified.error) {
                console.error('✗ 压缩失败:', minified.error);
                process.exit(1);
            }
            const header = buildHeader(version);
            const output = header + minified.code;
            fs.writeFileSync(out, output, 'utf8');
            const rawKB = (Buffer.byteLength(body, 'utf8') / 1024).toFixed(1);
            const minKB = (Buffer.byteLength(minified.code, 'utf8') / 1024).toFixed(1);
            const totalKB = (fs.statSync(out).size / 1024).toFixed(1);
            console.log(`\n✓ 构建完成 → dist/courseflow.user.js  (v${version}, ${totalKB} KB, 压缩 ${rawKB}→${minKB} KB)`);
        }).catch(e => {
            console.error('✗ 压缩异常:', e.message);
            process.exit(1);
        });
    } else {
        fs.writeFileSync(out, body, 'utf8');
        const kb = (fs.statSync(out).size / 1024).toFixed(1);
        console.log(`\n✓ 构建完成（未压缩，terser 不可用）→ dist/courseflow.user.js  (v${version}, ${kb} KB)`);
    }
}

main();
