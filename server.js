/**
 * 命理格局测试 - 代理服务器
 * 
 * 功能：
 * 1. 提供静态文件服务（geju-test.html）
 * 2. 代理千问大模型 API 请求，保护 API Key 不暴露
 * 
 * 使用方法：
 * 1. 安装 Node.js（https://nodejs.org）
 * 2. 运行：node server.js
 * 3. 浏览器访问：http://localhost:3000
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============ 配置区 ============
const API_KEY = 'sk-ws-H.EPHXIMM.Wnc0.MEMCIG0v_cqCKyWYFAxMbAA7-druWdDoDkSDii4iF_RsBB_GAh8O-aJPHm85v_PesHqmvGCdlSDRuHt1Q2ykTOjx-NH-';
const QWEN_HOST = 'dashscope.aliyuncs.com';
const QWEN_PATH = '/api/v1/services/aigc/text-generation/generation';
const PORT = 3000;
// ============ 配置区结束 ============

const server = http.createServer((req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 处理 API 请求
    if (req.url === '/api/comment' && req.method === 'POST') {
        handleAIComment(req, res);
        return;
    }

    // 处理静态文件
    if (req.url === '/' || req.url === '/geju-test.html') {
        serveFile(res, 'geju-test.html', 'text/html; charset=utf-8');
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
});

/**
 * 处理 AI 评语请求
 */
function handleAIComment(req, res) {
    let body = '';
    
    req.on('data', (chunk) => {
        body += chunk.toString();
    });

    req.on('end', () => {
        console.log('[Server] 收到请求，body 长度:', body.length);
        console.log('[Server] body 前200字符:', body.substring(0, 200));

        if (!body || body.trim() === '') {
            console.error('[Server] body 为空');
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '请求体为空' }));
            return;
        }

        try {
            const parsed = JSON.parse(body);
            console.log('[Server] 解析成功，包含字段:', Object.keys(parsed));
            
            const { prompt, systemPrompt } = parsed;

            if (!prompt) {
                console.error('[Server] 缺少 prompt 字段');
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '缺少 prompt 字段' }));
                return;
            }

            const apiPayload = JSON.stringify({
                model: 'qwen-turbo',
                input: {
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt || '你是一位精通传统子平八字的资深命理师。'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                parameters: {
                    temperature: 0.7,
                    topP: 0.7,
                    resultFormat: 'message'
                }
            });

            // 使用 https 模块请求千问 API
            const options = {
                hostname: QWEN_HOST,
                path: QWEN_PATH,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Length': Buffer.byteLength(apiPayload)
                },
                timeout: 60000
            };

            console.log('[API] 正在请求千问大模型...');
            console.log('[API] POST https://' + QWEN_HOST + QWEN_PATH);

            const apiReq = https.request(options, (apiRes) => {
                let apiResponse = '';
                apiRes.on('data', (chunk) => {
                    apiResponse += chunk.toString();
                });
                apiRes.on('end', () => {
                    console.log('[API] 千问响应状态:', apiRes.statusCode);
                    console.log('[API] 千问响应前200字符:', apiResponse.substring(0, 200));
                    
                    res.writeHead(apiRes.statusCode, {
                        'Content-Type': 'application/json; charset=utf-8'
                    });
                    res.end(apiResponse);
                });
            });

            apiReq.on('error', (err) => {
                console.error('[API Error]', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'API 调用失败', message: err.message }));
            });

            apiReq.on('timeout', () => {
                apiReq.destroy();
                res.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'API 调用超时' }));
            });

            apiReq.write(apiPayload);
            apiReq.end();

        } catch (err) {
            console.error('[Parse Error]', err.message);
            console.error('[Parse Error] 原始 body:', body.substring(0, 300));
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '请求格式错误', message: err.message }));
        }
    });
}

/**
 * 提供静态文件服务
 */
function serveFile(res, filename, contentType) {
    const filePath = path.join(__dirname, filename);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('文件读取失败');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

server.listen(PORT, () => {
    console.log('========================================');
    console.log('  命理格局测试 - 服务器已启动');
    console.log('  访问地址: http://localhost:' + PORT);
    console.log('  按 Ctrl+C 停止服务');
    console.log('========================================');
});
