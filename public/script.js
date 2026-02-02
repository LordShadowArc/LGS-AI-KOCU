/**
 * LGS AI-KOÇU - MASTER SCRIPT v3.0
 * HTML yapısına tam entegre, Neon Efekt Korumalı, Sürükle-Bırak Aktif.
 */

// --- 1. GLOBAL STATE (DURUM YÖNETİMİ) ---
let currentQuestion = null;
let currentQuestionIndex = 1;
let currentCategory = 'sayisal';
let currentYear = 2025;
let chatHistory = [];
let isAiLoading = false;

// Veri Güvenliği: Eğer localStorage boşsa varsayılanı kullan
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
    console.log("🛠️ Sistem HTML yapısına göre senkronize ediliyor...");
    
    // Verileri Yükle
    const savedData = localStorage.getItem('lgs_progress');
    if (savedData) {
        try {
            examData = JSON.parse(savedData);
        } catch (e) {
            console.error("Veri okuma hatası, sıfırlanıyor...");
        }
    }

    // UI Bileşenlerini Hazırla
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

    // Buton aktifliklerini değiştir
    document.getElementById('btn-sayisal').classList.toggle('active', cat === 'sayisal');
    document.getElementById('btn-sozel').classList.toggle('active', cat === 'sozel');

    setupNav();
    await loadQuestion(1);
}

async function setYear(year) {
    currentYear = year;
    // Tüm yıl butonlarını tara ve aktif olanı işaretle
    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.innerText) === year);
    });

    setupNav();
    await loadQuestion(1);
}

// --- 4. SORU MOTORU (CORE ENGINE) ---
async function loadQuestion(index) {
    currentQuestionIndex = index;
    const qText = document.getElementById('question-text');
    qText.innerText = "Soru Getiriliyor... 🔥";

    try {
        const response = await fetch(`/api/question?year=${currentYear}&category=${currentCategory.toLowerCase()}&index=${index}`);
        if (!response.ok) throw new Error("Soru bulunamadı");
        
        currentQuestion = await response.json();
        
        // Arayüzü Güncelle
        renderQuestionUI();
        updateNavHighlight();
    } catch (err) {
        qText.innerText = "Hata: Soru verisi alınamadı. Lütfen internetini veya API'yi kontrol et kanka.";
        console.error(err);
    }
}

function renderQuestionUI() {
    if (!currentQuestion) return;

    // Soru ve Şık Metinlerini Bas
    document.getElementById('question-text').innerText = currentQuestion.question;
    document.getElementById('opt-A').innerText = currentQuestion.options.A;
    document.getElementById('opt-B').innerText = currentQuestion.options.B;
    document.getElementById('opt-C').innerText = currentQuestion.options.C;
    document.getElementById('opt-D').innerText = currentQuestion.options.D;

    // AI Alanını Temizle
    document.getElementById('ai-response').innerHTML = "Soruyu çözünce analiz burada görünecek...";
    chatHistory = [];

    // Şık Butonlarını Sıfırla (Neonları Temizle)
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
        btn.style.backgroundColor = ""; // ÖNEMLİ: CSS neonlarının çalışması için boş olmalı
    });

    // Eğer soru önceden çözüldüyse kilitle ve neonları yak
    const qKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[qKey]) {
        applyLockedState(examData.userAnswers[qKey].selected, currentQuestion.answer);
    }
}

// --- 5. CEVAP KONTROLÜ VE NEON SİSTEMİ ---
async function checkAnswer(selected) {
    const qKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[qKey]) return; // Zaten çözüldüyse dur

    const correctAnswer = currentQuestion.answer;
    const isCorrect = (selected === correctAnswer);

    // İstatistik Güncelleme
    examData.userAnswers[qKey] = { isCorrect, selected };
    if (isCorrect) {
        examData.stats[currentCategory].correct++;
    } else {
        examData.stats[currentCategory].wrong++;
    }

    // Neon Efektlerini Uygula
    applyLockedState(selected, correctAnswer);
    
    // Sol Menü (Soru Hafızası) Neonunu Yak
    const navBtn = document.getElementById(`nav-${qKey}`);
    if (navBtn) navBtn.classList.add(isCorrect ? 'correct' : 'wrong');

    // Skor ve Kayıt
    calculateLGSScore();
    localStorage.setItem('lgs_progress', JSON.stringify(examData));

    // AI Analizi
    if (!isCorrect) {
        askAI(null, selected, correctAnswer);
    } else {
        document.getElementById('ai-response').innerHTML = "<b style='color:#00ffa5; text-shadow:0 0 10px #00ffa5'>✔️ DOĞRU! Harikasın kanka.</b>";
    }
}

function applyLockedState(selected, correct) {
    const options = ['A', 'B', 'C', 'D'];
    options.forEach(opt => {
        const btn = document.querySelector(`.option-btn[onclick="checkAnswer('${opt}')"]`);
        if (btn) {
            btn.disabled = true;
            if (opt === correct) {
                btn.classList.add('correct'); // YEŞİL NEON
            } else if (opt === selected) {
                btn.classList.add('wrong'); // KIRMIZI NEON
            }
        }
    });
}

// --- 6. SORU HAFIZASI (SIDEBAR) NAVİGASYONU ---
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
        
        // Eski sonuçları yükle (Neonlar)
        if (examData.userAnswers[qKey]) {
            btn.classList.add(examData.userAnswers[qKey].isCorrect ? 'correct' : 'wrong');
        }
        
        btn.onclick = () => loadQuestion(i);
        navGrid.appendChild(btn);
    }
}

function updateNavHighlight() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.style.boxShadow = "none";
        btn.style.borderColor = "rgba(255,255,255,0.1)";
    });
    const activeBtn = document.getElementById(`nav-${currentYear}-${currentCategory}-${currentQuestionIndex}`);
    if (activeBtn) {
        activeBtn.style.boxShadow = "0 0 15px #00bfa5";
        activeBtn.style.borderColor = "#00bfa5";
    }
}

function getNewQuestion() {
    const max = currentCategory === 'sayisal' ? 40 : 50;
    if (currentQuestionIndex < max) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        alert("Bu bölüm bitti kanka! Diğer bölüme geçebilirsin.");
    }
}

// --- 7. PUANLAMA VE İSTATİSTİK ---
function calculateLGSScore() {
    const s = examData.stats.sayisal;
    const sz = examData.stats.sozel;
    
    // Net = Doğru - (Yanlış / 3)
    const sNet = Math.max(0, s.correct - (s.wrong / 3));
    const szNet = Math.max(0, sz.correct - (sz.wrong / 3));
    
    examData.stats.totalNet = sNet + szNet;
    
    // Katsayılar: Sayısal 3.75, Sözel 3.0 (Örnek)
    const sPuan = sNet * 3.75;
    const szPuan = szNet * 3.0;
    examData.stats.totalScore = Math.min(500, 200 + sPuan + szPuan);

    updateStatsUI(sNet, szNet, sPuan, szPuan);
}

function updateStatsUI(sn = 0, szn = 0, sp = 0, szp = 0) {
    document.getElementById('stat-score').innerText = examData.stats.totalScore.toFixed(2);
    document.getElementById('stat-net').innerText = examData.stats.totalNet.toFixed(2);
    document.getElementById('stat-correct').innerText = examData.stats.sayisal.correct + examData.stats.sozel.correct;
    document.getElementById('stat-wrong').innerText = examData.stats.sayisal.wrong + examData.stats.sozel.wrong;
    
    document.getElementById('sayisal-net').innerText = sn.toFixed(2);
    document.getElementById('sozel-net').innerText = szn.toFixed(2);
    document.getElementById('sayisal-contribution').innerText = sp.toFixed(2);
    document.getElementById('sozel-contribution').innerText = szp.toFixed(2);
}

// --- 8. AI ÖĞRETMEN SOHBET ---
async function askAI(customMsg = null, selected = "", correct = "") {
    if (isAiLoading) return;
    isAiLoading = true;
    
    const aiBox = document.getElementById('ai-response');
    if (!customMsg) aiBox.innerHTML = "<div class='loading'>AI Öğretmen analiz ediyor... ✨</div>";

    try {
        const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: currentQuestion.question,
                selected: selected || "",
                correct: correct || currentQuestion.answer,
                userMessage: customMsg,
                history: chatHistory
            })
        });

        const data = await response.json();
        const reply = data.reply.replace(/\n/g, '<br>');

        if (customMsg) {
            aiBox.innerHTML += `<div style='margin-top:15px; color:#00bfa5'><b>Sen:</b> ${customMsg}</div>`;
            aiBox.innerHTML += `<div style='margin-top:5px'><b>Hoca:</b> ${reply}</div>`;
        } else {
            aiBox.innerHTML = `<div>${reply}</div>`;
        }
        
        chatHistory.push({ role: 'user', content: customMsg }, { role: 'assistant', content: reply });
        aiBox.scrollTop = aiBox.scrollHeight;
    } catch (err) {
        aiBox.innerHTML = "Hocaya ulaşılamıyor kanka, teknik bir arıza var.";
    } finally {
        isAiLoading = false;
    }
}

function handleSend() {
    const input = document.getElementById('user-input');
    if (input.value.trim()) {
        askAI(input.value.trim());
        input.value = "";
    }
}

// --- 9. SPOTIFY & SÜRÜKLE-BIRAK ---
function toggleSpotify() {
    const player = document.getElementById('spotify-player');
    const btn = document.getElementById('spot-toggle-btn');
    player.classList.toggle('collapsed');
    btn.innerText = player.classList.contains('collapsed') ? "▲" : "▼";
}

function updatePlaylist() {
    const input = document.getElementById('spotify-link-input').value.trim();
    const iframe = document.getElementById('spotify-iframe');
    if (input.includes('spotify.com')) {
        iframe.src = input;
        localStorage.setItem('userPlaylist', input);
        alert("Liste güncellendi kanka!");
    }
}

function loadSavedPlaylist() {
    const saved = localStorage.getItem('userPlaylist');
    if (saved) document.getElementById('spotify-iframe').src = saved;
}

function setupSpotifyDragging() {
    const el = document.getElementById('spotify-player');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    const header = document.querySelector('.spotify-header');
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.bottom = "auto";
        el.style.right = "auto";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// --- 10. SIFIRLAMA ---
function resetProgress() {
    if (confirm("Tüm verilerin silinecek, emin misin kanka?")) {
        localStorage.removeItem('lgs_progress');
        location.reload();
    }
}

// Enter tuşu ile mesaj gönderme
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.activeElement.id === 'user-input') handleSend();
});
