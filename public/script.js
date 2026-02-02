// --- DEĞİŞKENLER ---
let currentQuestion = null;
let currentQuestionIndex = 1; 
let chatHistory = [];
let currentCategory = 'sayisal'; 
let currentYear = localStorage.getItem('selectedYear') ? parseInt(localStorage.getItem('selectedYear')) : 2025; 

let examData = {
    userAnswers: {}, 
    stats: {
        sayisal: { correct: 0, wrong: 0 },
        sozel: { correct: 0, wrong: 0 },
        totalNet: 0,
        totalScore: 200
    }
};

// --- BAŞLANGIÇ ---
window.onload = async () => {
    // Kayıtlı ilerlemeyi yükle
    const savedData = localStorage.getItem('lgs_progress');
    if (savedData) {
        examData = JSON.parse(savedData);
    }
    
    // Yıl butonlarını aktif et
    updateYearButtonsUI();
    setupNav(); 
    await loadQuestion(1); 
    updateStatsUI();
    loadSavedPlaylist(); 
};

// --- SORU SİSTEMİ ---
async function loadQuestion(index) {
    currentQuestionIndex = index;
    try {
        const response = await fetch(`/api/question?year=${currentYear}&category=${currentCategory.toLowerCase()}&index=${index}`);
        if (!response.ok) return;

        currentQuestion = await response.json();
        displayQuestion();
        updateNavHighlight();
    } catch (err) {
        console.error("Soru yüklenemedi kanka:", err);
    }
}

function displayQuestion() {
    if (!currentQuestion) return;
    
    // Soru Metni
    document.getElementById('question-text').innerText = currentQuestion.question;
    
    // Şıklar ve Reset (Neonları ve renkleri temizler)
    ['A', 'B', 'C', 'D'].forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        btn.innerText = currentQuestion.options[opt];
        btn.className = 'option-btn'; // Tüm sınıfları sıfırla
        btn.style.backgroundColor = ""; // Manuel renkleri temizle
        btn.disabled = false;
    });

    // AI alanını temizle
    document.getElementById('ai-response').innerHTML = "<div>Soruyu çözünce analiz burada görünecek kanka...</div>";
    chatHistory = [];

    // Eğer daha önce çözüldüyse kilitle ve renkleri göster
    const questionKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[questionKey]) {
        const data = examData.userAnswers[questionKey];
        highlightButtons(data.selected, currentQuestion.answer);
    }
}

async function checkAnswer(selected) {
    const questionKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[questionKey]) return; // Zaten çözüldüyse işlem yapma

    const correct = currentQuestion.answer;
    const isCorrect = (selected === correct);
    
    // Veriyi kaydet
    examData.userAnswers[questionKey] = { isCorrect: isCorrect, selected: selected };
    if (isCorrect) {
        examData.stats[currentCategory].correct++;
    } else {
        examData.stats[currentCategory].wrong++;
    }

    // Arayüzü güncelle
    highlightButtons(selected, correct);
    updateNavStatus(questionKey, isCorrect);
    calculateLGSScore();
    
    // Kaydet
    localStorage.setItem('lgs_progress', JSON.stringify(examData));

    // AI Analizi
    if (!isCorrect) {
        askAI(null, selected, correct);
    } else {
        document.getElementById('ai-response').innerHTML = "<b style='color:#00ffa5'>DOĞRU! Harikasın kanka, mermi gibi gidiyorsun.</b>";
    }

    // Bitiş Kontrolü (O yılın o kategorisindeki tüm sorular bitti mi?)
    const totalInCat = currentCategory === 'sayisal' ? 40 : 50;
    const solvedInCat = Object.keys(examData.userAnswers).filter(key => key.startsWith(`${currentYear}-${currentCategory}`)).length;

    if (solvedInCat === totalInCat) {
        setTimeout(showFinishScreen, 1500);
    }
}

// --- GÖRSEL FONKSİYONLAR (NEONLAR) ---
function highlightButtons(selected, correct) {
    ['A', 'B', 'C', 'D'].forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        if (btn) {
            btn.disabled = true;
            if (opt === correct) {
                btn.classList.add('correct'); // Yeşil Neon (CSS'ten gelir)
            } else if (opt === selected && selected !== correct) {
                btn.classList.add('wrong'); // Kırmızı Neon (CSS'ten gelir)
            }
        }
    });
}

function updateNavStatus(key, isCorrect) {
    const navBtn = document.getElementById(`nav-${key}`);
    if (navBtn) navBtn.classList.add(isCorrect ? 'correct' : 'wrong');
}

function updateNavHighlight() {
    document.querySelectorAll('.nav-item').forEach(btn => btn.style.boxShadow = "none");
    const questionKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    const activeBtn = document.getElementById(`nav-${questionKey}`);
    if (activeBtn) activeBtn.style.boxShadow = "0 0 15px #00ffa5";
}

// --- SKOR VE İSTATİSTİK ---
function calculateLGSScore() {
    const sNet = Math.max(0, examData.stats.sayisal.correct - (examData.stats.sayisal.wrong / 3));
    const zNet = Math.max(0, examData.stats.sozel.correct - (examData.stats.sozel.wrong / 3));
    
    examData.stats.totalNet = sNet + zNet;
    const sayisalPuan = sNet * 3.75;
    const sozelPuan = zNet * 3.0;

    examData.stats.totalScore = Math.min(500, 200 + sayisalPuan + sozelPuan);
    updateStatsUI();
}

function updateStatsUI() {
    document.getElementById('stat-correct').innerText = examData.stats.sayisal.correct + examData.stats.sozel.correct;
    document.getElementById('stat-wrong').innerText = examData.stats.sayisal.wrong + examData.stats.sozel.wrong;
    document.getElementById('stat-net').innerText = examData.stats.totalNet.toFixed(2);
    document.getElementById('stat-score').innerText = examData.stats.totalScore.toFixed(2);
}

// --- NAVİGASYON (KATEGORİ & YIL) ---
function setupNav() {
    const navGrid = document.getElementById('question-nav');
    if(!navGrid) return;
    navGrid.innerHTML = ""; 
    const totalQuestions = currentCategory === 'sayisal' ? 40 : 50;
    
    for (let i = 1; i <= totalQuestions; i++) {
        const btn = document.createElement('button');
        const questionKey = `${currentYear}-${currentCategory}-${i}`;
        btn.innerText = i;
        btn.className = 'nav-item';
        btn.id = `nav-${questionKey}`;
        btn.onclick = () => loadQuestion(i);
        if (examData.userAnswers[questionKey]) {
            btn.classList.add(examData.userAnswers[questionKey].isCorrect ? 'correct' : 'wrong');
        }
        navGrid.appendChild(btn);
    }
}

async function setYear(year) {
    currentYear = year;
    localStorage.setItem('selectedYear', year);
    updateYearButtonsUI();
    setupNav(); 
    await loadQuestion(1); 
}

function updateYearButtonsUI() {
    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.innerText) === currentYear);
    });
}

async function setCategory(cat) {
    currentCategory = cat;
    document.getElementById('btn-sayisal').classList.toggle('active', cat === 'sayisal');
    document.getElementById('btn-sozel').classList.toggle('active', cat === 'sozel');
    setupNav(); 
    await loadQuestion(1); 
}

// --- BİTİŞ EKRANI ---
function showFinishScreen() {
    const years = [2020, 2021, 2022, 2023, 2024, 2025];
    let currentIndex = years.indexOf(currentYear);
    
    document.body.innerHTML = ''; 
    document.body.classList.add('exam-finished-mode');

    let prevBtn = currentIndex > 0 ? 
        `<button class="nav-btn neon-btn" onclick="goToYear(${years[currentIndex-1]})">⬅️ ${years[currentIndex-1]}</button>` : '<span></span>';
    
    let nextBtn = currentIndex < years.length - 1 ? 
        `<button class="nav-btn neon-btn" onclick="goToYear(${years[currentIndex+1]})">${years[currentIndex+1]} ➡️</button>` : '<span></span>';

    const finishHTML = `
        <div class="exam-finished-wrapper" style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #050a0c;">
            <div class="score-card finish-container" style="text-align: center; width: 90%; max-width: 450px; padding: 40px; border: 2px solid #00ffa5; border-radius: 20px; background: rgba(10, 25, 30, 0.95); box-shadow: 0 0 30px rgba(0, 255, 165, 0.2);">
                <h2 style="color: #00ffa5; margin-bottom: 25px; font-weight: 900; font-size: 2rem;">🏆 DENEME BİTTİ! 🏆</h2>
                <div style="background: rgba(255,255,255,0.05); padding: 25px; border-radius: 20px; margin-bottom: 25px;">
                    <p style="font-size: 1.8rem; font-weight: 900; color: #fff;">Puan: <span style="color: #00ffa5;">${examData.stats.totalScore.toFixed(2)}</span></p>
                    <p style="color: #aaa;">Toplam Net: ${examData.stats.totalNet.toFixed(2)}</p>
                </div>
                <button class="share-btn" onclick="shareScore()" style="width: 100%; padding: 15px; background: #25d366; color: white; border-radius: 10px; font-weight: 800; border: none; cursor: pointer; margin-bottom: 20px;">WHATSAPP'TA PAYLAŞ</button>
                <div style="display: flex; justify-content: space-between; gap: 10px;">
                    ${prevBtn}
                    ${nextBtn}
                </div>
                <button onclick="location.reload()" style="background: none; border: 1px solid #444; color: #666; margin-top: 30px; cursor: pointer; padding: 10px; border-radius: 8px;">Anasayfaya Dön</button>
            </div>
        </div>`;
    document.body.innerHTML = finishHTML;
}

function goToYear(year) {
    localStorage.setItem('selectedYear', year);
    location.reload();
}

// --- AI & SPOTIFY (Senin Mevcut Fonksiyonların) ---
async function askAI(customMessage = null, userAnswer = "", correctAnswer = "") {
    if (!currentQuestion || isAiLoading) return; 
    isAiLoading = true;
    const aiBox = document.getElementById('ai-response');
    try {
        const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionText: currentQuestion.question,
                userAnswer: userAnswer || (examData.userAnswers[`${currentYear}-${currentCategory}-${currentQuestionIndex}`]?.selected || ""),
                correctAnswer: correctAnswer || currentQuestion.answer,
                userMessage: customMessage,
                chatHistory: chatHistory
            })
        });
        const data = await response.json();
        const formattedReply = data.reply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
        if (customMessage) {
            aiBox.innerHTML += `<div style="margin-top:10px; border-top:1px solid #333; padding-top:10px; color:#00ffa5;"><b>Hoca:</b> ${formattedReply}</div>`;
        } else {
            aiBox.innerHTML = `<div>${formattedReply}</div>`;
        }
        aiBox.scrollTop = aiBox.scrollHeight;
        chatHistory.push({ role: 'assistant', text: data.reply });
    } catch (err) { console.error(err); } finally { isAiLoading = false; }
}

let isAiLoading = false;
function handleSend() {
    const input = document.getElementById('user-input');
    if (input.value.trim() !== "") {
        document.getElementById('ai-response').innerHTML += `<div style="margin-top:10px; color:#aaa;"><b>Sen:</b> ${input.value}</div>`;
        askAI(input.value.trim());
        input.value = "";
    }
}

function toggleSpotify() {
    const player = document.getElementById('spotify-player');
    player.classList.toggle('collapsed');
}

function loadSavedPlaylist() {
    const saved = localStorage.getItem('userLgsPlaylist');
    if (saved) document.getElementById('spotify-iframe').src = saved;
}

function resetProgress() {
    if(confirm("Tüm veriler silinecek kanka, emin misin?")) {
        localStorage.removeItem('lgs_progress');
        location.reload();
    }
}

function shareScore() {
    const text = `LGS AI Koçu ile ${currentYear} denemesinde ${examData.stats.totalScore.toFixed(2)} puan yaptım! 🔥`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
