/**
 * 本地服务器 - 命理格局测试
 * 
 * 功能：
 * 1. 提供静态文件服务（geju-test.html）
 * 2. 代理 AI 评语请求到千问大模型
 * 
 * 使用方法：
 * 1. 启动服务器：node server.js
 * 2. 访问地址：
 *    - 本机：http://localhost:3002
 *    - 局域网其他设备：http://你的电脑IP:3002
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ========== 配置 ==========
const PORT = 3002;
const HOST = '0.0.0.0';

// API Key - 可通过环境变量设置：API_KEY=sk-xxx node server.js
const API_KEY = process.env.API_KEY || 'sk-ws-H.EPHXIMM.Wnc0.MEMCIG0v_cqCKyWYFAxMbAA7-druWdDoDkSDii4iF_RsBB_GAh8O-aJPHm85v_PesHqmvGCdlSDRuHt1Q2ykTOjx-NH-';
const QWEN_HOST = 'dashscope.aliyuncs.com';
const QWEN_PATH = '/api/v1/services/aigc/text-generation/generation';

// ========== 静态文件服务 ==========
function serveStaticFile(req, res) {
    if (req.url === '/' || req.url === '/geju-test.html') {
        const filePath = path.join(__dirname, 'geju-test.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('服务器错误');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
        return true;
    }
    return false;
}

// ========== AI 评语代理 ==========
function handleApiComment(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const { prompt, systemPrompt } = JSON.parse(body);

            if (!prompt) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '缺少 prompt 字段' }));
                return;
            }

            // 设置 CORS 头
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            });

            // 构造千问 API 请求
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

            // 使用 HTTPS 调用千问 API
            const apiReq = https.request({
                hostname: QWEN_HOST,
                path: QWEN_PATH,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Length': Buffer.byteLength(apiPayload)
                },
                timeout: 30000
            }, (apiRes) => {
                let apiResponse = '';
                apiRes.on('data', (chunk) => {
                    apiResponse += chunk.toString();
                });
                apiRes.on('end', () => {
                    console.log('[API] 响应状态:', apiRes.statusCode);
                    res.end(apiResponse);
                });
            });

            apiReq.on('error', (error) => {
                console.error('[API Error]', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API 调用失败', message: error.message }));
            });

            apiReq.on('timeout', () => {
                apiReq.destroy();
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API 调用超时' }));
            });

            apiReq.write(apiPayload);
            apiReq.end();

        } catch (error) {
            console.error('[Parse Error]', error.message);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '请求解析失败', message: error.message }));
        }
    });
}

// ========== 创建服务器 ==========
const server = http.createServer((req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

    // 处理 CORS 预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // API 路由
    if (req.url === '/api/comment') {
        handleApiComment(req, res);
        return;
    }

    // 静态文件
    if (serveStaticFile(req, res)) {
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 - 页面未找到</h1>');
});

server.listen(PORT, HOST, () => {
    console.log('========================================');
    console.log('  命理格局测试 - 本地服务器已启动');
    console.log('========================================');
    console.log('');
    console.log(`  本机访问: http://localhost:${PORT}`);
    console.log(`  局域网访问: http://你的电脑IP:${PORT}`);
    console.log('');
    console.log('  按 Ctrl+C 停止服务器');
    console.log('========================================');
    
    // 获取本机 IP 地址
    const networkInterfaces = os.networkInterfaces();
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`  本机 IP: ${iface.address}`);
            }
        }
    }
});
