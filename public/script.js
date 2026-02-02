let currentQuestion = null;
let currentQuestionIndex = 1; 
let chatHistory = [];
let currentCategory = 'sayisal'; 
let currentYear = 2025; 

let examData = {
    userAnswers: {}, 
    stats: {
        sayisal: { correct: 0, wrong: 0 },
        sozel: { correct: 0, wrong: 0 },
        totalNet: 0,
        totalScore: 200
    }
};

window.onload = async () => {
    setupNav(); 
    await loadQuestion(1); 
    updateStatsUI();
    loadSavedPlaylist(); 
};

// --- SPOTIFY ÖZELLİKLERİ ---
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
        let embedLink = input;
        if (!embedLink.includes('/embed/')) {
            embedLink = embedLink.replace('open.spotify.com', 'open.spotify.com/embed');
        }
        if (embedLink.includes('?')) {
            embedLink = embedLink.split('?')[0];
        }
        iframe.src = embedLink;
        localStorage.setItem('userLgsPlaylist', embedLink);
        alert('Playlist başarıyla güncellendi kanka!');
        document.getElementById('spotify-link-input').value = ""; 
    } else {
        alert('Geçerli bir Spotify linki yapıştır kanka!');
    }
}

// --- SÜRÜKLEME ÖZELLİĞİ (HEM MOBİL HEM PC) ---
const playlistContainer = document.getElementById('spotify-player');
let isDragging = false;
let currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

function dragStart(e) {
    // Toggle butonuna basınca sürükleme olmasın
    if (e.target.id === "spot-toggle-btn") return;

    if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
    } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
    }
    
    if (e.target.closest('.spotify-header') || e.target === playlistContainer) {
        isDragging = true;
    }
}

function dragEnd() {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        if (e.type === "touchmove") {
            currentX = e.touches[0].clientX - initialX;
            currentY = e.touches[0].clientY - initialY;
        } else {
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
        }
        xOffset = currentX;
        yOffset = currentY;
        playlistContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
}

// Sürükleme Dinleyicileri
playlistContainer.addEventListener("touchstart", dragStart, {passive: false});
window.addEventListener("touchend", dragEnd);
window.addEventListener("touchmove", drag, {passive: false});

playlistContainer.addEventListener("mousedown", dragStart);
window.addEventListener("mouseup", dragEnd);
window.addEventListener("mousemove", drag);

function loadSavedPlaylist() {
    const saved = localStorage.getItem('userLgsPlaylist');
    const iframe = document.getElementById('spotify-iframe');
    if (saved && iframe) iframe.src = saved;
}

// --- SİSTEM ENTEGRASYON FONKSİYONLARI ---

async function setYear(year) {
    currentYear = year;
    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.innerText) === year);
    });
    setupNav(); 
    await loadQuestion(1); 
}

async function setCategory(cat) {
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
        if (examData.userAnswers[questionKey]) {
            const result = examData.userAnswers[questionKey].isCorrect;
            btn.classList.add(result ? 'correct' : 'wrong');
        }
        navGrid.appendChild(btn);
    }
}

async function loadQuestion(index) {
    currentQuestionIndex = index;
    try {
        const response = await fetch(`/api/question?year=${currentYear}&category=${currentCategory.toLowerCase()}&index=${index}`);
        
        if (!response.ok) {
            currentQuestion = null;
            return;
        }

        currentQuestion = await response.json();
        resetOptionButtons(); // Butonları her yeni soruda temizle
        displayQuestion();
        updateNavHighlight();
    } catch (err) {
        console.error("Soru yüklenemedi:", err);
    }
}

function resetOptionButtons() {
    const options = ['A', 'B', 'C', 'D'];
    options.forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        if (btn) {
            btn.classList.remove('correct', 'wrong'); // Neon renkleri temizle
            btn.disabled = false;
        }
    });
}

function displayQuestion() {
    if (!currentQuestion) return;
    
    // Soru metni
    document.getElementById('question-text').innerText = currentQuestion.question;
    
    // Şıklar (Sadece bunlar kalsın, çift harf olmaması için tertemiz hali)
    document.getElementById('opt-A').innerText = currentQuestion.options.A;
    document.getElementById('opt-B').innerText = currentQuestion.options.B;
    document.getElementById('opt-C').innerText = currentQuestion.options.C;
    document.getElementById('opt-D').innerText = currentQuestion.options.D;

    chatHistory = [];
    document.getElementById('ai-response').innerHTML = "<div>Soruyu çözünce analiz burada görünecek...</div>";
    resetOptionButtons();

    const questionKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[questionKey]) {
        lockButtonsForSolvedQuestion(questionKey);
    }
}

async function checkAnswer(selected) {
    const questionKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    if (examData.userAnswers[questionKey]) return; 

    const correct = currentQuestion.answer;
    const isCorrect = (selected === correct);
    examData.userAnswers[questionKey] = { isCorrect: isCorrect, selected: selected };
    
    if (isCorrect) {
        examData.stats[currentCategory].correct++;
    } else {
        examData.stats[currentCategory].wrong++;
    }

    const navBtn = document.getElementById(`nav-${questionKey}`);
    if (navBtn) navBtn.classList.add(isCorrect ? 'correct' : 'wrong');

    highlightButtons(selected, correct);
    
    if (!isCorrect) {
        askAI(null, selected, correct);
    } else {
        document.getElementById('ai-response').innerHTML = "<b style='color:#00bfa5'>DOĞRU! Harikasın kanka.</b>";
    }
    calculateLGSScore();
    localStorage.setItem('lgs_progress', JSON.stringify(examData));
    // Soruyu çözünce yılın bitip bitmediğini kontrol et
    const category = currentCategory.toLowerCase();
    const allQuestionsInYear = Object.keys(questionsData[currentYear][category]).length;
    const solvedQuestionsInYear = Object.keys(examData.userAnswers).filter(key => key.startsWith(`${currentYear}-`)).length;

    if (solvedQuestionsInYear === allQuestionsInYear) {
        setTimeout(() => {
            showFinishScreen(); // Bütün sorular bittiyse sonuç ekranını aç
        }, 1200);
    }
}

function calculateLGSScore() {
    const sNet = examData.stats.sayisal.correct - (examData.stats.sayisal.wrong / 3);
    const zNet = examData.stats.sozel.correct - (examData.stats.sozel.wrong / 3);
    
    const finalSNet = Math.max(0, sNet);
    const finalZNet = Math.max(0, zNet);
    
    examData.stats.totalNet = finalSNet + finalZNet;
    const sayisalPuan = finalSNet * 3.75;
    const sozelPuan = finalZNet * 3.0;

    let totalScore = 200 + sayisalPuan + sozelPuan;
    examData.stats.totalScore = Math.min(500, totalScore);

    document.getElementById('sayisal-net').innerText = finalSNet.toFixed(2);
    document.getElementById('sozel-net').innerText = finalZNet.toFixed(2);
    document.getElementById('sayisal-contribution').innerText = "+" + sayisalPuan.toFixed(2);
    document.getElementById('sozel-contribution').innerText = "+" + sozelPuan.toFixed(2);
    
    updateStatsUI();
}

function updateStatsUI() {
    document.getElementById('stat-correct').innerText = examData.stats.sayisal.correct + examData.stats.sozel.correct;
    document.getElementById('stat-wrong').innerText = examData.stats.sayisal.wrong + examData.stats.sozel.wrong;
    document.getElementById('stat-net').innerText = examData.stats.totalNet.toFixed(2);
    document.getElementById('stat-score').innerText = examData.stats.totalScore.toFixed(2);
}

function updateNavHighlight() {
    document.querySelectorAll('.nav-item').forEach(btn => btn.style.boxShadow = "none");
    const questionKey = `${currentYear}-${currentCategory}-${currentQuestionIndex}`;
    const activeBtn = document.getElementById(`nav-${questionKey}`);
    if (activeBtn) activeBtn.style.boxShadow = "0 0 15px #00bfa5";
}

function highlightButtons(selected, correct) {
    const options = ['A', 'B', 'C', 'D'];
    options.forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        if (opt === correct) {
            // Doğru şıkkı yeşil neon yapar
            btn.classList.add('correct');
        } else if (opt === selected && selected !== correct) {
            // Yanlış seçilen şıkkı kırmızı neon yapar
            btn.classList.add('wrong');
        }
    });
}

function lockButtonsForSolvedQuestion(key) {
    const data = examData.userAnswers[key];
    if(currentQuestion) highlightButtons(data.selected, currentQuestion.answer);
}

let isAiLoading = false; // Üst üste istek gitmesini engeller

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
        
        // Eğer API kota hatası verirse kullanıcıya bildir
        if (response.status === 429) {
            aiBox.innerHTML = "<div><b>Hocan şu an çay molasında kanka, birazdan tekrar dene!</b></div>";
            return;
        }

        const formattedReply = data.reply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
        
        if (customMessage) {
            chatHistory.push({ role: 'user', text: customMessage });
            aiBox.innerHTML += `<div style="margin-top:10px; border-top:1px solid #333; padding-top:10px; color:#00bfa5;"><b>Hoca:</b> ${formattedReply}</div>`;
        } else {
            aiBox.innerHTML = `<div>${formattedReply}</div>`;
        }
        
        aiBox.scrollTop = aiBox.scrollHeight;
        chatHistory.push({ role: 'assistant', text: data.reply });
    } catch (err) { 
        console.error("AI Hatası:", err); 
        aiBox.innerHTML = "<div>Bağlantıda bir sorun oldu kanka, bir sonraki soruda tekrar deneriz!</div>";
    } finally {
        isAiLoading = false; // Her durumda kilidi aç ki sistem kilitlenmesin
    }
}

function resetOptionButtons() {
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.style.backgroundColor = "#fafafa";
        btn.disabled = false;
    });
}

function handleSend() {
    const input = document.getElementById('user-input');
    if (input.value.trim() !== "") {
        const aiBox = document.getElementById('ai-response');
        aiBox.innerHTML += `<div style="margin-top:10px; color:#aaa;"><b>Sen:</b> ${input.value}</div>`;
        askAI(input.value.trim());
        input.value = "";
    }
}

async function getNewQuestion() {
    const maxQ = currentCategory === 'sayisal' ? 40 : 50;
    if (currentQuestionIndex < maxQ) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        const onay = confirm(`${currentCategory.toUpperCase()} bitti! Diğer bölüme geçelim mi kanka?`);
        if (onay) setCategory(currentCategory === 'sayisal' ? 'sozel' : 'sayisal');
    }
}

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.activeElement.id === 'user-input') handleSend();
});

// Sayfa açıldığında eski verileri yükle
window.addEventListener('load', () => {
    const savedData = localStorage.getItem('lgs_progress');
    if (savedData) {
        examData = JSON.parse(savedData);
        updateStatsUI();
        setupNav();
    }
});

// Her doğru/yanlış cevaptan sonra veriyi kaydet
// Bu satırı mevcut checkAnswer fonksiyonunun en sonuna eklemelisin:
// localStorage.setItem('lgs_progress', JSON.stringify(examData));

function resetProgress() {
    if(confirm("Tüm skorların ve çözdüğün sorular silinecek. Emin misin kanka?")) {
        localStorage.removeItem('lgs_progress');
        location.reload(); // Sayfayı yenileyerek her şeyi tertemiz yapar
    }
}

// Şıkları neon yapan asıl fonksiyon
function highlightButtons(selected, correct) {
    const options = ['A', 'B', 'C', 'D'];
    options.forEach(opt => {
        const btn = document.getElementById(`opt-${opt}`);
        if (btn) {
            if (opt === correct) {
                btn.classList.add('correct'); // Doğru şıkkı yeşil neon yapar
            } else if (opt === selected && selected !== correct) {
                btn.classList.add('wrong'); // Yanlış seçileni kırmızı neon yapar
            }
            btn.disabled = true; // Diğer şıklara basılmasını engeller
        }
    });
}
function showFinishScreen() {
    const years = [2020, 2021, 2022, 2023, 2024, 2025];
    let currentIndex = years.indexOf(parseInt(currentYear));
    
    // 1. Ekranı temizle ve karart
    document.body.innerHTML = ''; 
    document.body.classList.add('exam-finished-mode');

    // 2. Akıllı Butonlar: Sadece varsa önceki ve sonraki yıl butonlarını ayarla
    let prevBtn = currentIndex > 0 ? 
        `<button class="nav-btn neon-btn" onclick="goToYear(${years[currentIndex-1]})">⬅️ ${years[currentIndex-1]} Denemesi</button>` : '<span></span>';
    
    let nextBtn = currentIndex < years.length - 1 ? 
        `<button class="nav-btn neon-btn" onclick="goToYear(${years[currentIndex+1]})">${years[currentIndex+1]} Denemesi ➡️</button>` : '<span></span>';

    // 3. Dev Skor Tablosu ve Paylaşım Alanı
    const finishHTML = `
        <div class="exam-finished-wrapper" style="display: flex; justify-content: center; align-items: center; min-height: 100vh;">
            <div class="score-card finish-container" style="text-align: center; width: 450px; padding: 40px; border: 2px solid #00ffa5; box-shadow: 0 0 30px rgba(0, 255, 165, 0.3); border-radius: 20px; background: rgba(10, 25, 30, 0.9);">
                <h2 style="color: #00ffa5; margin-bottom: 25px; text-shadow: 0 0 15px #00ffa5; font-weight: 900; font-size: 2rem;">🏆 DENEME BİTTİ! 🏆</h2>
                
                <div style="background: rgba(255,255,255,0.05); padding: 25px; border-radius: 20px; margin-bottom: 25px; border: 1px solid rgba(0,255,165,0.2);">
                    <p style="font-size: 1.8rem; font-weight: 900; color: #fff; margin: 0;">Puan: <span style="color: #00ffa5;">${examData.stats.totalScore.toFixed(2)}</span></p>
                    <p style="font-size: 1.3rem; color: #aaa; margin-top: 10px;">Toplam Net: ${examData.stats.totalNet.toFixed(2)}</p>
                </div>
                
                <button class="share-btn" onclick="shareScore()" style="width: 100%; padding: 18px; background: #25d366; color: white; border-radius: 12px; font-weight: 900; border: none; cursor: pointer; margin-bottom: 25px; font-size: 1.1rem;">WHATSAPP'TA PAYLAŞ</button>
                
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 15px;">
                    ${prevBtn}
                    ${nextBtn}
                </div>
                
                <button onclick="location.reload()" style="background: none; border: 1px solid #444; color: #666; margin-top: 30px; cursor: pointer; padding: 10px 20px; border-radius: 8px; font-weight: 600;">Anasayfaya Dön</button>
            </div>
        </div>
    `;
    
    document.body.innerHTML = finishHTML;
}

// Yıl değiştirme motoru
function goToYear(year) {
    localStorage.setItem('selectedYear', year);
    location.reload();
}

// WhatsApp paylaşım motoru
function shareScore() {
    const text = `Kanka LGS AI Koçu ile ${currentYear} denemesini bitirdim! Puanım: ${examData.stats.totalScore.toFixed(2)}, Netim: ${examData.stats.totalNet.toFixed(2)}. Bakalım sen beni geçebilecek misin? 🔥`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
