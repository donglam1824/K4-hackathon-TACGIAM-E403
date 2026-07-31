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
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_PROVIDER = process.env.API_PROVIDER || 'openrouter';
const LLM_MODEL = process.env.LLM_MODEL || 'openai/gpt-oss-20b:free';

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
        const { systemPrompt, userPrompt } = req.body;
        if (API_PROVIDER === 'gemini') {
            if (!GEMINI_API_KEY) {
                return res.status(500).json({ error: 'Missing GEMINI_API_KEY in .env file.' });
            }

            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: LLM_MODEL });

            // Gemini expects history in a specific format if we were doing multi-turn,
            // but for a simple system+user prompt we can combine them or use system_instruction
            // if the model supports it. For simplicity, we combine them.
            const prompt = `System Instructions:\n${systemPrompt}\n\nUser Request:\n${userPrompt}`;
            
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            
            return res.json({ result: text });

        } else {
            // Default to OpenRouter
            if (!OPENROUTER_API_KEY) {
                return res.status(500).json({ error: 'Missing OPENROUTER_API_KEY in .env file.' });
            }

            const url = 'https://openrouter.ai/api/v1/chat/completions';
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'TutorAI-QuickCheck'
                },
                body: JSON.stringify({
                    model: LLM_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.2
                })
            });

            const j = await response.json();
            if (j.error) {
                console.error("OpenRouter API Error Response:", j.error);
                throw new Error(j.error.message || JSON.stringify(j.error));
            }
            
            return res.json({ result: j.choices[0].message.content });
        }

    } catch (error) {
        console.error('LLM API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Make sure to set OPENROUTER_API_KEY in the .env file.`);
    });
}

module.exports = app;
