/**
 * LGS AI-KOÇU - MASTER SCRIPT v4.0 ULTRA
 * "Fonksiyonlar Aynı, Güç Sınırsız."
 */

// --- 1. GLOBAL STATE & ENHANCED CONFIG ---
let currentQuestion = null;
let currentQuestionIndex = 1;
let currentCategory = 'sayisal';
let currentYear = 2025;
let chatHistory = [];
let isAiLoading = false;
let sessionStartTime = Date.now();

// Gelişmiş İstatistik Sistemi (HTML/CSS ile tam uyumlu)
let examData = {
    userAnswers: {},
    stats: {
        sayisal: { correct: 0, wrong: 0, net: 0, timeSpent: 0 },
        sozel: { correct: 0, wrong: 0, net: 0, timeSpent: 0 },
        totalNet: 0,
        totalScore: 200.00
    },
    uiPreferences: { theme: 'neon-dark', spotifyPos: { top: null, left: null } }
};

// --- 2. ULTRA SİSTEM BAŞLATICI ---
window.onload = async () => {
    console.log("%c🚀 LGS AI-KOÇU ULTRA v4.0 Başlatıldı!", "color: #00ffa5; font-size: 20px; font-weight: bold;");
    
    // Veri Kurtarma Modu
    const savedData = localStorage.getItem('lgs_progress');
    if (savedData) {
        try { 
            const parsed = JSON.parse(savedData);
            examData = { ...examData, ...parsed }; // Eski verileri yeni yapıya güvenle aktar
        } catch (e) { console.error("🔧 Veri tamir moduna geçildi..."); }
    }

    // UI/UX Sync
    setupNav();
    await loadQuestion(1);
    updateStatsUI();
    loadSavedPlaylist();
    setupSpotifyDragging();
    startTimeTracking();
};

// --- 3. KATEGORİ VE YIL YÖNETİMİ (KORUMALI) ---
async function setCategory(cat) {
    if (currentCategory === cat || isAiLoading) return;
    currentCategory = cat;

    // UI Feedback
    const btns = { 'sayisal': 'btn-sayisal', 'sozel': 'btn-sozel' };
    Object.keys(btns).forEach(key => {
        const el = document.getElementById(btns[key]);
        if (el) el.classList.toggle('active', key === cat);
    });

    setupNav();
    await loadQuestion(1);
}

async function setYear(year) {
    if (currentYear === year) return;
    currentYear = year;
    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.innerText) === year);
    });

    setupNav();
    await loadQuestion(1);
}

// --- 4. ULTRA SORU MOTORU (SERVER.JS BRIDGE) ---
async function loadQuestion(index) {
    currentQuestionIndex = index;
    const qText = document.getElementById('question-text');
    qText.innerHTML = '<span class="loading-pulse">Soru Getiriliyor... 🔥</span>';

    try {
        const response = await fetch(`/api/question?year=${currentYear}&category=${currentCategory.toLowerCase()}&index=${index}`);
        if (!response.ok) throw new Error("API_ERROR");
        
        currentQuestion = await response.json();
        
        // Soru yüklenirken AI hafızasını o soruya odakla
        chatHistory = [{ role: 'system', content: `Şu anki soru: ${currentQuestion.question}` }];
        
        renderQuestionUI();
        updateNavHighlight();
    } catch (err) {
        qText.innerHTML = `<b style="color:#ff4b2b">Hata:</b> Soru verisi alınamadı. Sunucu aktif mi kanka?`;
    }
}

function renderQuestionUI() {
    if (!currentQuestion) return;

    // Elementlerin varlığını kontrol et (Crash engelleyici)
    const elements = ['question-text', 'opt-A', 'opt-B', 'opt-C', 'opt-D', 'ai-response'];
    elements.forEach(id => { if(!document.getElementById(id)) console.warn(`Kanka ${id} HTML'de yok!`); });

    document.getElementById('question-text').innerText = currentQuestion.question;
    ['A', 'B', 'C', 'D'].forEach(opt => {
        document.getElementById(`opt-${opt}`).innerText = currentQuestion.options[opt];
    });

    document.getElementById('ai-response').innerHTML = "AI Öğretmen hazır, soruyu çözmeni bekliyor...";

    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
        btn.style.filter = "none";
    });

    const qKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[qKey]) {
        applyLockedState(examData.userAnswers[qKey].selected, currentQuestion.answer);
    }
}

// --- 5. CEVAP KONTROLÜ (SERVER.JS & NEON SYNC) ---
async function checkAnswer(selected) {
    const qKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[qKey]) return; 

    const correctAnswer = currentQuestion.answer;
    const isCorrect = (selected === correctAnswer);

    // Veri İşleme
    examData.userAnswers[qKey] = { isCorrect, selected, timestamp: Date.now() };
    if (isCorrect) examData.stats[currentCategory].correct++;
    else examData.stats[currentCategory].wrong++;

    // Neon & UI Lock
    applyLockedState(selected, correctAnswer);
    
    const navBtn = document.getElementById(`nav-${qKey}`);
    if (navBtn) navBtn.classList.add(isCorrect ? 'correct' : 'wrong');

    calculateLGSScore();
    saveProgress();

    // AI Tetikleyici (Server.js ile tam uyumlu payload)
    if (!isCorrect) {
        askAI(null, selected, correctAnswer);
    } else {
        document.getElementById('ai-response').innerHTML = 
            `<div class="correct-badge">✔️ DOĞRU!</div><br>Hoca: "Harikasın kanka, bu konu tamam gibi. Bir sonrakine geçelim mi?"`;
    }
}

function applyLockedState(selected, correct) {
    const options = ['A', 'B', 'C', 'D'];
    options.forEach(opt => {
        const btn = document.querySelector(`.option-btn[onclick="checkAnswer('${opt}')"]`);
        if (btn) {
            btn.disabled = true;
            if (opt === correct) btn.classList.add('correct');
            else if (opt === selected) btn.classList.add('wrong');
            else btn.style.opacity = "0.5";
        }
    });
}

// --- 6. AI ÖĞRETMEN (ULTRA INTELLIGENCE) ---
async function askAI(customMsg = null, selected = "", correct = "") {
    if (isAiLoading || !currentQuestion) return;
    
    isAiLoading = true;
    const aiBox = document.getElementById('ai-response');
    if (!customMsg) aiBox.innerHTML = '<div class="ai-typing">Hoca soruyu inceliyor... 🧐</div>';

    try {
        const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: currentQuestion.question,
                selected: selected || "Belirtilmedi",
                correct: correct || currentQuestion.answer,
                userMessage: customMsg,
                history: chatHistory.slice(-10) // Sadece son 10 mesajı gönder (Token tasarrufu)
            })
        });

        const data = await response.json();
        const reply = data.reply.replace(/\n/g, '<br>');
        
        if (customMsg) {
            aiBox.innerHTML += `<div class="user-msg"><b>Sen:</b> ${customMsg}</div>`;
            aiBox.innerHTML += `<div class="ai-msg"><b>Hoca:</b> ${reply}</div>`;
        } else {
            aiBox.innerHTML = `<div class="ai-msg">${reply}</div>`;
        }
        
        chatHistory.push({ role: 'user', content: customMsg || "Analiz yap." }, { role: 'assistant', content: reply });
        aiBox.scrollTo({ top: aiBox.scrollHeight, behavior: 'smooth' });
    } catch (err) {
        aiBox.innerHTML = "⚠️ Hocayla bağlantı kesildi. Tekrar deniyoruz...";
    } finally {
        isAiLoading = false;
    }
}

// --- 7. SPOTIFY & DRAG (ULTRA-FIXED) ---
function setupSpotifyDragging() {
    const el = document.getElementById('spotify-player');
    const header = document.querySelector('.spotify-header');
    if (!el || !header) return;

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = (e) => {
        e.preventDefault();
        pos3 = e.clientX; pos4 = e.clientY;
        document.onmouseup = () => {
            document.onmouseup = null; document.onmousemove = null;
            document.getElementById('spotify-iframe').style.pointerEvents = "auto";
            saveProgress();
        };
        document.onmousemove = (e) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
            pos3 = e.clientX; pos4 = e.clientY;
            el.style.top = (el.offsetTop - pos2) + "px";
            el.style.left = (el.offsetLeft - pos1) + "px";
            el.style.bottom = "auto"; el.style.right = "auto";
        };
        document.getElementById('spotify-iframe').style.pointerEvents = "none";
    };
}

// --- 8. YARDIMCI ULTRA FONKSİYONLAR ---
function saveProgress() {
    localStorage.setItem('lgs_progress', JSON.stringify(examData));
}

function calculateLGSScore() {
    const s = examData.stats.sayisal;
    const sz = examData.stats.sozel;
    const sNet = Math.max(0, s.correct - (s.wrong / 3));
    const szNet = Math.max(0, sz.correct - (sz.wrong / 3));
    examData.stats.totalNet = sNet + szNet;
    examData.stats.totalScore = Math.min(500, 200 + (sNet * 3.75) + (szNet * 3.0));
    updateStatsUI(sNet, szNet);
}

function updateStatsUI(sn = 0, szn = 0) {
    const map = {
        'stat-score': examData.stats.totalScore.toFixed(2),
        'stat-net': examData.stats.totalNet.toFixed(2),
        'stat-correct': examData.stats.sayisal.correct + examData.stats.sozel.correct,
        'stat-wrong': examData.stats.sayisal.wrong + examData.stats.sozel.wrong,
        'sayisal-net': sn.toFixed(2),
        'sozel-net': szn.toFixed(2)
    };
    Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = map[id];
    });
}

function handleSend() {
    const input = document.getElementById('user-input');
    if (input.value.trim() && !isAiLoading) {
        askAI(input.value.trim());
        input.value = "";
    }
}

// Zaman Takibi
function startTimeTracking() {
    setInterval(() => {
        examData.stats[currentCategory].timeSpent++;
    }, 1000);
}

// Fonksiyonları Pencereye Bağla (HTML onclick için)
window.checkAnswer = checkAnswer;
window.setCategory = setCategory;
window.setYear = setYear;
window.loadQuestion = loadQuestion;
