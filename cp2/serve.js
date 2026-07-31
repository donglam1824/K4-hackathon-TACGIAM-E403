// Server tĩnh nhỏ cho cp2/ — đọc .env (không commit) và tự điền GEMINI_API_KEY vào trang qua /env.js.
// Không cần cài package nào (chỉ dùng module built-in của Node).
// Chạy: node serve.js   (từ trong thư mục cp2/)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8787;

function loadEnv() {
    const envPath = path.join(ROOT, '.env');
    const env = {};
    if (!fs.existsSync(envPath)) return env;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
    return env;
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
    if (req.url === '/env.js') {
        const env = loadEnv();
        const key = env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE' ? env.GEMINI_API_KEY : '';
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        res.end(`window.GEMINI_API_KEY = ${JSON.stringify(key)};`);
        return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    filePath = path.join(ROOT, decodeURIComponent(filePath));

    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`CP2 prototype: http://localhost:${PORT}`);
    console.log('Nếu .env có GEMINI_API_KEY hợp lệ, ô "API key" trên trang sẽ tự điền sẵn.');
});
