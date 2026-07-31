require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Phục vụ các file tĩnh (html, css, js) trong thư mục hiện tại
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
    try {
        const { systemPrompt, userPrompt } = req.body;

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Missing GEMINI_API_KEY in .env file.' });
        }

        const model = 'gemini-3.1-flash-lite';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

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
                generationConfig: {
                    temperature: 0.2
                }
            })
        });

        const j = await response.json();
        if (j.error) {
            throw new Error(j.error.message);
        }

        res.json({ result: j.candidates[0].content.parts[0].text });

    } catch (error) {
        console.error('LLM API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Make sure to set GEMINI_API_KEY in the .env file.`);
});
