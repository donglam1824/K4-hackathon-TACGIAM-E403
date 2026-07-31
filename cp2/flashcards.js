// Trang ôn lại flashcard — gom dữ liệu từ lịch sử "Active recall" (recall_start/recall_result)
// đã lưu theo tài khoản đăng nhập, cho học viên xem lại và tự kiểm tra lại.

const API_BASE = 'http://localhost:3000';
const STUDENT_ID_STORAGE_KEY = 'vlearn_student_id';

const loginBar = document.getElementById('loginBar');
const studentIdInput = document.getElementById('studentIdInput');
const loginBtn = document.getElementById('loginBtn');
const reviewMain = document.getElementById('reviewMain');
const cardList = document.getElementById('cardList');
const emptyNote = document.getElementById('emptyNote');
const filterAllBtn = document.getElementById('filterAll');
const filterBadBtn = document.getElementById('filterBad');
const filterGoodBtn = document.getElementById('filterGood');
const filterUntestedBtn = document.getElementById('filterUntested');
const countAllEl = document.getElementById('countAll');
const countBadEl = document.getElementById('countBad');
const countGoodEl = document.getElementById('countGood');
const countUntestedEl = document.getElementById('countUntested');

let currentStudentId = null;
let flashcardBank = [];
let currentFilter = 'all';

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Gom card từ recall_start (question+answer đầy đủ) và phủ trạng thái mới nhất từ recall_result.
function buildFlashcardBank(logs) {
    const bank = new Map();

    logs.forEach((l) => {
        if (l.type === 'recall_start' && Array.isArray(l.cards)) {
            l.cards.forEach((c) => {
                if (!c.question) return;
                const existing = bank.get(c.question);
                if (!existing || l.ts > existing.lastTs) {
                    bank.set(c.question, {
                        question: c.question,
                        answer: c.answer,
                        page: l.page || 'N',
                        status: existing ? existing.status : null,
                        lastTs: l.ts
                    });
                }
            });
        }
    });

    logs
        .filter(l => l.type === 'recall_result')
        .sort((a, b) => (a.ts < b.ts ? -1 : 1))
        .forEach((l) => {
            const existing = bank.get(l.question);
            if (existing) {
                existing.status = l.remembered ? 'good' : 'bad';
                if (!existing.answer && l.answer) existing.answer = l.answer;
            } else {
                bank.set(l.question, {
                    question: l.question,
                    answer: l.answer || '',
                    page: l.page || 'N',
                    status: l.remembered ? 'good' : 'bad',
                    lastTs: l.ts
                });
            }
        });

    return Array.from(bank.values()).sort((a, b) => {
        const rank = (s) => (s === 'bad' ? 0 : s === null ? 1 : 2); // ưu tiên hiện thẻ chưa nhớ / chưa test trước
        return rank(a.status) - rank(b.status);
    });
}

async function doLogin(rawId) {
    const id = rawId.trim();
    if (!id) { alert('Vui lòng nhập tên/mã học viên.'); return; }

    try {
        const resp = await fetch(`${API_BASE}/api/logs/${encodeURIComponent(id)}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        flashcardBank = buildFlashcardBank(data.logs || []);
    } catch (e) {
        alert('Không tải được lịch sử học: ' + e.message);
        return;
    }

    currentStudentId = id;
    localStorage.setItem(STUDENT_ID_STORAGE_KEY, id);
    loginBar.classList.add('hidden');
    reviewMain.classList.remove('hidden');
    renderCounts();
    renderCardList();
}

loginBtn.addEventListener('click', () => doLogin(studentIdInput.value));
studentIdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(studentIdInput.value); });

const saved = localStorage.getItem(STUDENT_ID_STORAGE_KEY);
if (saved) doLogin(saved);

function renderCounts() {
    countAllEl.innerText = flashcardBank.length;
    countBadEl.innerText = flashcardBank.filter(c => c.status === 'bad').length;
    countGoodEl.innerText = flashcardBank.filter(c => c.status === 'good').length;
    countUntestedEl.innerText = flashcardBank.filter(c => c.status === null).length;
}

function setFilter(filter) {
    currentFilter = filter;
    [filterAllBtn, filterBadBtn, filterGoodBtn, filterUntestedBtn].forEach(b => b.classList.remove('filter-btn-active'));
    ({ all: filterAllBtn, bad: filterBadBtn, good: filterGoodBtn, untested: filterUntestedBtn })[filter].classList.add('filter-btn-active');
    renderCardList();
}
filterAllBtn.addEventListener('click', () => setFilter('all'));
filterBadBtn.addEventListener('click', () => setFilter('bad'));
filterGoodBtn.addEventListener('click', () => setFilter('good'));
filterUntestedBtn.addEventListener('click', () => setFilter('untested'));

function statusLabel(status) {
    if (status === 'good') return { text: 'Đã nhớ', cls: 'good' };
    if (status === 'bad') return { text: 'Chưa nhớ', cls: 'bad' };
    return { text: 'Chưa test', cls: 'untested' };
}

function renderCardList() {
    const filtered = currentFilter === 'all'
        ? flashcardBank
        : flashcardBank.filter(c => (currentFilter === 'untested' ? c.status === null : c.status === currentFilter));

    if (filtered.length === 0) {
        cardList.innerHTML = '';
        emptyNote.classList.remove('hidden');
        return;
    }
    emptyNote.classList.add('hidden');

    cardList.innerHTML = filtered.map((c, i) => {
        const s = statusLabel(c.status);
        return `
        <div class="review-card" data-question="${encodeURIComponent(c.question)}">
            <span class="review-status ${s.cls}">${s.text}</span>
            <div class="review-meta">Trang ${escapeHtml(c.page)}</div>
            <div class="review-question">${escapeHtml(c.question)}</div>
            <div class="review-answer hidden">${escapeHtml(c.answer)}</div>
            <div class="review-actions">
                <button class="btn-reveal">Hiện đáp án</button>
                <button class="btn-good hidden">Tôi nhớ đúng</button>
                <button class="btn-bad hidden">Tôi không nhớ</button>
            </div>
        </div>`;
    }).join('');

    cardList.querySelectorAll('.review-card').forEach((cardEl) => {
        const question = decodeURIComponent(cardEl.dataset.question);
        const card = flashcardBank.find(c => c.question === question);
        const answerEl = cardEl.querySelector('.review-answer');
        const revealBtn = cardEl.querySelector('.btn-reveal');
        const goodBtn = cardEl.querySelector('.btn-good');
        const badBtn = cardEl.querySelector('.btn-bad');

        revealBtn.addEventListener('click', () => {
            answerEl.classList.remove('hidden');
            revealBtn.classList.add('hidden');
            goodBtn.classList.remove('hidden');
            badBtn.classList.remove('hidden');
        });

        goodBtn.addEventListener('click', () => markResult(card, true, cardEl));
        badBtn.addEventListener('click', () => markResult(card, false, cardEl));
    });
}

async function markResult(card, remembered, cardEl) {
    card.status = remembered ? 'good' : 'bad';
    renderCounts();

    const entry = {
        ts: new Date().toISOString(),
        type: 'recall_result',
        page: card.page,
        question: card.question,
        remembered,
        answer: remembered ? undefined : card.answer
    };
    try {
        await fetch(`${API_BASE}/api/logs/${encodeURIComponent(currentStudentId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry })
        });
    } catch (e) {
        console.warn('Không lưu được kết quả ôn tập:', e);
    }

    if (currentFilter !== 'all' && ((currentFilter === 'untested') || currentFilter !== card.status)) {
        renderCardList(); // thẻ không còn khớp filter hiện tại -> render lại danh sách
    } else {
        const s = statusLabel(card.status);
        cardEl.querySelector('.review-status').className = `review-status ${s.cls}`;
        cardEl.querySelector('.review-status').innerText = s.text;
    }
}
