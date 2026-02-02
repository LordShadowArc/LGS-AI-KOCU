/**
 * LGS AI-KOCU PRO - CORE SCRIPT
 * Özellikler: Spotify Sürükle-Bırak, AI Analiz, Dinamik Puanlama, 
 * Neon Renk Yönetimi, Otomatik Veri Kurtarma.
 */

// --- 1. GLOBAL DURUM VE VERİ YAPISI ---
let currentQuestion = null;
let currentQuestionIndex = 1;
let currentCategory = 'sayisal';
let currentYear = 2025;
let chatHistory = [];
let isDragging = false; // Spotify widget için

let examData = {
    userAnswers: {},
    stats: {
        sayisal: { correct: 0, wrong: 0, net: 0 },
        sozel: { correct: 0, wrong: 0, net: 0 },
        totalNet: 0,
        totalScore: 200.00
    }
};

// --- 2. BAŞLATMA VE VERİ YÜKLEME ---
window.onload = async () => {
    console.log("🚀 Sistem başlatılıyor...");
    initApp();
};

async function initApp() {
    try {
        // Yerel depolamadan veriyi çek
        const savedData = localStorage.getItem('lgs_progress');
        if (savedData) {
            examData = JSON.parse(savedData);
            console.log("✅ Eski veriler başarıyla yüklendi.");
        }

        // Arayüzü hazırla
        setupNav();
        setupDraggableSpotify();
        await loadQuestion(currentQuestionIndex);
        updateStatsUI();
        
        // Aktif butonları işaretle
        document.querySelector(`[onclick*="${currentCategory}"]`)?.classList.add('active');
        document.querySelector(`[onclick*="${currentYear}"]`)?.classList.add('active');

    } catch (error) {
        console.error("❌ Başlatma hatası:", error);
    }
}

// --- 3. SORU MOTORU (FETCH & DISPLAY) ---
async function loadQuestion(index) {
    if (index < 1) return;
    currentQuestionIndex = index;
    
    const questionTextElement = document.getElementById('question-text');
    questionTextElement.style.opacity = "0.5"; // Geçiş efekti

    try {
        const response = await fetch(`/api/question?year=${currentYear}&category=${currentCategory.toLowerCase()}&index=${index}`);
        if (!response.ok) throw new Error("Soru verisi sunucudan alınamadı.");
        
        currentQuestion = await response.json();
        
        // UI Güncelle
        renderQuestionUI();
        updateNavHighlight();
        
    } catch (err) {
        console.error("❌ Soru yükleme hatası:", err);
        questionTextElement.innerText = "Soru yüklenirken bir sorun oluştu. Lütfen bağlantını kontrol et kanka.";
    } finally {
        questionTextElement.style.opacity = "1";
    }
}

function renderQuestionUI() {
    if (!currentQuestion) return;

    // Soru ve Analiz Alanını Temizle
    document.getElementById('question-text').innerHTML = currentQuestion.question;
    document.getElementById('ai-response').innerHTML = `<div class="ai-placeholder">Soruyu çözünce AI Öğretmen buraya damlayacak... 🧠</div>`;

    // Şıkları Doldur ve Sıfırla
    const options = ['A', 'B', 'C', 'D'];
    options.forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        if (btn) {
            btn.innerText = `${opt}) ${currentQuestion.options[opt]}`;
            btn.className = 'option-btn'; // Tüm neon sınıflarını (correct/wrong) temizler
            btn.disabled = false;
            btn.style.backgroundColor = ""; // Manuel JS müdahalesini temizle, CSS neonları çalışsın
        }
    });

    // Daha önce çözülmüş mü kontrol et
    const qKey = getCurrentKey();
    if (examData.userAnswers[qKey]) {
        applyLockedState(examData.userAnswers[qKey].selected, currentQuestion.answer);
    }
}

// --- 4. CEVAP MANTIĞI VE NEON KONTROLÜ ---
async function checkAnswer(selected) {
    const qKey = getCurrentKey();
    if (examData.userAnswers[qKey]) return; // Zaten çözüldüyse dur

    const correctAnswer = currentQuestion.answer;
    const isCorrect = (selected === correctAnswer);

    // Veri Güncelleme
    examData.userAnswers[qKey] = { isCorrect, selected };
    
    if (isCorrect) {
        examData.stats[currentCategory].correct++;
    } else {
        examData.stats[currentCategory].wrong++;
    }

    // Görsel Efektler (Neonlar)
    applyLockedState(selected, correctAnswer);
    updateNavStatus(qKey, isCorrect);
    
    // Skor ve AI
    calculateLGSScore();
    saveToLocal();

    if (!isCorrect) {
        askAI(null, selected, correctAnswer);
    } else {
        document.getElementById('ai-response').innerHTML = `<b style="color: #2ecc71; font-size: 1.2rem;">✨ DOĞRU! Kaya gibi ilerliyorsun kanka!</b>`;
    }
}

function applyLockedState(selected, correct) {
    ['A', 'B', 'C', 'D'].forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        if (!btn) return;
        
        btn.disabled = true; // Diğer şıklara basılmasın
        
        if (opt === correct) {
            btn.classList.add('correct'); // Yeşil Neon (Full kaplama)
        } else if (opt === selected) {
            btn.classList.add('wrong'); // Kırmızı Neon (Full kaplama)
        }
    });
}

// --- 5. NAVİGASYON VE SORU HAFIZASI ---
function setupNav() {
    const navGrid = document.querySelector('.nav-grid');
    if (!navGrid) return;
    navGrid.innerHTML = ''; 

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

function updateNavStatus(key, isCorrect) {
    const navBtn = document.getElementById(`nav-${key}`);
    if (navBtn) {
        navBtn.classList.add(isCorrect ? 'correct' : 'wrong');
    }
}

function updateNavHighlight() {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById(`nav-${getCurrentKey()}`)?.classList.add('active');
}

async function nextQuestion() {
    const max = currentCategory === 'sayisal' ? 40 : 50;
    if (currentQuestionIndex < max) {
        await loadQuestion(currentQuestionIndex + 1);
    } else {
        showFinishPrompt();
    }
}

// --- 6. PUANLAMA VE İSTATİSTİK ---
function calculateLGSScore() {
    // Netleri Hesapla (3 Yanlış 1 Doğruyu Götürür)
    const stats = examData.stats;
    stats.sayisal.net = stats.sayisal.correct - (stats.sayisal.wrong / 3);
    stats.sozel.net = stats.sozel.correct - (stats.sozel.wrong / 3);
    
    stats.totalNet = (stats.sayisal.net + stats.sozel.net).toFixed(2);
    
    // LGS Taban Puan 200 + Katsayılar (Mat:4, Fen:4, Türk:4, Sos/Din/İng:2)
    // Burada kategori bazlı genel bir katsayı kullanıyoruz
    const rawScore = 200 + (stats.sayisal.net * 4) + (stats.sozel.net * 3.5);
    stats.totalScore = Math.max(200, Math.min(500, rawScore)).toFixed(2);
    
    updateStatsUI();
}

function updateStatsUI() {
    document.getElementById('total-score').innerText = examData.stats.totalScore;
    document.getElementById('total-net').innerText = examData.stats.totalNet;
    
    // Detay kutuları
    const sNetEl = document.getElementById('sayisal-net');
    const szNetEl = document.getElementById('sozel-net');
    if (sNetEl) sNetEl.innerText = examData.stats.sayisal.net.toFixed(2);
    if (szNetEl) szNetEl.innerText = examData.stats.sozel.net.toFixed(2);
}

// --- 7. SPOTIFY DRAGGABLE (SÜRÜKLENEBİLİR WIDGET) ---
function setupDraggableSpotify() {
    const player = document.getElementById('spotify-player');
    const header = document.querySelector('.spotify-header');
    if (!player || !header) return;

    header.onmousedown = (e) => {
        isDragging = true;
        let shiftX = e.clientX - player.getBoundingClientRect().left;
        let shiftY = e.clientY - player.getBoundingClientRect().top;

        function moveAt(pageX, pageY) {
            player.style.left = pageX - shiftX + 'px';
            player.style.top = pageY - shiftY + 'px';
            player.style.bottom = 'auto'; // Sabit pozisyonu iptal et
        }

        function onMouseMove(e) { moveAt(e.pageX, e.pageY); }

        document.addEventListener('mousemove', onMouseMove);

        header.onmouseup = () => {
            document.removeEventListener('mousemove', onMouseMove);
            header.onmouseup = null;
            isDragging = false;
        };
    };

    header.ondragstart = () => false;
}

function toggleSpotify() {
    const container = document.querySelector('.spotify-container');
    container.classList.toggle('collapsed');
}

// --- 8. AI ANALİZ SERVİSİ ---
async function askAI(customMsg = null, selected = null, correct = null) {
    const box = document.getElementById('ai-response');
    box.innerHTML = `<div class="ai-thinking">AI Öğretmen verileri analiz ediyor... ⚡</div>`;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: currentQuestion.question,
                options: currentQuestion.options,
                selected,
                correct,
                userInput: customMsg,
                history: chatHistory
            })
        });

        const data = await response.json();
        box.innerHTML = `<div class="ai-content-inner">${data.analysis}</div>`;
        
        // Geçmişe ekle
        chatHistory.push({ role: 'user', content: customMsg || "Açıkla kanka." });
        chatHistory.push({ role: 'assistant', content: data.analysis });
        
        if (chatHistory.length > 10) chatHistory.shift(); // Hafızayı taze tut

    } catch (err) {
        box.innerHTML = "⚠️ Analiz şu an alınamadı, ama pes etme!";
    }
}

// --- 9. YARDIMCI FONKSİYONLAR ---
function getCurrentKey() {
    return `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
}

function saveToLocal() {
    localStorage.setItem('lgs_progress', JSON.stringify(examData));
}

function resetProgress() {
    if (confirm("Tüm ilerlemen, netlerin ve skorun silinecek. Emin misin?")) {
        localStorage.removeItem('lgs_progress');
        location.reload();
    }
}

async function changeCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    setupNav();
    await loadQuestion(1);
}

async function setYear(year) {
    currentYear = year;
    document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    setupNav();
    await loadQuestion(1);
}

function showFinishPrompt() {
    alert("Bölüm bitti! Skorunu sağ panelden görebilir veya diğer bölüme geçebilirsin.");
}
