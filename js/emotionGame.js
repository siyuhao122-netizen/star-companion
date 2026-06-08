(function() {
    const API_BASE = '/api';
    const TOTAL_ROUNDS = 8;

    const QUESTIONS = [
        { text: '今天是小明的生日，他收到了最喜欢的礼物！', answer: '开心', icon: 'fa-gift', options: ['开心', '难过', '害怕', '平静'] },
        { text: '小美的玩具熊不小心摔坏了，她最喜欢的熊坏了', answer: '难过', icon: 'fa-heart-broken', options: ['难过', '开心', '生气', '惊讶'] },
        { text: '小强正在玩小汽车，突然被其他小朋友抢走了', answer: '生气', icon: 'fa-face-angry', options: ['生气', '开心', '难过', '害怕'] },
        { text: '小华第一次看到魔术表演，帽子变出鸽子！', answer: '惊讶', icon: 'fa-hat-wizard', options: ['惊讶', '平静', '难过', '生气'] },
        { text: '小静坐在窗边，安静的看着外面的花朵', answer: '平静', icon: 'fa-leaf', options: ['平静', '开心', '害怕', '生气'] },
        { text: '小乐要打针了，看着医生拿着针筒走过来', answer: '害怕', icon: 'fa-syringe', options: ['害怕', '开心', '惊讶', '平静'] },
        { text: '小红放学回家，一进门看到妈妈张开了双臂', answer: '开心', icon: 'fa-face-grin-hearts', options: ['开心', '难过', '生气', '平静'] },
        { text: '小刚在黑暗的房间里听到奇怪的声音', answer: '害怕', icon: 'fa-ghost', options: ['害怕', '惊讶', '生气', '平静'] }
    ];

    const EMOTION_EMOJI = { '开心': '😊', '难过': '😢', '生气': '😠', '惊讶': '😲', '害怕': '😨', '平静': '😌' };

    let currentRound = 0;
    let correctCount = 0;
    let roundDetails = [];
    let answered = false;
    let gameStarted = false;

    function speak(text) {
        return new Promise(resolve => {
            if (!window.speechSynthesis) { resolve(); return; }
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'zh-CN'; u.rate = 0.9;
            u.onend = resolve; u.onerror = resolve;
            window.speechSynthesis.speak(u);
        });
    }

    function updateUI() {
        document.getElementById('currentRoundDisplay').textContent = currentRound + 1;
        document.getElementById('correctValue').textContent = correctCount;
        document.getElementById('wrongValue').textContent = currentRound - correctCount;
        const pct = Math.round((currentRound / TOTAL_ROUNDS) * 100);
        document.getElementById('progressPercentText').textContent = pct + '%';
        document.getElementById('progressBarFill').style.width = pct + '%';
    }

    function showRound() {
        if (currentRound >= TOTAL_ROUNDS) return endGame();
        answered = false;
        const q = QUESTIONS[currentRound];
        updateUI();
        document.getElementById('scenarioIcon').innerHTML = `<i class="fas ${q.icon}"></i>`;
        document.getElementById('scenarioContent').textContent = q.text;
        document.getElementById('inlineFeedback').innerHTML = `✨ 第 ${currentRound + 1} 轮：猜猜主人公是什么心情？`;

        const grid = document.getElementById('optionsGrid');
        grid.innerHTML = q.options.map(emo => `
            <div class="emotion-card" data-emotion="${emo}">
                <span class="emo-big">${EMOTION_EMOJI[emo]}</span>
                <span class="emo-name">${emo}</span>
            </div>
        `).join('');

        grid.querySelectorAll('.emotion-card').forEach(c => {
            c.addEventListener('click', () => selectAnswer(c.dataset.emotion));
        });

        speak(q.text + '。猜猜他是什么心情？');
    }

    function selectAnswer(emotion) {
        if (answered) return;
        answered = true;
        const q = QUESTIONS[currentRound];
        const correct = emotion === q.answer;
        if (correct) correctCount++;

        roundDetails.push({ round: currentRound + 1, question: q.text, answer: q.answer, selected: emotion, correct });

        document.querySelectorAll('.emotion-card').forEach(c => {
            c.classList.add('disabled');
            if (c.dataset.emotion === q.answer) c.classList.add('correct');
            if (c.dataset.emotion === emotion && !correct) c.classList.add('wrong');
        });

        updateUI();
        setTimeout(() => { currentRound++; showRound(); }, 1000);
    }

    document.getElementById('skipButton')?.addEventListener('click', () => {
        if (answered || !gameStarted) return;
        answered = true;
        const q = QUESTIONS[currentRound];
        roundDetails.push({ round: currentRound + 1, question: q.text, answer: q.answer, selected: null, correct: false });
        currentRound++;
        showRound();
    });

    document.getElementById('replayBtn')?.addEventListener('click', () => {
        if (!gameStarted) return;
        const q = QUESTIONS[currentRound];
        speak(q.text + '。猜猜他是什么心情？');
    });

    document.getElementById('homeButton')?.addEventListener('click', () => location.href = 'mainPart.html');
    document.getElementById('homeReturnBtn')?.addEventListener('click', () => location.href = 'mainPart.html');

    document.getElementById('startBtn')?.addEventListener('click', async () => {
        gameStarted = true;
        document.getElementById('startOverlay').style.display = 'none';
        await speak('欢迎来到情绪识别小游戏！听故事，猜心情，一共8轮哦。准备好了吗？开始！');
        showRound();
    });

    async function endGame() {
        updateUI();
        document.getElementById('finalTotalRounds').textContent = TOTAL_ROUNDS;
        document.getElementById('finalCorrect').textContent = correctCount;
        const accuracy = Math.round((correctCount / TOTAL_ROUNDS) * 100);
        document.getElementById('finalAccuracy').textContent = accuracy;
        document.getElementById('resultModal').style.display = 'flex';

        const urlParams = new URLSearchParams(window.location.search);
        const childId = urlParams.get('childId') || localStorage.getItem('starCompanionActiveChild');
        if (!childId) { document.getElementById('analysisText').textContent = '未找到宝贝信息'; return; }

        try {
            const resp = await fetch(`${API_BASE}/games/emotion-game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ child_id: parseInt(childId), round_total: TOTAL_ROUNDS, correct_count: correctCount, round_details: roundDetails })
            });
            const r = await resp.json();
            if (!r.success) throw new Error(r.message);

            const aiResp = await fetch(`${API_BASE}/emotion-game-ai/single-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ child_id: parseInt(childId), record_id: r.id })
            });
            const ai = await aiResp.json();
            document.getElementById('analysisText').textContent = ai?.data?.ai_analysis || '分析生成中，请稍后查看';
        } catch (e) {
            document.getElementById('analysisText').textContent = '数据保存失败，请检查网络';
        }
    }
})();
