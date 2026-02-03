/**
 * LGS AI-KOÇU - MASTER SCRIPT v4.0 FINAL
 * index.html ve server.js ile Tam Uyumlu + Gelişmiş Sohbet Arayüzü
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
    console.log("🚀 LGS AI-Koçu Final Versiyon Başlatıldı...");
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

// --- 4. SORU MOTORU ---
async function loadQuestion(index) {
    currentQuestionIndex = index;
    const qText = document.getElementById('question-text');
    const aiBox = document.getElementById('ai-response');
    
    qText.innerHTML = '<span class="loading">Soru Hazırlanıyor... 🔥</span>';
    
    // Soru değiştiğinde AI kutusunu sıfırla ve en başa kaydır
    aiBox.innerHTML = "Soruyu çözünce analiz burada görünecek...";
    aiBox.scrollTop = 0; 
    chatHistory = [];

    try {
        const response = await fetch(`/api/question?year=${currentYear}&category=${currentCategory.toLowerCase()}&index=${index}`);
        if (!response.ok) throw new Error("Soru bulunamadı!");
        
        currentQuestion = await response.json();
        renderQuestionUI();
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

    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
    });

    const qKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[qKey]) {
        applyLockedState(examData.userAnswers[qKey].selected, currentQuestion.answer);
    }
}

// --- 5. CEVAP KONTROLÜ VE SKOR MOTORU ---
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

    if (!isCorrect) {
        askAI(null, selected, correctAnswer);
    } else {
        document.getElementById('ai-response').innerHTML = 
            "<div class='ai-msg' style='color:#00ffa5; text-shadow:0 0 10px #00ffa5; font-weight:bold;'>✔️ DOĞRU! Kralsın kanka, böyle devam! 🚀</div>";
    }
}

function calculateLGSScore() {
    const s = examData.stats.sayisal;
    const sz = examData.stats.sozel;
    
    // 3 yanlış 1 doğruyu götürür kuralı
    const sNet = Math.max(0, s.correct - (s.wrong / 3));
    const szNet = Math.max(0, sz.correct - (sz.wrong / 3));
    
    examData.stats.totalNet = sNet + szNet;
    
    // Yaklaşık LGS Katsayıları (Mat/Fen: 4, Diğer: 1.5-2 gibi ama ortalama alıyoruz)
    const sPuan = sNet * 4.0;
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

// --- 6. AI ÖĞRETMEN SOHBET SİSTEMİ ---
async function askAI(customMsg = null, selected = "", correct = "") {
    if (isAiLoading || !currentQuestion) return;
    
    isAiLoading = true;
    const aiBox = document.getElementById('ai-response');

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
            // Kullanıcı ve Hoca mesajlarını ayır
            aiBox.innerHTML += `
                <div class='msg-pair' style='border-top: 1px solid #333; padding: 12px 0; margin-top: 10px;'>
                    <div class='user-msg' style='color:#00ffa5; margin-bottom: 5px;'><b>Sen:</b> ${customMsg}</div>
                    <div class='ai-msg' style='color:#fff;'><b>Hoca:</b> ${reply}</div>
                </div>`;
            aiBox.scrollTo({ top: aiBox.scrollHeight, behavior: 'smooth' });
        } else {
            aiBox.innerHTML = `<div class='ai-msg'><b>Hoca:</b> ${reply}</div>`;
            aiBox.scrollTop = 0; 
        }
        
        chatHistory.push({ role: 'user', text: customMsg || "Bu soruyu anlat." }, { role: 'assistant', text: reply });
        
    } catch (err) {
        aiBox.innerHTML = "⚠️ Hocaya ulaşılamıyor, interneti kontrol et kanka.";
    } finally {
        isAiLoading = false;
    }
}

// --- 7. NAVİGASYON VE ARAÇLAR ---
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

function getNewQuestion() {
    const max = (currentCategory === 'sayisal' ? 40 : 50);
    if (currentQuestionIndex < max) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        alert("Bölümün sonuna geldin kanka, harikasın!");
    }
}

function handleSend() {
    const input = document.getElementById('user-input');
    const val = input.value.trim();
    if (val) {
        askAI(val);
        input.value = "";
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
        }
    });
}

function updateNavHighlight() {
    document.querySelectorAll('.nav-item').forEach(btn => btn.style.boxShadow = "none");
    const active = document.getElementById(`nav-${currentYear}-${currentCategory}-${currentQuestionIndex}`);
    if (active) active.style.boxShadow = "0 0 10px #00ffa5";
}

// --- 8. SPOTIFY VE UI EKLENTİLERİ ---
function toggleSpotify() {
    document.getElementById('spotify-player').classList.toggle('collapsed');
}

function updatePlaylist() {
    const input = document.getElementById('spotify-link-input');
    const iframe = document.getElementById('spotify-iframe');
    let url = input.value;
    if (url.includes('spotify.com')) {
        if (!url.includes('/embed')) url = url.replace('spotify.com/', 'spotify.com/embed/');
        iframe.src = url;
        localStorage.setItem('userPlaylist', url);
    }
}

function loadSavedPlaylist() {
    const saved = localStorage.getItem('userPlaylist');
    if (saved) document.getElementById('spotify-iframe').src = saved;
}

function resetProgress() {
    if (confirm("Bütün emeklerin sıfırlanacak, emin misin kanka?")) {
        localStorage.removeItem('lgs_progress');
        location.reload();
    }
}

function setupSpotifyDragging() {
    const el = document.getElementById('spotify-player');
    const header = document.querySelector('.spotify-header');
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

document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
});

// --- SPOTIFY SİSTEMİ: PC & MOBİL KUSURSUZ BİRLEŞİM ---
const spotPlayer = document.getElementById('spotify-player');
const spotHeader = document.querySelector('.spotify-header');

if (spotHeader && spotPlayer) {
    if (window.innerWidth <= 1024) {
        // MOBİL: İlk açılış ayarları
        spotPlayer.classList.add('minimized');
        spotPlayer.style.left = "auto";
        spotPlayer.style.top = "auto";

        // Tıklama olayı
        spotHeader.addEventListener('click', (e) => {
            // Widget içine tıklanmasını engellememek için sadece header'ı dinliyoruz
            e.stopPropagation(); 
            
            if (spotPlayer.classList.contains('minimized')) {
                spotPlayer.classList.remove('minimized');
                spotPlayer.classList.add('expanded');
                // Açıldığında iframe'in boyutunu tekrar tetikle (Donmayı önler)
                const ifr = document.getElementById('spotify-iframe');
                if(ifr) ifr.style.display = "block";
            } else {
                spotPlayer.classList.remove('expanded');
                spotPlayer.classList.add('minimized');
            }
        });
    } else {
        // PC SÜRÜKLEME SİSTEMİ (Değişmedi, aynen korundu)
        let isDragging = false;
        let offsetX, offsetY;

        spotHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = spotPlayer.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            spotPlayer.style.transition = "none";
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            spotPlayer.style.left = (e.clientX - offsetX) + "px";
            spotPlayer.style.top = (e.clientY - offsetY) + "px";
            spotPlayer.style.bottom = "auto";
            spotPlayer.style.right = "auto";
            spotPlayer.style.transform = "none";
        });

        window.addEventListener('mouseup', () => { isDragging = false; spotPlayer.style.transition = "transform 0.4s ease"; });
    }
}
