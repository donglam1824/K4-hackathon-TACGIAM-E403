require('dotenv').config();
const fs = require('fs');
const path = require('path');
const systemPrompts = require('../prompts.js');

const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
    console.error('Error: Please provide an API key in .env via OPENROUTER_API_KEY');
    process.exit(1);
}

const goldenSetPath = path.join(__dirname, 'golden-set.json');
const goldenSet = JSON.parse(fs.readFileSync(goldenSetPath, 'utf8'));

async function callLLM(systemPrompt, userPrompt) {
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const headers = { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'TutorAI-Eval'
    };
    const resp = await fetch(url, {
        method: 'POST', headers: headers,
        body: JSON.stringify({
            model: 'openai/gpt-oss-20b:free',
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            temperature: 0.1
        })
    });
    const j = await resp.json();
    if (j.error) throw new Error(j.error.message);
    return j.choices[0].message.content;
}

async function runTest() {
    console.log(`Starting Golden Set Evaluation (${goldenSet.length} cases)...`);
    let passCount = 0;
    let failCount = 0;
    let hardFails = 0;
    const results = [];

    for (const testCase of goldenSet) {
        console.log(`\nRunning Test Case ${testCase.id} [Layer: ${testCase.layer}] - ${testCase.case_type}`);
        
        let status = 'NOT_ENOUGH_EVIDENCE';
        let aiReasoning = '';

        if (!testCase.input_ref || testCase.input_citations.length === 0) {
            status = 'NOT_ENOUGH_EVIDENCE';
            aiReasoning = 'No citation provided.';
        } else {
            try {
                // Step 1: Grade Answer (Assume Question is generic for the test)
                const page = testCase.input_citations[0];
                const sysPrompt = systemPrompts.gradeStudentAnswer.replace(/{PAGE}/g, page);
                const question = `Dựa trên đoạn bạn vừa đọc, trang ${page}: Hãy diễn giải lại nội dung?`;
                const usrPrompt = `Reference:\n${testCase.input_ref}\n\nQuestion asked:\n${question}\n\nStudent answer:\n${testCase.input_student_answer}`;
                
                const resultText = await callLLM(sysPrompt, usrPrompt);
                const parsed = JSON.parse(resultText);
                status = parsed.label;
                aiReasoning = parsed.explain + (parsed.mismatch_detail ? ` | Mismatch: ${parsed.mismatch_detail}` : '');
            } catch (e) {
                status = 'ERROR';
                aiReasoning = e.message;
            }
        }

        const passed = (status === testCase.expected_label);
        if (passed) passCount++;
        else failCount++;

        // Hard Fail Check: Layer 1 or 2 marked as UNDERSTOOD when expected NOT_ENOUGH_EVIDENCE or UNCERTAIN
        if (!passed && (testCase.layer === '①' || testCase.layer === '②') && status === 'UNDERSTOOD') {
            hardFails++;
            console.error('🚨 HARD FAIL: AI approved an answer that lacks evidence or is vague!');
        }

        console.log(`Expected: ${testCase.expected_label} | Actual: ${status}`);
        console.log(`Reasoning: ${aiReasoning}`);
        console.log(`Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);

        results.push({
            id: testCase.id,
            layer: testCase.layer,
            expected: testCase.expected_label,
            actual: status,
            passed: passed,
            reasoning: aiReasoning
        });
    }

    const accuracy = (passCount / goldenSet.length) * 100;
    console.log(`\n================================`);
    console.log(`Evaluation Summary`);
    console.log(`Total: ${goldenSet.length} | Pass: ${passCount} | Fail: ${failCount}`);
    console.log(`Accuracy: ${accuracy.toFixed(2)}%`);
    console.log(`Hard Fails (Layer 1/2 False Positives): ${hardFails}`);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultFile = path.join(__dirname, `run-results-${timestamp}.json`);
    
    fs.writeFileSync(resultFile, JSON.stringify({
        summary: { total: goldenSet.length, pass: passCount, fail: failCount, accuracy, hard_fails: hardFails },
        results: results
    }, null, 2));
    
    console.log(`Results saved to ${resultFile}`);
    
    if (hardFails > 0) {
        console.error('Test failed due to Hard Fails.');
        process.exit(1);
    }
}

runTest();
