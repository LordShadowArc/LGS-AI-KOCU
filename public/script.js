/**
 * LGS AI-KOÇU - MASTER SCRIPT v4.0 ULTRA
 * index.html ve server.js ile %100 Senkronize Versiyon
 */

// --- 1. GLOBAL STATE ---
let currentQuestion = null;
let currentQuestionIndex = 1;
let currentCategory = 'sayisal';
let currentYear = 2025;
let chatHistory = [];
let isAiLoading = false;

let examData = {
    userAnswers: {},
    stats: {
        sayisal: { correct: 0, wrong: 0, net: 0 },
        sozel: { correct: 0, wrong: 0, net: 0 },
        totalNet: 0,
        totalScore: 200.00
    }
};

// --- 2. SİSTEM BAŞLATICI ---
window.onload = async () => {
    console.log("🚀 Ultra Sistem Başlatıldı...");
    const savedData = localStorage.getItem('lgs_progress');
    if (savedData) {
        try { examData = JSON.parse(savedData); } catch (e) { console.warn("Eski veriler temizlendi."); }
    }
    setupNav();
    await loadQuestion(1);
    updateStatsUI();
    loadSavedPlaylist();
    setupSpotifyDragging();
};

// --- 3. KATEGORİ VE YIL YÖNETİMİ ---
async function setCategory(cat) {
    if (currentCategory === cat) return;
    currentCategory = cat;
    document.getElementById('btn-sayisal').classList.toggle('active', cat === 'sayisal');
    document.getElementById('btn-sozel').classList.toggle('active', cat === 'sozel');
    setupNav();
    await loadQuestion(1);
}

async function setYear(year) {
    currentYear = year;
    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.innerText) === year);
    });
    setupNav();
    await loadQuestion(1);
}

// --- 4. ULTRA SORU MOTORU (SERVER.JS SYNC) ---
async function loadQuestion(index) {
    currentQuestionIndex = index;
    const qText = document.getElementById('question-text');
    qText.innerHTML = '<span class="loading">Soru Yükleniyor... 🔥</span>';

    try {
        // SERVER.JS BURAYI BEKLİYOR: /api/question?year=2025&category=sayisal&index=1
        const response = await fetch(`/api/question?year=${currentYear}&category=${currentCategory.toLowerCase()}&index=${index}`);
        
        if (!response.ok) throw new Error("Soru bulunamadı kanka!");
        
        currentQuestion = await response.json();
        renderQuestionUI();
        document.getElementById('ai-response').scrollTop = 0;
        updateNavHighlight();
    } catch (err) {
        console.error(err);
        qText.innerText = "Hata: Sunucudan soru alınamadı kanka.";
    }
}

function renderQuestionUI() {
    if (!currentQuestion) return;
    
    document.getElementById('question-text').innerText = currentQuestion.question;
    document.getElementById('opt-A').innerText = currentQuestion.options.A;
    document.getElementById('opt-B').innerText = currentQuestion.options.B;
    document.getElementById('opt-C').innerText = currentQuestion.options.C;
    document.getElementById('opt-D').innerText = currentQuestion.options.D;
    
    // AI kutusunu resetle
    document.getElementById('ai-response').innerHTML = "Soruyu çözünce analiz burada görünecek...";
    chatHistory = [];

    // Butonları temizle
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
    });

    // Daha önce çözüldü mü kontrol et
    const qKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[qKey]) {
        applyLockedState(examData.userAnswers[qKey].selected, currentQuestion.answer);
    }
}

// --- 5. CEVAP KONTROLÜ VE NEON SİSTEMİ ---
async function checkAnswer(selected) {
    const qKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[qKey]) return;

    const correctAnswer = currentQuestion.answer;
    const isCorrect = (selected === correctAnswer);

    examData.userAnswers[qKey] = { isCorrect, selected };
    if (isCorrect) examData.stats[currentCategory].correct++;
    else examData.stats[currentCategory].wrong++;

    applyLockedState(selected, correctAnswer);
    
    const navBtn = document.getElementById(`nav-${qKey}`);
    if (navBtn) navBtn.classList.add(isCorrect ? 'correct' : 'wrong');

    calculateLGSScore();
    localStorage.setItem('lgs_progress', JSON.stringify(examData));

    // AI Analizi Tetikle
    if (!isCorrect) {
        askAI(null, selected, correctAnswer);
    } else {
        document.getElementById('ai-response').innerHTML = 
            "<b style='color:#00ffa5; text-shadow:0 0 10px #00ffa5'>✔️ DOĞRU! Efsanesin kanka.</b>";
    }
}

function applyLockedState(selected, correct) {
    const options = ['A', 'B', 'C', 'D'];
    options.forEach(opt => {
        // HTML'deki onclick yapısına göre butonu seçiyoruz
        const btn = document.querySelector(`.option-btn[onclick="checkAnswer('${opt}')"]`);
        if (btn) {
            btn.disabled = true;
            if (opt === correct) btn.classList.add('correct');
            else if (opt === selected) btn.classList.add('wrong');
        }
    });
}
// --- 6. AI ÖĞRETMEN SOHBET (GÜNCEL AKIŞ FİX) ---
async function askAI(customMsg = null, selected = "", correct = "") {
    if (isAiLoading || !currentQuestion) return;
    
    isAiLoading = true;
    const aiBox = document.getElementById('ai-response');
    
    // Görsel düzenlemeler
    aiBox.style.marginTop = "25px";
    aiBox.style.display = "flex";
    aiBox.style.flexDirection = "column";

    if (!customMsg) {
        aiBox.innerHTML = "<div class='ai-typing'>Hoca analiz ediyor... 🧐</div>";
    }

    try {
        const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionText: currentQuestion.question,
                userAnswer: selected || "Belirtilmedi",
                correctAnswer: correct || currentQuestion.answer,
                userMessage: customMsg,
                chatHistory: chatHistory
            })
        });

        const data = await response.json();
        const reply = data.reply.replace(/\n/g, '<br>');

        if (customMsg) {
            // Mesaj çifti oluşturma
            aiBox.innerHTML += `
                <div class='msg-pair' style='border-top: 1px dashed #444; padding: 10px 0; margin-top: 10px;'>
                    <div class='user-msg' style='color:#00ffa5;'><b>Sen:</b> ${customMsg}</div>
                    <div class='ai-msg' style='margin-top:5px;'><b>Hoca:</b> ${reply}</div>
                </div>`;
            
            aiBox.scrollTo({ top: aiBox.scrollHeight, behavior: 'smooth' });
        } else {
            // İlk hoca cevabı
            aiBox.innerHTML = `<div class='ai-msg'>${reply}</div>`;
            aiBox.scrollTop = 0; 
        }
        
        chatHistory.push({ role: 'user', text: customMsg || "Bu soruyu anlat." }, { role: 'assistant', text: reply });
        
    } catch (err) {
        aiBox.innerHTML = "⚠️ Hocaya ulaşılamıyor, interneti kontrol et kanka.";
    } finally {
        isAiLoading = false;
    }
}
        if (customMsg) {
            // Yeni mesajları kutunun altına ekler ve araya çizgi çeker
            aiBox.innerHTML += `
                <div class='msg-pair' style='border-top: 1px solid #333; padding: 10px 0; margin-top: 10px;'>
                    <div class='user-msg' style='color:#00ffa5;'><b>Sen:</b> ${customMsg}</div>
                    <div class='ai-msg' style='margin-top:5px;'><b>Hoca:</b> ${reply}</div>
                </div>`;
            
            // Otomatik aşağı kaydır
            aiBox.scrollTo({ top: aiBox.scrollHeight, behavior: 'smooth' });
        } else {
            // İlk analiz geldiğinde kutuyu temizle ve en ÜSTTEN başlat
            aiBox.innerHTML = `<div class='ai-msg'>${reply}</div>`;
            aiBox.scrollTop = 0; 
        }
        
        chatHistory.push({ role: 'user', text: customMsg || "Bu soruyu anlat." }, { role: 'assistant', text: reply });
        
    } catch (err) {
        aiBox.innerHTML = "⚠️ Hocaya ulaşılamıyor, interneti kontrol et kanka.";
    } finally {
        isAiLoading = false;
    }
}
// --- 7. NAVİGASYON VE SKOR ---
function setupNav() {
    const navGrid = document.getElementById('question-nav');
    if (!navGrid) return;
    navGrid.innerHTML = "";
    const count = currentCategory === 'sayisal' ? 40 : 50;
    for (let i = 1; i <= count; i++) {
        const btn = document.createElement('button');
        const qKey = `${currentYear}-${currentCategory}-${i}`;
        btn.id = `nav-${qKey}`;
        btn.className = 'nav-item';
        btn.innerText = i;
        if (examData.userAnswers[qKey]) {
            btn.classList.add(examData.userAnswers[qKey].isCorrect ? 'correct' : 'wrong');
        }
        btn.onclick = () => loadQuestion(i);
        navGrid.appendChild(btn);
    }
}

function calculateLGSScore() {
    const s = examData.stats.sayisal;
    const sz = examData.stats.sozel;
    const sNet = Math.max(0, s.correct - (s.wrong / 3));
    const szNet = Math.max(0, sz.correct - (sz.wrong / 3));
    
    examData.stats.totalNet = sNet + szNet;
    const sPuan = sNet * 3.75;
    const szPuan = szNet * 3.0;
    examData.stats.totalScore = 200 + sPuan + szPuan;

    updateStatsUI(sNet, szNet, sPuan, szPuan);
}

function updateStatsUI(sn = 0, szn = 0, sp = 0, szp = 0) {
    document.getElementById('stat-score').innerText = examData.stats.totalScore.toFixed(2);
    document.getElementById('stat-net').innerText = examData.stats.totalNet.toFixed(2);
    document.getElementById('sayisal-net').innerText = sn.toFixed(2);
    document.getElementById('sozel-net').innerText = szn.toFixed(2);
    document.getElementById('sayisal-contribution').innerText = sp.toFixed(2);
    document.getElementById('sozel-contribution').innerText = szp.toFixed(2);
    document.getElementById('stat-correct').innerText = examData.stats.sayisal.correct + examData.stats.sozel.correct;
    document.getElementById('stat-wrong').innerText = examData.stats.sayisal.wrong + examData.stats.sozel.wrong;
}

// --- 8. DİĞER FONKSİYONLAR ---
function getNewQuestion() {
    if (currentQuestionIndex < (currentCategory === 'sayisal' ? 40 : 50)) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        alert("Bölüm bitti kanka, diğer bölüme geçebilirsin!");
    }
}

function handleSend() {
    const input = document.getElementById('user-input');
    if (input.value.trim()) {
        askAI(input.value.trim());
        input.value = "";
    }
}

function toggleSpotify() {
    const player = document.getElementById('spotify-player');
    player.classList.toggle('collapsed');
}

function updatePlaylist() {
    const input = document.getElementById('spotify-link-input');
    const iframe = document.getElementById('spotify-iframe');
    if (input.value.includes('spotify.com')) {
        let link = input.value.replace('open.spotify.com/', 'open.spotify.com/embed/');
        iframe.src = link;
        localStorage.setItem('userPlaylist', link);
    }
}

function loadSavedPlaylist() {
    const saved = localStorage.getItem('userPlaylist');
    if (saved) document.getElementById('spotify-iframe').src = saved;
}

function resetProgress() {
    if (confirm("Tüm ilerlemen sıfırlanacak, emin misin kanka?")) {
        localStorage.removeItem('lgs_progress');
        location.reload();
    }
}

function setupSpotifyDragging() {
    const el = document.getElementById('spotify-player');
    const header = document.querySelector('.spotify-header');
    if (!el || !header) return;
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = (e) => {
        pos3 = e.clientX; pos4 = e.clientY;
        document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
        document.onmousemove = (e) => {
            pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
            pos3 = e.clientX; pos4 = e.clientY;
            el.style.top = (el.offsetTop - pos2) + "px";
            el.style.left = (el.offsetLeft - pos1) + "px";
            el.style.bottom = "auto"; el.style.right = "auto";
        };
    };
}

function updateNavHighlight() {
    document.querySelectorAll('.nav-item').forEach(btn => btn.style.border = "none");
    const active = document.getElementById(`nav-${currentYear}-${currentCategory}-${currentQuestionIndex}`);
    if (active) active.style.border = "2px solid #00bfa5";
}

document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
});
