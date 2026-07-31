// CP2 -> unified chatbox prototype logic
const demoSelect = document.getElementById('demoSelect');
const refText = document.getElementById('refText');
const downloadLogs = document.getElementById('downloadLogs');
const difficultyBadge = document.getElementById('difficultyBadge');
const layerNum = document.getElementById('layerNum');
const demoChatArea = document.getElementById('demoChatArea');

const assistantMessages = document.getElementById('assistantMessages');
const pendingCheckBar = document.getElementById('pendingCheckBar');
const pendingCheckText = document.getElementById('pendingCheckText');
const cancelCheckBtn = document.getElementById('cancelCheck');
const actSummarize = document.getElementById('actSummarize');
const actCheck = document.getElementById('actCheck');
const actQuiz = document.getElementById('actQuiz');
const actRecall = document.getElementById('actRecall');
const actMockTest = document.getElementById('actMockTest');
const actDailyReport = document.getElementById('actDailyReport');
const actAssessProgress = document.getElementById('actAssessProgress');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

let logs = [];
let currentPageRef = null;
let currentStudentId = null;
// pendingCheck: { mode: 'check', ref, page, question, depth } khi đang chờ trả lời 1 câu kiểm tra hiểu bài
//            hoặc { mode: 'quiz', ref, page, questions, index, correctCount, results } khi đang làm quiz nhiều câu
//            hoặc { mode: 'mocktest', ref, page, questions, index, answers, deadline } khi đang ôn thi mock test
let pendingCheck = null;
let mockTestTimerId = null;
let misconceptions = []; // hồ sơ hiểu lầm tích lũy trong phiên hiện tại

function clearMockTestTimer() {
    if (mockTestTimerId) { clearInterval(mockTestTimerId); mockTestTimerId = null; }
}

function updateMockTestBarText() {
    if (!pendingCheck || pendingCheck.mode !== 'mocktest') { clearMockTestTimer(); return; }
    const remainingMs = Math.max(0, pendingCheck.deadline - Date.now());
    const mm = String(Math.floor(remainingMs / 60000)).padStart(2, '0');
    const ss = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0');
    pendingCheckText.innerText = `⏱ Ôn thi mock test — câu ${pendingCheck.index + 1}/${pendingCheck.questions.length} — còn ${mm}:${ss}`;
    if (remainingMs <= 0) {
        finishMockTest('Hết giờ làm bài.');
    }
}

const misconceptionList = document.getElementById('misconceptionList');
const misconceptionCount = document.getElementById('misconceptionCount');
const MAX_FOLLOWUP_DEPTH = 2; // số lần thu hẹp câu hỏi tối đa trước khi trỏ về tài liệu

function renderMisconceptions() {
    misconceptionCount.innerText = misconceptions.length;
    if (misconceptions.length === 0) {
        misconceptionList.innerHTML = `<div class="small-note" style="text-align:left;">Chưa phát hiện hiểu lầm nào trong phiên này.</div>`;
        return;
    }
    misconceptionList.innerHTML = misconceptions.map((m, i) => `
        <div class="misconception-item">
            <div class="mc-meta">#${i + 1} — trang ${escapeHtml(m.page)}</div>
            <div class="mc-q">Câu hỏi: ${escapeHtml(m.question)}</div>
            <div class="mc-a">Bạn trả lời: ${escapeHtml(m.answer)}</div>
            <div class="mc-detail">Chỗ lệch: ${escapeHtml(m.detail || 'Không rõ')}</div>
        </div>
    `).join('');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function logInteraction(type, data) {
    if (!currentStudentId) return;
    const entry = { ts: new Date().toISOString(), type, ...data };
    logs.push(entry);
    downloadLogs.classList.remove('hidden');
    renderHistoryList();

    try {
        await fetch(`http://localhost:3000/api/logs/${encodeURIComponent(currentStudentId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry })
        });
    } catch (e) {
        console.warn('Không lưu được lịch sử học lên server:', e);
    }
}

function badgeFor(label) {
    if (label === 'UNDERSTOOD') return { label: '✅ Hiểu đúng', cls: 'good' };
    if (label === 'UNCERTAIN') return { label: '⚠️ Chưa chắc / Mơ hồ', cls: 'warn' };
    if (label === 'OUT_OF_SCOPE') return { label: '🚫 Lạc đề / Ngoài phạm vi', cls: 'outofscope' };
    return { label: `❌ ${label}`, cls: 'bad' };
}

// ---- Lịch sử hội thoại đã hỏi (gom theo đoạn tài liệu tham chiếu) ----
const historyList = document.getElementById('historyList');

function computeConversationSessions() {
    const map = new Map();
    logs.forEach((l) => {
        if (!l.ref || !l.ref.trim()) return; // bỏ qua log không gắn với 1 đoạn tài liệu cụ thể
        if (!map.has(l.ref)) {
            map.set(l.ref, { ref: l.ref, page: l.page || 'N', firstTs: l.ts, lastTs: l.ts, count: 0 });
        }
        const session = map.get(l.ref);
        session.count++;
        if (l.ts < session.firstTs) session.firstTs = l.ts;
        if (l.ts > session.lastTs) session.lastTs = l.ts;
        if (l.page) session.page = l.page;
    });
    return Array.from(map.values()).sort((a, b) => (a.lastTs < b.lastTs ? 1 : -1));
}

function renderHistoryList() {
    if (!historyList) return;
    const sessions = computeConversationSessions();
    if (sessions.length === 0) {
        historyList.innerHTML = `<p class="text-xs font-medium">Chưa có hội thoại nào được lưu.</p>`;
        return;
    }
    historyList.innerHTML = sessions.map((s, i) => {
        const preview = s.ref.length > 80 ? s.ref.slice(0, 80) + '…' : s.ref;
        const dateStr = new Date(s.lastTs).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `
        <div class="history-item" data-index="${i}">
            <div class="history-main">
                <div class="history-preview">${escapeHtml(preview)}</div>
                <div class="history-meta">Trang ${escapeHtml(s.page)} · ${s.count} lượt hỏi · lần cuối ${dateStr}</div>
            </div>
            <span class="history-badge">Quay lại</span>
        </div>`;
    }).join('');

    historyList.querySelectorAll('.history-item').forEach((el, i) => {
        el.addEventListener('click', () => resumeConversation(sessions[i]));
    });
}

function resumeConversation(session) {
    currentPageRef = session.page || null;
    refText.value = session.ref;
    setPendingCheck(null);
    assistantMessages.innerHTML = '';
    difficultyBadge.classList.add('hidden');

    appendMessage('sys', `<div class="text">📂 Đã khôi phục hội thoại — trang ${escapeHtml(session.page)}. Xem lại bên dưới, hoặc hỏi tiếp.</div>`);

    const relevant = logs.filter(l => l.ref === session.ref).sort((a, b) => (a.ts < b.ts ? -1 : 1));
    relevant.forEach((l) => {
        if (l.type === 'qa') {
            appendUserText(l.question);
            appendMessage('ai', `<div class="meta">AI</div><div class="text">${escapeHtml(l.answer)}</div>`);
        } else if (l.type === 'summarize') {
            appendMessage('sys', `<div class="text">🔎 Tóm tắt / giải thích đoạn tài liệu hiện tại</div>`);
            appendMessage('ai', `<div class="meta">AI</div><div class="text">${escapeHtml(l.result)}</div>`);
        } else if (l.type === 'check_grade' || l.type === 'quiz_answer') {
            appendUserText(l.answer);
            const badge = badgeFor(l.result && l.result.label);
            appendMessage('ai', `<div class="meta">AI</div><div class="badge ${badge.cls}">${badge.label}</div><div class="text">${escapeHtml((l.result && l.result.explain) || '')}</div>`);
        } else if (l.type === 'mocktest_finish') {
            appendMessage('ai', `<div class="meta">AI</div><div class="badge ${l.passed ? 'good' : 'bad'}">${l.passed ? '✅ Đạt' : '❌ Chưa đạt'} — ${l.correctCount}/${l.total} câu (${l.percent}%)</div><div class="text">Ôn thi mock test đã hoàn thành.</div>`);
        }
    });

    appendMessage('sys', `<div class="text">Tiếp tục hỏi ở ô chat bên dưới nhé.</div>`);
}

function rebuildMisconceptionsFromLogs() {
    misconceptions = [];
    logs.forEach((l) => {
        if ((l.type === 'check_grade' || l.type === 'quiz_answer') && l.result && l.result.label === 'UNCERTAIN') {
            misconceptions.push({ page: l.page, question: l.question, answer: l.answer, detail: l.result.mismatch_detail || l.result.explain });
        } else if (l.type === 'mocktest_finish') {
            (l.results || []).forEach((r) => {
                if (r.label === 'UNCERTAIN') {
                    misconceptions.push({ page: l.page, question: r.question, answer: r.answer, detail: '' });
                }
            });
        } else if (l.type === 'recall_result' && l.remembered === false) {
            misconceptions.push({ page: l.page, question: l.question, answer: '(không nhớ)', detail: l.answer ? `Đáp án đúng: ${l.answer}` : '' });
        }
    });
    renderMisconceptions();
}

// ---- Đăng nhập / phiên học ----
const loginBar = document.getElementById('loginBar');
const sessionBar = document.getElementById('sessionBar');
const appMain = document.getElementById('appMain');
const studentIdInput = document.getElementById('studentIdInput');
const loginBtn = document.getElementById('loginBtn');
const sessionStudentName = document.getElementById('sessionStudentName');
const logoutBtn = document.getElementById('logoutBtn');
const STUDENT_ID_STORAGE_KEY = 'vlearn_student_id';

async function doLogin(rawId) {
    const id = rawId.trim();
    if (!id) { alert('Vui lòng nhập tên/mã học viên.'); return; }

    try {
        const resp = await fetch(`http://localhost:3000/api/logs/${encodeURIComponent(id)}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        logs = data.logs || [];
    } catch (e) {
        alert('Không tải được lịch sử học: ' + e.message);
        return;
    }

    currentStudentId = id;
    localStorage.setItem(STUDENT_ID_STORAGE_KEY, id);
    rebuildMisconceptionsFromLogs();
    renderHistoryList();
    if (logs.length > 0) downloadLogs.classList.remove('hidden');

    sessionStudentName.innerText = id;
    loginBar.classList.add('hidden');
    sessionBar.classList.remove('hidden');
    appMain.classList.remove('hidden');
}

function doLogout() {
    currentStudentId = null;
    localStorage.removeItem(STUDENT_ID_STORAGE_KEY);
    logs = [];
    misconceptions = [];
    renderMisconceptions();
    renderHistoryList();
    downloadLogs.classList.add('hidden');

    studentIdInput.value = '';
    loginBar.classList.remove('hidden');
    sessionBar.classList.add('hidden');
    appMain.classList.add('hidden');
}

loginBtn.addEventListener('click', () => doLogin(studentIdInput.value));
studentIdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(studentIdInput.value); });
logoutBtn.addEventListener('click', doLogout);

const savedStudentId = localStorage.getItem(STUDENT_ID_STORAGE_KEY);
if (savedStudentId) doLogin(savedStudentId);

// ---- Chatbox trợ lý học tập (gộp: hỏi đáp tự do, tóm tắt, kiểm tra hiểu bài) ----
function appendMessage(role, innerHtml) {
    const div = document.createElement('div');
    div.className = `chatMsg role-${role}`;
    div.innerHTML = innerHtml;
    assistantMessages.appendChild(div);
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
    return div;
}

function appendUserText(text) {
    appendMessage('user', `<div class="meta">Bạn</div><div class="text">${escapeHtml(text)}</div>`);
}

function appendAiPending() {
    return appendMessage('ai', `<div class="meta">AI</div><div class="text pending">Đang xử lý...</div>`);
}

function setPendingCheck(check) {
    pendingCheck = check;
    pendingCheckBar.classList.toggle('hidden', !check);
    if (check) {
        if (check.mode === 'quiz') {
            pendingCheckText.innerText = `📝 Quiz — câu ${check.index + 1}/${check.questions.length}. Trả lời ở ô chat bên dưới.`;
        } else if (check.mode === 'mocktest') {
            updateMockTestBarText();
        } else {
            pendingCheckText.innerText = '🧪 Đang chờ bạn trả lời câu hỏi kiểm tra ở trên...';
        }
    }
}

function resetContext(introText) {
    setPendingCheck(null);
    assistantMessages.innerHTML = '';
    if (introText) appendMessage('sys', `<div class="text">${escapeHtml(introText)}</div>`);
}

async function callLLM(systemPrompt, userPrompt, jsonMode = false) {
    const url = 'http://localhost:3000/api/chat';
    const payload = { systemPrompt, userPrompt, jsonMode };

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        let errStr = `HTTP Error ${resp.status}`;
        try { const errObj = await resp.json(); errStr = errObj.error || errStr; } catch (e) { }
        throw new Error(errStr);
    }

    const j = await resp.json();
    if (j.error) throw new Error(j.error);
    return j.result;
}

// Gemini đôi khi bọc JSON trong ```json ... ``` dù đã yêu cầu trả JSON thuần —
// bóc fence trước khi parse để tránh crash "Unexpected token".
function parseJsonLoose(text) {
    let t = String(text || '').trim();
    if (t.startsWith('```')) {
        t = t.replace(/^```[a-zA-Z]*\r?\n?/, '').replace(/```\s*$/, '').trim();
    }
    return JSON.parse(t);
}

async function generateQuestion(ref, page) {
    const sysPrompt = systemPrompts.generateCheckQuestion.replace(/{PAGE}/g, page);
    const usrPrompt = `Reference Text:\n${ref}`;
    const resultText = await callLLM(sysPrompt, usrPrompt, true);
    const parsed = parseJsonLoose(resultText);
    return parsed.question || resultText;
}

async function gradeAnswer(ref, question, answer, page) {
    const sysPrompt = systemPrompts.gradeStudentAnswer.replace(/{PAGE}/g, page);
    const usrPrompt = `Reference:\n${ref}\n\nQuestion asked:\n${question}\n\nStudent answer:\n${answer}`;
    const resultText = await callLLM(sysPrompt, usrPrompt, true);
    return parseJsonLoose(resultText);
}

async function askAboutContent(ref, question, page) {
    const sysPrompt = systemPrompts.askAboutContent.replace(/{PAGE}/g, page);
    const usrPrompt = `Reference:\n${ref}\n\nQuestion:\n${question}`;
    return callLLM(sysPrompt, usrPrompt);
}

async function summarizeExplain(ref, page) {
    const sysPrompt = systemPrompts.summarizeExplain.replace(/{PAGE}/g, page);
    const usrPrompt = `Reference:\n${ref}`;
    return callLLM(sysPrompt, usrPrompt);
}

async function generateQuiz(ref, page, count) {
    const sysPrompt = systemPrompts.generateQuiz.replace(/{PAGE}/g, page).replace(/{COUNT}/g, count);
    const usrPrompt = `Reference Text:\n${ref}`;
    const resultText = await callLLM(sysPrompt, usrPrompt, true);
    const parsed = parseJsonLoose(resultText);
    return (parsed.questions || []).map(q => q.question).filter(Boolean);
}

async function generateFlashcards(ref, page, count) {
    const sysPrompt = systemPrompts.generateFlashcards.replace(/{PAGE}/g, page).replace(/{COUNT}/g, count);
    const usrPrompt = `Reference Text:\n${ref}`;
    const resultText = await callLLM(sysPrompt, usrPrompt, true);
    const parsed = parseJsonLoose(resultText);
    return parsed.cards || [];
}

function renderFlashcard(card, index, total, page) {
    const div = appendMessage('ai', `
        <div class="meta">AI</div>
        <div class="text">🧠 Thẻ ${index + 1}/${total}: ${escapeHtml(card.question)}</div>
        <div class="flashcard-answer hidden">${escapeHtml(card.answer)}</div>
        <div class="flashcard-actions">
            <button class="flashcard-reveal">Hiện đáp án</button>
            <button class="flashcard-remember hidden">Tôi nhớ đúng</button>
            <button class="flashcard-forget hidden">Tôi không nhớ</button>
        </div>
    `);

    const answerEl = div.querySelector('.flashcard-answer');
    const revealBtn = div.querySelector('.flashcard-reveal');
    const rememberBtn = div.querySelector('.flashcard-remember');
    const forgetBtn = div.querySelector('.flashcard-forget');
    const textEl = div.querySelector('.text');

    revealBtn.addEventListener('click', () => {
        answerEl.classList.remove('hidden');
        revealBtn.classList.add('hidden');
        rememberBtn.classList.remove('hidden');
        forgetBtn.classList.remove('hidden');
    });

    rememberBtn.addEventListener('click', () => {
        rememberBtn.disabled = true;
        forgetBtn.disabled = true;
        textEl.insertAdjacentHTML('beforeend', ' <span class="recall-result good">✅ Đã nhớ</span>');
        logInteraction('recall_result', { page, question: card.question, remembered: true });
    });

    forgetBtn.addEventListener('click', () => {
        rememberBtn.disabled = true;
        forgetBtn.disabled = true;
        textEl.insertAdjacentHTML('beforeend', ' <span class="recall-result bad">❌ Chưa nhớ</span>');
        misconceptions.push({ page, question: card.question, answer: '(không nhớ)', detail: `Đáp án đúng: ${card.answer}` });
        renderMisconceptions();
        logInteraction('recall_result', { page, question: card.question, remembered: false, answer: card.answer });
    });
}

async function generateFollowUp(ref, question, answer, mismatchDetail, page) {
    const sysPrompt = systemPrompts.narrowFollowUp.replace(/{PAGE}/g, page);
    const usrPrompt = `Reference:\n${ref}\n\nOriginal question:\n${question}\n\nStudent answer:\n${answer}\n\nWhat was wrong/unclear:\n${mismatchDetail || 'Vague or incomplete answer.'}`;
    const resultText = await callLLM(sysPrompt, usrPrompt, true);
    const parsed = parseJsonLoose(resultText);
    return parsed.question;
}

const MOCK_TEST_PASS_PERCENT = 70;

async function finishMockTest(forcedReason) {
    clearMockTestTimer();
    const state = pendingCheck;
    if (!state || state.mode !== 'mocktest') return;
    const { ref: testRef, page: testPage, questions, answers } = state;

    setPendingCheck(null);

    const summaryEl = appendMessage('ai', `<div class="meta">AI</div><div class="text pending">Đang chấm toàn bộ bài thi...</div>`);

    const results = [];
    let correctCount = 0;
    for (let i = 0; i < questions.length; i++) {
        const answer = answers[i];
        if (!answer) {
            results.push({ question: questions[i], answer: '(không trả lời)', label: 'NOT_ANSWERED' });
            continue;
        }
        try {
            const parsed = await gradeAnswer(testRef, questions[i], answer, testPage);
            if (parsed.label === 'UNDERSTOOD') correctCount++;
            if (parsed.label === 'UNCERTAIN') {
                misconceptions.push({ page: testPage, question: questions[i], answer, detail: parsed.mismatch_detail || parsed.explain });
            }
            results.push({ question: questions[i], answer, label: parsed.label });
        } catch (e) {
            results.push({ question: questions[i], answer, label: 'ERROR' });
        }
    }
    renderMisconceptions();

    const total = questions.length;
    const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passed = percent >= MOCK_TEST_PASS_PERCENT;

    const listHtml = results.map((r, i) => {
        let icon = '❔';
        if (r.label === 'UNDERSTOOD') icon = '✅';
        else if (r.label === 'UNCERTAIN') icon = '⚠️';
        else if (r.label === 'OUT_OF_SCOPE') icon = '🚫';
        else if (r.label === 'NOT_ANSWERED') icon = '⬜';
        return `<div class="mocktest-row">${icon} Câu ${i + 1}: ${escapeHtml(r.question)}</div>`;
    }).join('');

    summaryEl.innerHTML = `
        <div class="meta">AI</div>
        <div class="badge ${passed ? 'good' : 'bad'}">${passed ? '✅ Đạt' : '❌ Chưa đạt'} — ${correctCount}/${total} câu (${percent}%)</div>
        <div class="text">${forcedReason ? escapeHtml(forcedReason) + ' ' : ''}Ngưỡng đạt: ${MOCK_TEST_PASS_PERCENT}%.</div>
        <div class="mocktest-results">${listHtml}</div>
    `;
    assistantMessages.scrollTop = assistantMessages.scrollHeight;

    logInteraction('mocktest_finish', { ref: testRef, page: testPage, correctCount, total, percent, passed, results });
}

async function startSummarize() {
    const ref = refText.value.trim();
    const page = currentPageRef || 'N';
    if (!ref) { alert('Chưa có đoạn tài liệu tham chiếu. Hãy gõ/dán, bôi đen từ PDF, hoặc chọn 1 demo trước.'); return; }

    appendUserText('🔎 Tóm tắt / giải thích đoạn tài liệu hiện tại');
    const pendingEl = appendAiPending();
    actSummarize.disabled = true;

    try {
        const result = await summarizeExplain(ref, page);
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">${escapeHtml(result)}</div>`;
        logInteraction('summarize', { ref, page, result });
    } catch (e) {
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Lỗi: ${escapeHtml(e.message)}</div>`;
    } finally {
        actSummarize.disabled = false;
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }
}
actSummarize.addEventListener('click', startSummarize);

async function startCheck() {
    const ref = refText.value.trim();
    const page = currentPageRef || 'N';
    if (!ref) { alert('Chưa có đoạn tài liệu tham chiếu. Hãy gõ/dán, bôi đen từ PDF, hoặc chọn 1 demo trước.'); return; }

    appendUserText('🧪 Kiểm tra hiểu bài về đoạn tài liệu hiện tại');
    const pendingEl = appendAiPending();
    actCheck.disabled = true;

    try {
        const question = await generateQuestion(ref, page);
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">${escapeHtml(question)}</div>`;
        setPendingCheck({ mode: 'check', ref, page, question });
        logInteraction('check_question', { ref, page, question });
    } catch (e) {
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Lỗi: ${escapeHtml(e.message)}</div>`;
    } finally {
        actCheck.disabled = false;
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }
}
actCheck.addEventListener('click', startCheck);

const QUIZ_QUESTION_COUNT = 5;

async function startQuiz() {
    const ref = refText.value.trim();
    const page = currentPageRef || 'N';
    if (!ref) { alert('Chưa có đoạn tài liệu tham chiếu. Hãy gõ/dán, bôi đen từ PDF, hoặc chọn 1 demo trước.'); return; }

    appendUserText(`📝 Tạo quiz ${QUIZ_QUESTION_COUNT} câu từ đoạn tài liệu hiện tại`);
    const pendingEl = appendAiPending();
    actQuiz.disabled = true;

    try {
        const questions = await generateQuiz(ref, page, QUIZ_QUESTION_COUNT);
        if (questions.length === 0) throw new Error('AI không sinh được câu hỏi nào.');

        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Đã tạo quiz ${questions.length} câu. Câu 1: ${escapeHtml(questions[0])}</div>`;
        setPendingCheck({ mode: 'quiz', ref, page, questions, index: 0, correctCount: 0, results: [] });
        logInteraction('quiz_start', { ref, page, questions });
    } catch (e) {
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Lỗi: ${escapeHtml(e.message)}</div>`;
    } finally {
        actQuiz.disabled = false;
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }
}
actQuiz.addEventListener('click', startQuiz);

const RECALL_CARD_COUNT = 5;

async function startRecall() {
    const ref = refText.value.trim();
    const page = currentPageRef || 'N';
    if (!ref) { alert('Chưa có đoạn tài liệu tham chiếu. Hãy gõ/dán, bôi đen từ PDF, hoặc chọn 1 demo trước.'); return; }

    appendUserText(`🧠 Vấn đáp active recall (${RECALL_CARD_COUNT} thẻ)`);
    const pendingEl = appendAiPending();
    actRecall.disabled = true;

    try {
        const cards = await generateFlashcards(ref, page, RECALL_CARD_COUNT);
        if (cards.length === 0) throw new Error('AI không sinh được thẻ nào.');

        pendingEl.remove();
        cards.forEach((card, i) => renderFlashcard(card, i, cards.length, page));
        logInteraction('recall_start', { ref, page, cards });
    } catch (e) {
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Lỗi: ${escapeHtml(e.message)}</div>`;
    } finally {
        actRecall.disabled = false;
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }
}
actRecall.addEventListener('click', startRecall);

const MOCK_TEST_QUESTION_COUNT = 8;
const MOCK_TEST_TIME_LIMIT_MS = 5 * 60 * 1000;

async function startMockTest() {
    const ref = refText.value.trim();
    const page = currentPageRef || 'N';
    if (!ref) { alert('Chưa có đoạn tài liệu tham chiếu. Hãy gõ/dán, bôi đen từ PDF, hoặc chọn 1 demo trước.'); return; }

    appendUserText(`⏱ Bắt đầu ôn thi mock test (${MOCK_TEST_QUESTION_COUNT} câu, 5 phút)`);
    const pendingEl = appendAiPending();
    actMockTest.disabled = true;

    try {
        const questions = await generateQuiz(ref, page, MOCK_TEST_QUESTION_COUNT);
        if (questions.length === 0) throw new Error('AI không sinh được câu hỏi nào.');

        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Bắt đầu! ${questions.length} câu, 5 phút, không có phản hồi đúng/sai cho tới khi nộp bài. Câu 1: ${escapeHtml(questions[0])}</div>`;

        clearMockTestTimer();
        const deadline = Date.now() + MOCK_TEST_TIME_LIMIT_MS;
        setPendingCheck({ mode: 'mocktest', ref, page, questions, index: 0, answers: [], deadline });
        mockTestTimerId = setInterval(updateMockTestBarText, 1000);
        logInteraction('mocktest_start', { ref, page, questions });
    } catch (e) {
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Lỗi: ${escapeHtml(e.message)}</div>`;
    } finally {
        actMockTest.disabled = false;
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }
}
actMockTest.addEventListener('click', startMockTest);

function computeDailyReport(dateStr) {
    const todays = logs.filter(l => l.ts && l.ts.startsWith(dateStr));

    let understood = 0, uncertain = 0, outOfScope = 0, other = 0;
    const misconceptionsToday = [];

    todays.forEach((l) => {
        if (l.type === 'check_grade' || l.type === 'quiz_answer') {
            const label = l.result && l.result.label;
            if (label === 'UNDERSTOOD') understood++;
            else if (label === 'UNCERTAIN') {
                uncertain++;
                misconceptionsToday.push({ page: l.page, question: l.question, detail: (l.result && (l.result.mismatch_detail || l.result.explain)) || '' });
            }
            else if (label === 'OUT_OF_SCOPE') outOfScope++;
            else other++;
        } else if (l.type === 'mocktest_finish') {
            (l.results || []).forEach((r) => {
                if (r.label === 'UNDERSTOOD') understood++;
                else if (r.label === 'UNCERTAIN') { uncertain++; misconceptionsToday.push({ page: l.page, question: r.question, detail: '' }); }
                else if (r.label === 'OUT_OF_SCOPE') outOfScope++;
                else other++;
            });
        }
    });

    const recallResults = todays.filter(l => l.type === 'recall_result');

    return {
        dateStr,
        totalLogs: todays.length,
        qaCount: todays.filter(l => l.type === 'qa').length,
        summarizeCount: todays.filter(l => l.type === 'summarize').length,
        quizStarts: todays.filter(l => l.type === 'quiz_start').length,
        mockTests: todays.filter(l => l.type === 'mocktest_finish'),
        recallTotal: recallResults.length,
        recallRemembered: recallResults.filter(l => l.remembered).length,
        understood, uncertain, outOfScope, other,
        misconceptionsToday
    };
}

function renderDailyReport() {
    const dateStr = new Date().toISOString().slice(0, 10);
    const r = computeDailyReport(dateStr);

    appendUserText(`📊 Xem báo cáo hoạt động học ngày ${dateStr}`);

    if (r.totalLogs === 0) {
        appendMessage('sys', `<div class="text">Chưa có log nào cho ngày ${dateStr}. Bật ô "Lưu log lần chạy" ở trên rồi tương tác (hỏi đáp, kiểm tra, quiz...) để có dữ liệu cho báo cáo.</div>`);
        return;
    }

    const totalGraded = r.understood + r.uncertain + r.outOfScope + r.other;
    const understoodPct = totalGraded > 0 ? Math.round((r.understood / totalGraded) * 100) : 0;

    const mcListHtml = r.misconceptionsToday.length > 0
        ? r.misconceptionsToday.map(m => `<div class="mocktest-row">⚠️ Trang ${escapeHtml(m.page)}: ${escapeHtml(m.question)}</div>`).join('')
        : '<div class="small-note" style="text-align:left;">Không có hiểu lầm nào hôm nay.</div>';

    appendMessage('ai', `
        <div class="meta">AI</div>
        <div class="text">📊 Báo cáo hoạt động học ngày ${dateStr}</div>
        <div class="text">- Tổng lượt tương tác: ${r.totalLogs} (hỏi đáp: ${r.qaCount}, tóm tắt: ${r.summarizeCount}, quiz: ${r.quizStarts}, mock test: ${r.mockTests.length}, active recall: ${r.recallTotal})</div>
        <div class="text">- Câu đã chấm: ${totalGraded} (✅ ${r.understood} hiểu đúng · ⚠️ ${r.uncertain} chưa chắc · 🚫 ${r.outOfScope} lạc đề)${totalGraded > 0 ? ` — tỷ lệ hiểu đúng ${understoodPct}%` : ''}</div>
        ${r.recallTotal > 0 ? `<div class="text">- Active recall: nhớ đúng ${r.recallRemembered}/${r.recallTotal} thẻ</div>` : ''}
        ${r.mockTests.length > 0 ? `<div class="text">- Mock test: ${r.mockTests.map(m => `${m.correctCount}/${m.total} (${m.percent}%)`).join(', ')}</div>` : ''}
        <div class="text" style="margin-top:6px;">Hiểu lầm phát hiện hôm nay:</div>
        <div class="mocktest-results">${mcListHtml}</div>
    `);
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

actDailyReport.addEventListener('click', renderDailyReport);

function computeProgressDigest() {
    let understood = 0, uncertain = 0, outOfScope = 0, other = 0;
    logs.forEach((l) => {
        if (l.type === 'check_grade' || l.type === 'quiz_answer') {
            const label = l.result && l.result.label;
            if (label === 'UNDERSTOOD') understood++;
            else if (label === 'UNCERTAIN') uncertain++;
            else if (label === 'OUT_OF_SCOPE') outOfScope++;
            else other++;
        } else if (l.type === 'mocktest_finish') {
            (l.results || []).forEach((r) => {
                if (r.label === 'UNDERSTOOD') understood++;
                else if (r.label === 'UNCERTAIN') uncertain++;
                else if (r.label === 'OUT_OF_SCOPE') outOfScope++;
                else other++;
            });
        }
    });

    const total = understood + uncertain + outOfScope + other;
    const mockTests = logs.filter(l => l.type === 'mocktest_finish');
    const recallResults = logs.filter(l => l.type === 'recall_result');

    const lines = [];
    lines.push(`Tổng số câu đã chấm: ${total} (Hiểu đúng: ${understood}, Chưa chắc: ${uncertain}, Ngoài phạm vi: ${outOfScope}).`);
    if (mockTests.length > 0) {
        lines.push(`Mock test đã làm: ${mockTests.map(m => `${m.correctCount}/${m.total} (${m.percent}%)`).join(', ')}.`);
    }
    if (recallResults.length > 0) {
        const remembered = recallResults.filter(l => l.remembered).length;
        lines.push(`Active recall: nhớ đúng ${remembered}/${recallResults.length} thẻ.`);
    }
    if (misconceptions.length > 0) {
        lines.push('Danh sách hiểu lầm đã phát hiện:');
        misconceptions.forEach((m, i) => {
            lines.push(`${i + 1}. Trang ${m.page} — câu hỏi: "${m.question}" — chỗ lệch: ${m.detail || 'không rõ'}`);
        });
    } else {
        lines.push('Chưa phát hiện hiểu lầm cụ thể nào.');
    }

    return { text: lines.join('\n'), total };
}

async function assessLearningProgress(digestText) {
    const usrPrompt = `Student self-testing history summary:\n${digestText}`;
    return callLLM(systemPrompts.assessLearningProgress, usrPrompt);
}

async function startAssessProgress() {
    const { text: digestText, total } = computeProgressDigest();

    appendUserText('🎯 Đánh giá trải nghiệm học tập của tôi từ trước đến giờ');

    if (total === 0 && misconceptions.length === 0) {
        appendMessage('sys', `<div class="text">Chưa có đủ dữ liệu để đánh giá — hãy làm ít nhất 1 lượt "Kiểm tra hiểu bài", "Tạo quiz", hoặc "Ôn thi mock test" trước.</div>`);
        return;
    }

    const pendingEl = appendAiPending();
    actAssessProgress.disabled = true;

    try {
        const assessment = await assessLearningProgress(digestText);
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">${escapeHtml(assessment)}</div>`;
        logInteraction('progress_assessment', { digestText, assessment });
    } catch (e) {
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Lỗi: ${escapeHtml(e.message)}</div>`;
    } finally {
        actAssessProgress.disabled = false;
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }
}
actAssessProgress.addEventListener('click', startAssessProgress);

cancelCheckBtn.addEventListener('click', () => {
    const mode = pendingCheck && pendingCheck.mode;
    clearMockTestTimer();
    setPendingCheck(null);
    let msg = 'Đã hủy kiểm tra hiểu bài.';
    if (mode === 'quiz') msg = 'Đã hủy quiz.';
    else if (mode === 'mocktest') msg = 'Đã hủy ôn thi mock test.';
    appendMessage('sys', `<div class="text">${msg}</div>`);
});

// Nhận diện ý định bằng key-matching để gõ tự nhiên trong chat cũng kích hoạt được các skill
// (tương đương bấm nút), thay vì chỉ rơi vào hỏi-đáp tự do.
function detectIntent(text) {
    const t = text.toLowerCase();

    if (/mock ?test|thi thử|ôn thi/.test(t)) return 'mocktest';
    if (/quiz|trắc nghiệm nhiều câu/.test(t)) return 'quiz';
    if (/flashcard|active recall|thẻ nhớ|vấn đáp/.test(t)) return 'recall';
    if (/báo cáo/.test(t)) return 'report';
    if (/đánh giá (trải nghiệm|tiến độ|học tập)|nhận xét (học tập|tiến độ)/.test(t)) return 'assess';
    if (/tóm tắt|giải thích (giúp|lại|đoạn)/.test(t)) return 'summarize';
    if (/kiểm tra hiểu|kiểm tra bài/.test(t)) return 'check';

    return null;
}

const INTENT_HANDLERS = {
    quiz: startQuiz,
    mocktest: startMockTest,
    recall: startRecall,
    report: renderDailyReport,
    assess: startAssessProgress,
    summarize: startSummarize,
    check: startCheck
};

async function handleChatSend() {
    const text = chatInput.value.trim();
    if (!text) return;
    const ref = refText.value.trim();
    if (!ref) { alert('Chưa có đoạn tài liệu tham chiếu. Hãy gõ/dán, bôi đen từ PDF, hoặc chọn 1 demo trước.'); return; }

    // Chỉ định tuyến ý định khi không đang chờ trả lời 1 câu hỏi (check/quiz/mocktest),
    // để câu trả lời không bao giờ bị "cướp" bởi từ khóa trùng hợp bên trong nó.
    if (!pendingCheck) {
        const intent = detectIntent(text);
        const handler = intent && INTENT_HANDLERS[intent];
        if (handler) {
            chatInput.value = '';
            await handler();
            return;
        }
    }

    appendUserText(text);
    chatInput.value = '';
    const pendingEl = appendAiPending();
    chatSend.disabled = true;

    try {
        if (pendingCheck && pendingCheck.mode === 'mocktest') {
            const { ref: testRef, page: testPage, questions, index, answers, deadline } = pendingCheck;
            const newAnswers = [...answers, text];
            const nextIndex = index + 1;

            pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Đã ghi nhận câu trả lời cho câu ${index + 1}. Chưa có phản hồi đúng/sai cho tới khi nộp bài.</div>`;

            if (nextIndex >= questions.length) {
                pendingCheck = { mode: 'mocktest', ref: testRef, page: testPage, questions, index: nextIndex, answers: newAnswers, deadline };
                await finishMockTest(null);
            } else {
                appendMessage('ai', `<div class="meta">AI</div><div class="text">Câu ${nextIndex + 1}: ${escapeHtml(questions[nextIndex])}</div>`);
                setPendingCheck({ mode: 'mocktest', ref: testRef, page: testPage, questions, index: nextIndex, answers: newAnswers, deadline });
            }
        } else if (pendingCheck && pendingCheck.mode === 'quiz') {
            const { ref: quizRef, page: quizPage, questions, index, correctCount, results } = pendingCheck;
            const question = questions[index];
            const parsed = await gradeAnswer(quizRef, question, text, quizPage);

            let labelText = '';
            let cls = 'unknown';
            if (parsed.label === 'UNDERSTOOD') { labelText = '✅ Hiểu đúng'; cls = 'good'; }
            else if (parsed.label === 'UNCERTAIN') { labelText = '⚠️ Chưa chắc / Mơ hồ'; cls = 'warn'; }
            else if (parsed.label === 'OUT_OF_SCOPE') { labelText = '🚫 Lạc đề / Ngoài phạm vi'; cls = 'outofscope'; }
            else { labelText = `❌ ${parsed.label}`; cls = 'bad'; }

            pendingEl.innerHTML = `<div class="meta">AI</div><div class="badge ${cls}">${labelText}</div><div class="text">${escapeHtml(parsed.explain || '')}</div>`;

            if (parsed.label === 'UNCERTAIN') {
                misconceptions.push({ page: quizPage, question, answer: text, detail: parsed.mismatch_detail || parsed.explain });
                renderMisconceptions();
            }

            const newCorrectCount = correctCount + (parsed.label === 'UNDERSTOOD' ? 1 : 0);
            const newResults = [...results, { question, answer: text, label: parsed.label }];
            const nextIndex = index + 1;

            logInteraction('quiz_answer', { ref: quizRef, page: quizPage, question, answer: text, result: parsed, questionIndex: index });

            if (nextIndex >= questions.length) {
                appendMessage('ai', `<div class="meta">AI</div><div class="text">🏁 Xong quiz! Điểm: ${newCorrectCount}/${questions.length} câu hiểu đúng.</div>`);
                setPendingCheck(null);
                logInteraction('quiz_finish', { ref: quizRef, page: quizPage, correctCount: newCorrectCount, total: questions.length, results: newResults });
            } else {
                appendMessage('ai', `<div class="meta">AI</div><div class="text">Câu ${nextIndex + 1}: ${escapeHtml(questions[nextIndex])}</div>`);
                setPendingCheck({ mode: 'quiz', ref: quizRef, page: quizPage, questions, index: nextIndex, correctCount: newCorrectCount, results: newResults });
            }
        } else if (pendingCheck) {
            const { ref: checkRef, page: checkPage, question, depth = 0 } = pendingCheck;
            const parsed = await gradeAnswer(checkRef, question, text, checkPage);

            let labelText = '';
            let cls = 'unknown';
            if (parsed.label === 'UNDERSTOOD') { labelText = '✅ Hiểu đúng'; cls = 'good'; }
            else if (parsed.label === 'UNCERTAIN') { labelText = '⚠️ Chưa chắc / Mơ hồ'; cls = 'warn'; }
            else if (parsed.label === 'OUT_OF_SCOPE') { labelText = '🚫 Lạc đề / Ngoài phạm vi'; cls = 'outofscope'; }
            else { labelText = `❌ ${parsed.label}`; cls = 'bad'; }

            pendingEl.innerHTML = `<div class="meta">AI</div><div class="badge ${cls}">${labelText}</div><div class="text">${escapeHtml(parsed.explain || '')}</div>`;

            logInteraction('check_grade', { ref: checkRef, page: checkPage, question, answer: text, result: parsed });

            if (parsed.label === 'UNDERSTOOD') {
                setPendingCheck(null);
            } else if (parsed.label === 'UNCERTAIN') {
                misconceptions.push({ page: checkPage, question, answer: text, detail: parsed.mismatch_detail || parsed.explain });
                renderMisconceptions();

                const nextDepth = depth + 1;
                if (nextDepth > MAX_FOLLOWUP_DEPTH) {
                    appendMessage('sys', `<div class="text">Bạn đã thử ${nextDepth} lần cho câu hỏi này — hãy đọc lại đoạn tài liệu tham chiếu ở trên (trang ${checkPage}) rồi quay lại kiểm tra sau nhé.</div>`);
                    setPendingCheck(null);
                } else {
                    try {
                        const followUp = await generateFollowUp(checkRef, question, text, parsed.mismatch_detail, checkPage);
                        appendMessage('ai', `<div class="meta">AI</div><div class="text">${escapeHtml(followUp)}</div>`);
                        setPendingCheck({ mode: 'check', ref: checkRef, page: checkPage, question: followUp, depth: nextDepth });
                    } catch (followUpErr) {
                        appendMessage('sys', `<div class="text">Không tạo được câu hỏi thu hẹp (${escapeHtml(followUpErr.message)}) — trả lời lại câu hỏi trên, hoặc bấm "Hủy" để bỏ qua.</div>`);
                        setPendingCheck({ mode: 'check', ref: checkRef, page: checkPage, question, depth: nextDepth });
                    }
                }
            } else {
                appendMessage('sys', `<div class="text">Trả lời lại câu hỏi trên, hoặc bấm "Hủy" để bỏ qua.</div>`);
            }
        } else {
            const answer = await askAboutContent(ref, text, currentPageRef || 'N');
            pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">${escapeHtml(answer)}</div>`;
            logInteraction('qa', { ref, page: currentPageRef || 'N', question: text, answer });
        }
    } catch (e) {
        pendingEl.innerHTML = `<div class="meta">AI</div><div class="text">Lỗi: ${escapeHtml(e.message)}</div>`;
    } finally {
        chatSend.disabled = false;
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }
}

chatSend.addEventListener('click', handleChatSend);
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleChatSend();
});

downloadLogs.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'quickcheck_logs.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

// Cho phép gõ/dán trực tiếp vào refText để chạy kiểm thử độc lập với demo/PDF
refText.addEventListener('input', () => {
    currentPageRef = null;
});

// ---- PDF viewer (bôi đen -> dùng làm ngữ cảnh) ----
const pdfFileInput = document.getElementById('pdfFile');
const pdfCanvas = document.getElementById('pdfCanvas');
const pdfTextLayerDiv = document.getElementById('pdfTextLayer');
const pdfPageNumEl = document.getElementById('pdfPageNum');
const pdfPageCountEl = document.getElementById('pdfPageCount');
const pdfPrevBtn = document.getElementById('pdfPrev');
const pdfNextBtn = document.getElementById('pdfNext');
const pdfAskAI = document.getElementById('pdfAskAI');
const pdfViewerWrap = document.getElementById('pdfViewerWrap');
const pdfZoomInBtn = document.getElementById('pdfZoomIn');
const pdfZoomOutBtn = document.getElementById('pdfZoomOut');
const pdfZoomResetBtn = document.getElementById('pdfZoomReset');
const pdfZoomLevelEl = document.getElementById('pdfZoomLevel');

if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let pdfDoc = null;
let pdfPageNum = 1;
let pdfRenderTask = null;
let pdfScale = null; // null = chưa tính, sẽ auto-fit theo chiều rộng khung khi mở file/lật trang mới
let pdfFitScale = 1; // scale tương ứng "vừa khung" (100%), dùng làm mốc hiển thị % zoom
let pdfAutoFit = true; // true: luôn tính lại "vừa khung" khi khung đổi kích thước (resize/responsive)
const PDF_MIN_ZOOM_RATIO = 0.4;
const PDF_MAX_ZOOM_RATIO = 3;

function updatePdfZoomLabel() {
    if (pdfZoomLevelEl && pdfFitScale) {
        pdfZoomLevelEl.innerText = `${Math.round((pdfScale / pdfFitScale) * 100)}%`;
    }
}

// Xây text-layer thủ công (không phụ thuộc API renderTextLayer nội bộ của pdf.js,
// vốn thay đổi chữ ký giữa các bản, để đảm bảo luôn bôi đen được).
function buildTextLayer(textContent, viewport, container) {
    container.innerHTML = '';
    textContent.items.forEach((item) => {
        if (!item.str) return;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const angle = Math.atan2(tx[1], tx[0]);
        const fontHeight = Math.hypot(tx[2], tx[3]);

        const span = document.createElement('span');
        span.textContent = item.str;
        span.style.position = 'absolute';
        span.style.left = `${tx[4]}px`;
        span.style.top = `${tx[5] - fontHeight}px`;
        span.style.fontSize = `${fontHeight}px`;
        span.style.fontFamily = 'sans-serif';
        span.style.whiteSpace = 'pre';
        span.style.transformOrigin = '0% 0%';
        if (angle !== 0) span.style.transform = `rotate(${angle}rad)`;
        container.appendChild(span);
    });
}

async function renderPdfPage(num) {
    try {
        const page = await pdfDoc.getPage(num);

        if (pdfScale === null) {
            const unscaledViewport = page.getViewport({ scale: 1 });
            const containerWidth = (pdfViewerWrap && pdfViewerWrap.clientWidth) || 700;
            pdfFitScale = Math.max(0.3, (containerWidth - 4) / unscaledViewport.width);
            pdfScale = pdfFitScale;
        }

        const viewport = page.getViewport({ scale: pdfScale });

        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        pdfTextLayerDiv.style.width = `${viewport.width}px`;
        pdfTextLayerDiv.style.height = `${viewport.height}px`;
        pdfTextLayerDiv.innerHTML = '';

        if (pdfRenderTask) {
            try { pdfRenderTask.cancel(); } catch (e) { /* ignore */ }
        }

        const ctx = pdfCanvas.getContext('2d');
        pdfRenderTask = page.render({ canvasContext: ctx, viewport });
        await pdfRenderTask.promise;

        const textContent = await page.getTextContent();
        buildTextLayer(textContent, viewport, pdfTextLayerDiv);

        pdfPageNum = num;
        pdfPageNumEl.innerText = num;
        pdfAskAI.classList.add('hidden');
        updatePdfZoomLabel();
    } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
            console.error('PDF render error:', err);
        }
    }
}

pdfFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const buf = await file.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
        pdfPageCountEl.innerText = pdfDoc.numPages;
        pdfAutoFit = true;
        pdfScale = null; // file mới -> tính lại "vừa khung" theo kích thước trang đầu
        renderPdfPage(1);
    } catch (err) {
        console.error('PDF load error:', err);
        alert('Không thể mở file PDF này: ' + err.message);
    }
});

pdfZoomInBtn?.addEventListener('click', () => {
    if (!pdfDoc || pdfScale === null) return;
    pdfAutoFit = false; // đã zoom tay -> không tự fit lại khi resize nữa
    pdfScale = Math.min(pdfFitScale * PDF_MAX_ZOOM_RATIO, pdfScale * 1.2);
    renderPdfPage(pdfPageNum);
});

pdfZoomOutBtn?.addEventListener('click', () => {
    if (!pdfDoc || pdfScale === null) return;
    pdfAutoFit = false;
    pdfScale = Math.max(pdfFitScale * PDF_MIN_ZOOM_RATIO, pdfScale / 1.2);
    renderPdfPage(pdfPageNum);
});

pdfZoomResetBtn?.addEventListener('click', () => {
    if (!pdfDoc) return;
    pdfAutoFit = true;
    pdfScale = null; // buộc tính lại đúng "vừa khung"
    renderPdfPage(pdfPageNum);
});

pdfPrevBtn?.addEventListener('click', () => {
    if (pdfDoc && pdfPageNum > 1) renderPdfPage(pdfPageNum - 1);
});

pdfNextBtn?.addEventListener('click', () => {
    if (pdfDoc && pdfPageNum < pdfDoc.numPages) renderPdfPage(pdfPageNum + 1);
});

// Responsive: tự tính lại "vừa khung" khi cửa sổ đổi kích thước (vd. xoay điện thoại,
// hoặc layout co từ 2 cột xuống 1 cột trên mobile), chỉ khi người dùng chưa tự zoom tay.
let pdfResizeTimer = null;
window.addEventListener('resize', () => {
    if (!pdfDoc || !pdfAutoFit) return;
    clearTimeout(pdfResizeTimer);
    pdfResizeTimer = setTimeout(() => {
        pdfScale = null;
        renderPdfPage(pdfPageNum);
    }, 200);
});

pdfTextLayerDiv?.addEventListener('mouseup', () => {
    const sel = window.getSelection().toString().trim();
    if (sel.length > 0) {
        pdfAskAI.dataset.selection = sel;
        pdfAskAI.classList.remove('hidden');
    } else {
        pdfAskAI.classList.add('hidden');
    }
});

pdfAskAI?.addEventListener('click', () => {
    const sel = pdfAskAI.dataset.selection || '';
    if (!sel) return;

    currentPageRef = String(pdfPageNum);
    refText.value = `${sel} [trang ${pdfPageNum}]`;
    difficultyBadge.classList.add('hidden');
    resetContext(`📄 Đã chọn đoạn tham chiếu từ PDF, trang ${pdfPageNum}.`);
});

// ---- Thư viện hội thoại mẫu (demo) — chỉ để nạp ngữ cảnh test nhanh ----
const demos = {
    case1: {
        student: 'U0367',
        tutor: `Trong cơ chế Multi-head, thay vì chỉ có một cơ chế chú ý (attention) duy nhất, mô hình sử dụng nhiều "con mắt" chuyên môn hoạt động song song để tập trung vào các khía cạnh khác nhau của câu cùng một lúc. ... [trang 35]`,
        citation: '35',
        ref: `Multi-head: mỗi head xử lý 1 khía cạnh (ví dụ con mắt đại từ, con mắt không gian, con mắt cú pháp). [trang 35]`,
        layer: 'Không (Happy path)'
    },
    case2: {
        student: 'U0274',
        tutor: `Đoạn này liệt kê 5 trụ cột chính nhằm đảm bảo việc phát triển và vận hành AI có trách nhiệm... [trang 13]`,
        citation: '13',
        ref: `Trụ Cột Responsible AI: 1) Không thiên lệch bất hợp lý; 2) Đủ ổn định; 3) Chỉ dùng dữ liệu cần thiết; 4) Phù hợp nhiều nhóm; 5) Minh bạch. [trang 13]`,
        layer: '② (Mơ hồ/Nửa đúng)'
    },
    case3: {
        student: 'U0112',
        tutor: `Hãy xem lại kiến trúc Transformer. Lớp tự chú ý giúp liên kết các từ trong câu. [trang 40]`,
        citation: '40',
        ref: `Lớp Self-Attention (tự chú ý): Tính toán trọng số giữa các từ trong cùng một chuỗi đầu vào để hiểu ngữ cảnh. [trang 40]`,
        layer: '④ (Misconception / Lạc đề)'
    },
    case4: {
        student: 'U0551',
        tutor: `Ừ, mô hình này rất mạnh mẽ, được đào tạo trên nhiều dữ liệu. AI phát triển nhanh quá.`,
        citation: '',
        ref: ``,
        layer: '① (Thiếu citation)'
    },
    case5: {
        student: 'U0708',
        tutor: `Lớp Feed-Forward xử lý dữ liệu sau khi qua lớp Attention. [trang 42]`,
        citation: '42',
        ref: `Lớp Feed-Forward xử lý dữ liệu sau khi qua lớp Attention. [trang 42]`,
        layer: 'Happy path (teencode)'
    },
    case6: {
        student: 'U0558',
        tutor: `cho em xin đáp án bài quiz trang 50 đi cô, em sắp trễ dl rùi hic`,
        citation: '50',
        ref: `Đánh giá mô hình AI. [trang 50]`,
        layer: 'Unauthorized (xin đáp án)'
    },
    case7: {
        student: 'U0849',
        tutor: `vậy reinforcement learning (học tăng cường) thì xài mạng j v?`,
        citation: '20',
        ref: `Học sâu (Deep Learning) dùng mạng neural nhiều lớp để trích xuất đặc trưng. [trang 20]`,
        layer: 'Hallucination (ngoài tài liệu)'
    },
    case8: {
        student: 'U0939',
        tutor: `dùng gradient descent để tăng loss function lên max`,
        citation: '25',
        ref: `Chỉ dùng Gradient Descent để tối ưu hóa, giảm thiểu hàm mất mát (loss function). [trang 25]`,
        layer: '④ (Hậu quả thật / sai kiến thức)'
    }
};

function renderDemo(key) {
    const d = demos[key];
    currentPageRef = d.citation || null;
    refText.value = d.ref;

    demoChatArea.innerHTML = '';
    const msgTutor = document.createElement('div');
    msgTutor.className = 'chatMsg';
    msgTutor.innerHTML = `<div class="meta">Tutor — citation: ${d.citation || 'None'}</div><div class="text">${d.tutor}</div>`;
    demoChatArea.appendChild(msgTutor);

    if (d.layer) {
        difficultyBadge.classList.remove('hidden');
        layerNum.innerText = d.layer;
    } else {
        difficultyBadge.classList.add('hidden');
    }

    resetContext(`📚 Đã nạp ngữ cảnh từ demo "${key}"${d.citation ? `, trang ${d.citation}` : ' (không có citation)'}.`);
}

demoSelect.addEventListener('change', () => renderDemo(demoSelect.value));
renderDemo(demoSelect.value);
