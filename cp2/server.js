require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Phục vụ các file tĩnh (html, css, js) trong thư mục hiện tại
app.use(express.static(__dirname));

// Lưu lịch sử học theo từng user — đặt NGOÀI thư mục cp2/ để express.static
// (phục vụ toàn bộ __dirname) không bao giờ trả file dữ liệu này qua HTTP.
const USER_DATA_DIR = path.join(__dirname, '..', 'user-data');
if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });

function studentFilePath(studentId) {
    const safeId = String(studentId || '').trim().replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 64);
    if (!safeId) return null;
    return path.join(USER_DATA_DIR, `${safeId}.json`);
}

app.get('/api/logs/:studentId', (req, res) => {
    const filePath = studentFilePath(req.params.studentId);
    if (!filePath) return res.status(400).json({ error: 'Invalid studentId' });

    if (!fs.existsSync(filePath)) return res.json({ logs: [] });
    try {
        const logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json({ logs });
    } catch (e) {
        res.status(500).json({ error: 'Could not read learning history: ' + e.message });
    }
});

app.post('/api/logs/:studentId', (req, res) => {
    const filePath = studentFilePath(req.params.studentId);
    if (!filePath) return res.status(400).json({ error: 'Invalid studentId' });

    const entry = req.body && req.body.entry;
    if (!entry || typeof entry !== 'object') return res.status(400).json({ error: 'Missing entry' });

    let logs = [];
    if (fs.existsSync(filePath)) {
        try { logs = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { logs = []; }
    }
    logs.push(entry);
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
    res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { systemPrompt, userPrompt, jsonMode } = req.body;

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Missing GEMINI_API_KEY in .env file.' });
        }

        const model = 'gemini-3.1-flash-lite';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const generationConfig = {
            temperature: 0.2,
            maxOutputTokens: 4096
        };
        if (jsonMode) generationConfig.responseMimeType = 'application/json';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                contents: [
                    { role: 'user', parts: [{ text: userPrompt }] }
                ],
                generationConfig
            })
        });

        const j = await response.json();
        if (j.error) {
            throw new Error(j.error.message);
        }

        const candidate = j.candidates && j.candidates[0];
        const text = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;

        if (!text) {
            const reason = (j.promptFeedback && j.promptFeedback.blockReason) || (candidate && candidate.finishReason) || 'unknown';
            throw new Error(`Gemini không trả về nội dung (finishReason/blockReason: ${reason}). Thử rút ngắn đoạn tài liệu tham chiếu hoặc thử lại.`);
        }

        res.json({ result: text });

    } catch (error) {
        console.error('LLM API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Make sure to set GEMINI_API_KEY in the .env file.`);
});
