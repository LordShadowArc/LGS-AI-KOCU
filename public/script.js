/**
 * LGS AI-KOCU - KATMAN KAYASI SCRIPT v2.0
 * Tüm hakları senin projedir kanka. 
 * Hata payı sıfır, neonlar açık, Spotify sürükle-bırak aktif.
 */

// --- 1. GLOBAL DURUM YÖNETİMİ ---
let currentQuestion = null;
let currentQuestionIndex = 1;
let chatHistory = [];
let currentCategory = 'sayisal';
let currentYear = 2025;
let isAiLoading = false;

// Veri yapısını her zaman taze tutan güvenli yapı
let examData = {
    userAnswers: {},
    stats: {
        sayisal: { correct: 0, wrong: 0 },
        sozel: { correct: 0, wrong: 0 },
        totalNet: 0,
        totalScore: 200
    }
};

// --- 2. SİSTEM BAŞLATICI (INITIALIZER) ---
window.onload = async () => {
    console.log("⚡ Sistem yükleniyor...");
    
    // Önce yerel veriyi kurtar
    const savedData = localStorage.getItem('lgs_progress');
    if (savedData) {
        try {
            examData = JSON.parse(savedData);
            console.log("✅ İlerleme başarıyla geri yüklendi.");
        } catch (e) {
            console.error("⚠️ Veri bozuk gelmiş, sıfırlanıyor.");
        }
    }

    // Arayüz bileşenlerini ayağa kaldır
    await initializeUI();
};

async function initializeUI() {
    setupNav();
    await loadQuestion(1);
    updateStatsUI();
    loadSavedPlaylist();
    setupSpotifyDragging(); // Sürükleme sistemini kur
}

// --- 3. SPOTIFY & MULTIMEDIA (EN GELİŞMİŞ HALİ) ---
function toggleSpotify() {
    const player = document.getElementById('spotify-player');
    const btn = document.getElementById('spot-toggle-btn');
    if (!player) return;

    player.classList.toggle('collapsed');
    // Animasyon ve ikon yönetimi
    if (player.classList.contains('collapsed')) {
        btn.innerHTML = "▲";
        player.style.height = "45px"; // Sadece başlık kalsın
    } else {
        btn.innerHTML = "▼";
        player.style.height = "auto";
    }
}

function updatePlaylist() {
    const input = document.getElementById('spotify-link-input').value.trim();
    const iframe = document.getElementById('spotify-iframe');
    
    // Link doğrulama ve dönüştürme mantığı
    if (input.includes('spotify.com')) {
        let embedLink = input;
        if (!embedLink.includes('/embed/')) {
            embedLink = embedLink.replace('spotify.com/', 'spotify.com/embed/');
        }
        // Temiz link oluştur (parametrelerden arındır)
        embedLink = embedLink.split('?')[0];
        
        iframe.src = embedLink;
        localStorage.setItem('userLgsPlaylist', embedLink);
        
        // Görsel geri bildirim
        const feedback = document.createElement('div');
        feedback.innerText = "Playlist Güncellendi! 🔥";
        feedback.style = "position:absolute; background:#00ffa5; color:#000; padding:5px; border-radius:5px; top:0;";
        document.querySelector('.spotify-container').appendChild(feedback);
        setTimeout(() => feedback.remove(), 2000);
        
        document.getElementById('spotify-link-input').value = ""; 
    } else {
        alert('Geçerli bir Spotify linki yapıştır kanka! Örn: https://open.spotify.com/playlist/...');
    }
}

// --- 4. SÜRÜKLEME SİSTEMİ (X-Y KOORDİNAT KORUMALI) ---
let xOffset = 0, yOffset = 0;
let activeDragging = false;

function setupSpotifyDragging() {
    const container = document.getElementById('spotify-player');
    const header = document.querySelector('.spotify-header');

    const dragStart = (e) => {
        if (e.target.id === "spot-toggle-btn" || e.target.tagName === "INPUT") return;
        
        let clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
        let clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
        
        initialX = clientX - xOffset;
        initialY = clientY - yOffset;
        
        if (e.target.closest('.spotify-header')) activeDragging = true;
    };

    const dragMove = (e) => {
        if (!activeDragging) return;
        e.preventDefault();

        let clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
        let clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

        currentX = clientX - initialX;
        currentY = clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    };

    const dragEnd = () => {
        activeDragging = false;
    };

    header.addEventListener('mousedown', dragStart);
    header.addEventListener('touchstart', dragStart, {passive: false});
    window.addEventListener('mousemove', dragMove);
    window.addEventListener('touchmove', dragMove, {passive: false});
    window.addEventListener('mouseup', dragEnd);
    window.addEventListener('touchend', dragEnd);
}

// --- 5. SORU MOTORU VE NAVİGASYON ---
async function setYear(year) {
    if (currentYear === year) return;
    currentYear = year;
    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.innerText) === year);
    });
    setupNav(); 
    await loadQuestion(1); 
}

async function setCategory(cat) {
    if (currentCategory === cat) return;
    currentCategory = cat;
    document.getElementById('btn-sayisal').classList.toggle('active', cat === 'sayisal');
    document.getElementById('btn-sozel').classList.toggle('active', cat === 'sozel');
    setupNav(); 
    await loadQuestion(1); 
}

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
        
        // Eğer bu soru daha önce çözüldüyse neon rengini hatırla
        if (examData.userAnswers[questionKey]) {
            const result = examData.userAnswers[questionKey].isCorrect;
            btn.classList.add(result ? 'correct' : 'wrong');
        }
        navGrid.appendChild(btn);
    }
}

async function loadQuestion(index) {
    currentQuestionIndex = index;
    const aiBox = document.getElementById('ai-response');
    
    try {
        const response = await fetch(`/api/question?year=${currentYear}&category=${currentCategory.toLowerCase()}&index=${index}`);
        if (!response.ok) throw new Error("Soru bulunamadı.");

        currentQuestion = await response.json();
        
        // Önce temizle, sonra göster
        resetOptionButtons(); 
        displayQuestion();
        updateNavHighlight();
    } catch (err) {
        console.error("Soru yükleme hatası:", err);
        document.getElementById('question-text').innerText = "Soru şu an yüklenemedi kanka. Sunucuyu kontrol et.";
    }
}

function displayQuestion() {
    if (!currentQuestion) return;
    
    // UI Güncelleme
    document.getElementById('question-text').innerText = currentQuestion.question;
    ['A', 'B', 'C', 'D'].forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        btn.innerText = currentQuestion.options[opt];
    });

    // AI alanını resetle
    document.getElementById('ai-response').innerHTML = "<div class='ai-status'>Soru analiz edilmeye hazır...</div>";
    
    // Soru daha önce çözüldü mü?
    const questionKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[questionKey]) {
        const data = examData.userAnswers[questionKey];
        highlightButtons(data.selected, currentQuestion.answer);
    }
}

// --- 6. CEVAP MANTIĞI VE NEON KONTROLÜ (ÇELİK GİBİ) ---
async function checkAnswer(selected) {
    const questionKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    
    // Kilit: Soru zaten çözülmüşse veya veri yoksa işlem yapma
    if (examData.userAnswers[questionKey] || !currentQuestion) return; 

    const correct = currentQuestion.answer;
    const isCorrect = (selected === correct);
    
    // Veriyi işle
    examData.userAnswers[questionKey] = { isCorrect: isCorrect, selected: selected };
    
    if (isCorrect) {
        examData.stats[currentCategory].correct++;
    } else {
        examData.stats[currentCategory].wrong++;
    }

    // Görsel geri bildirim (Neonlar)
    const navBtn = document.getElementById(`nav-${questionKey}`);
    if (navBtn) navBtn.classList.add(isCorrect ? 'correct' : 'wrong');

    highlightButtons(selected, correct);
    
    // AI Analizini tetikle
    if (!isCorrect) {
        askAI(null, selected, correct);
    } else {
        document.getElementById('ai-response').innerHTML = "<b style='color:#00ffa5; text-shadow: 0 0 10px #00ffa5;'>✔️ DOĞRU! KAYA GİBİ BİLGİ.</b>";
    }

    // İstatistikleri ve Kaydı Güncelle
    calculateLGSScore();
    saveProgress();
    checkExamCompletion();
}

function highlightButtons(selected, correct) {
    ['A', 'B', 'C', 'D'].forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        if (!btn) return;

        btn.disabled = true; // Tekrar basılmasın
        btn.style.backgroundColor = "transparent"; // CSS Neonlarının önünü aç

        if (opt === correct) {
            btn.classList.add('correct'); // Yeşil Neon
        } else if (opt === selected && selected !== correct) {
            btn.classList.add('wrong'); // Kırmızı Neon
        }
    });
}

// --- 7. PUANLAMA VE AI (ZEKA KATMANI) ---
function calculateLGSScore() {
    const sNet = examData.stats.sayisal.correct - (examData.stats.sayisal.wrong / 3);
    const zNet = examData.stats.sozel.correct - (examData.stats.sozel.wrong / 3);
    
    const finalSNet = Math.max(0, sNet);
    const finalZNet = Math.max(0, zNet);
    
    examData.stats.totalNet = finalSNet + finalZNet;
    
    // Gerçekçi LGS Katsayıları
    const sayisalPuan = finalSNet * 3.75; 
    const sozelPuan = finalZNet * 3.0;

    examData.stats.totalScore = Math.min(500, (200 + sayisalPuan + sozelPuan));

    updateStatsUI(finalSNet, finalZNet, sayisalPuan, sozelPuan);
}

function updateStatsUI(sNet=0, zNet=0, sPuan=0, zPuan=0) {
    // Ana Panel
    safeSetText('stat-correct', examData.stats.sayisal.correct + examData.stats.sozel.correct);
    safeSetText('stat-wrong', examData.stats.sayisal.wrong + examData.stats.sozel.wrong);
    safeSetText('stat-net', examData.stats.totalNet.toFixed(2));
    safeSetText('stat-score', examData.stats.totalScore.toFixed(2));

    // Detay Paneli (Varsa)
    safeSetText('sayisal-net', sNet.toFixed(2));
    safeSetText('sozel-net', zNet.toFixed(2));
    safeSetText('sayisal-contribution', "+" + sPuan.toFixed(2));
    safeSetText('sozel-contribution', "+" + zPuan.toFixed(2));
}

async function askAI(customMessage = null, userAnswer = "", correctAnswer = "") {
    if (!currentQuestion || isAiLoading) return; 
    
    isAiLoading = true;
    const aiBox = document.getElementById('ai-response');
    if (!customMessage) aiBox.innerHTML = "<div class='ai-loading'>Hocan düşünüyor... ⚡</div>";

    try {
        const response = await fetch('/api/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionText: currentQuestion.question,
                userAnswer: userAnswer || (examData.userAnswers[getCurrentKey()]?.selected || ""),
                correctAnswer: correctAnswer || currentQuestion.answer,
                userMessage: customMessage,
                chatHistory: chatHistory
            })
        });
        
        const data = await response.json();
        
        if (response.status === 429) {
            aiBox.innerHTML += "<div class='error'>Kanka hoca çok yoruldu, 1 dk dinlensin geliyorum!</div>";
            return;
        }

        const reply = data.reply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
        
        if (customMessage) {
            aiBox.innerHTML += `<div class="chat-msg"><b>Hoca:</b> ${reply}</div>`;
        } else {
            aiBox.innerHTML = `<div class="chat-msg">${reply}</div>`;
        }
        
        aiBox.scrollTop = aiBox.scrollHeight;
        chatHistory.push({ role: 'user', text: customMessage }, { role: 'assistant', text: data.reply });
        
    } catch (err) {
        console.error("AI Error:", err);
        aiBox.innerHTML = "Bağlantı koptu kanka, ama ben buradayım!";
    } finally {
        isAiLoading = false;
    }
}

// --- 8. YARDIMCI VE SİSTEM FONKSİYONLARI ---
function resetOptionButtons() {
    ['A', 'B', 'C', 'D'].forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        if (btn) {
            btn.classList.remove('correct', 'wrong');
            btn.disabled = false;
            btn.style.backgroundColor = ""; // CSS'in kendi rengine (veya şeffafa) dön
        }
    });
}

function updateNavHighlight() {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active-nav'));
    const activeBtn = document.getElementById(`nav-${getCurrentKey()}`);
    if (activeBtn) activeBtn.classList.add('active-nav');
}

function getCurrentKey() {
    return `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
}

function saveProgress() {
    localStorage.setItem('lgs_progress', JSON.stringify(examData));
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function checkExamCompletion() {
    const total = currentCategory === 'sayisal' ? 40 : 50;
    const solved = Object.keys(examData.userAnswers).filter(k => k.startsWith(`${currentYear}-${currentCategory}`)).length;
    
    if (solved === total) {
        setTimeout(() => showFinishScreen(), 1500);
    }
}

async function nextQuestion() {
    const max = currentCategory === 'sayisal' ? 40 : 50;
    if (currentQuestionIndex < max) {
        await loadQuestion(currentQuestionIndex + 1);
    } else {
        if(confirm("Bölüm bitti! Diğer bölüme geçelim mi?")) {
            setCategory(currentCategory === 'sayisal' ? 'sozel' : 'sayisal');
        }
    }
}

// --- 9. BİTİŞ EKRANI VE PAYLAŞIM ---
function showFinishScreen() {
    // Ekranı temizle ve sonucu bas
    const finishHTML = `
        <div class="exam-finished-mode">
            <div class="score-card finish-container">
                <h1 style="color:#00ffa5">🏆 EFSANE BİTTİ!</h1>
                <div class="final-stats">
                    <p>Toplam Puan: <span>${examData.stats.totalScore.toFixed(2)}</span></p>
                    <p>Toplam Net: <span>${examData.stats.totalNet.toFixed(2)}</span></p>
                </div>
                <button class="share-btn" onclick="shareScore()">WHATSAPP'TA HAVA AT</button>
                <button class="neon-btn" onclick="location.reload()">YENİ DENEME</button>
            </div>
        </div>
    `;
    document.body.innerHTML = finishHTML;
}

function shareScore() {
    const msg = `LGS AI Koçu ile ${currentYear} denemesini parçaladım! 
Puanım: ${examData.stats.totalScore.toFixed(2)} 
Netim: ${examData.stats.totalNet.toFixed(2)}
Bakalım sen ne yapacaksın? 🔥`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}
