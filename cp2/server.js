require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Phục vụ các file tĩnh (html, css, js) trong thư mục hiện tại
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
    try {
        const { systemPrompt, userPrompt } = req.body;
        
        if (!OPENROUTER_API_KEY) {
            return res.status(500).json({ error: 'Missing OPENROUTER_API_KEY in .env file.' });
        }

        const url = 'https://openrouter.ai/api/v1/chat/completions';
        const model = 'google/gemma-4-31b-it:free'; // OpenRouter Free model

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'TutorAI-QuickCheck'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2
            })
        });

        const j = await response.json();
        if (j.error) {
            throw new Error(j.error.message);
        }
        
        res.json({ result: j.choices[0].message.content });

    } catch (error) {
        console.error('LLM API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Make sure to set OPENROUTER_API_KEY in the .env file.`);
});
