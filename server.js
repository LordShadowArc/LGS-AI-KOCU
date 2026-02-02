const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const Groq = require('groq-sdk');

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/api/question', (req, res) => {
    try {
        let { year, category, index } = req.query;

        // KRİTİK DOKUNUŞ: Kategori adını her zaman küçük harfe zorla
        const safeCategory = String(category).toLowerCase();
        
        // Yolu oluştururken tam dizini kullan
        const filePath = path.join(__dirname, 'data', String(year), `${safeCategory}.json`);

        console.log(`🔍 Aranan dosya: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ Klasörde bu dosya yok: ${filePath}`);
            return res.status(404).json({ error: "Dosya bulunamadı kanka!" });
        }

        const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const selectedQ = questions.find(q => Number(q.index) === Number(index));

        if (selectedQ) {
            res.json(selectedQ);
        } else {
            res.status(404).json({ error: "Soru bulunamadı!" });
        }
    } catch (err) {
        console.error("⛔ Sunucu Hatası:", err);
        res.status(500).json({ error: "Sistem patladı." });
    }
});

app.post('/api/explain', async (req, res) => {
    const { questionText, userAnswer, correctAnswer, userMessage, chatHistory } = req.body;

    // AI'nın soruya bağımlı kalmasını sağlıyoruz
    if (!questionText || questionText.includes("bulunamadı")) {
        return res.json({ reply: "Kanka önce bir soru yüklemelisin ki sana yardımcı olabileyim! 😊" });
    }

    try {
        let messages = [
            {
                role: "system",
                content: `Sen uzman bir LGS öğretmenisin. Soru: "${questionText}". Doğru cevap: "${correctAnswer}". Samimi ol, motive et, önemli yerleri **kalın** yaz.`
            }
        ];

        if (chatHistory && Array.isArray(chatHistory)) {
            chatHistory.forEach(msg => {
                messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.text });
            });
        }

        let prompt = userMessage || `Bu soruyu ${userAnswer} yaparak yanlış çözdüm. Çözümü anlatır mısın?`;
        messages.push({ role: "user", content: prompt });

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
        });

        res.json({ reply: chatCompletion.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ reply: "Hocan şu an çay molasında, birazdan dene!" });
    }
});

app.listen(3000, () => console.log('🚀 Efsane Sunucu 3000 portunda fişek gibi!'));