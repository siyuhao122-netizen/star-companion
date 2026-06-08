(function() {
    const API_BASE = '/api';
    const TOTAL_ROUNDS = 8;

    // 8 道情绪识别题目
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
    const EMOTION_COLOR = { '开心': '#FFD700', '难过': '#87CEEB', '生气': '#FF6B6B', '惊讶': '#FFA07A', '害怕': '#B19CD9', '平静': '#98FB98' };

    let currentRound = 0;
    let correctCount = 0;
    let roundDetails = [];
    let answered = false;

    const startScreen = document.getElementById('startScreen');
    const gameArea = document.getElementById('gameArea');
    const resultScreen = document.getElementById('resultScreen');
    const startBtn = document.getElementById('startBtn');
    const skipBtn = document.getElementById('skipBtn');
    const replayBtn = document.getElementById('replayBtn');

    function speak(text) {
        return new Promise(resolve => {
            if (!window.speechSynthesis) { resolve(); return; }
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'zh-CN';
            u.rate = 0.9;
            u.onend = resolve;
            u.onerror = resolve;
            window.speechSynthesis.speak(u);
        });
    }

    function showRound() {
        if (currentRound >= TOTAL_ROUNDS) return endGame();
        answered = false;
        const q = QUESTIONS[currentRound];
        document.getElementById('roundIndicator').textContent = `第 ${currentRound + 1} / ${TOTAL_ROUNDS} 轮`;
        document.getElementById('progressFill').style.width = `${(currentRound / TOTAL_ROUNDS) * 100}%`;
        document.getElementById('scenarioIcon').innerHTML = `<i class="fas ${q.icon}"></i>`;
        document.getElementById('scenarioText').textContent = q.text;

        // 渲染选项
        const optsEl = document.getElementById('emotionOptions');
        optsEl.innerHTML = q.options.map(emo => `
            <div class="emotion-option" data-emotion="${emo}" style="--emo-color:${EMOTION_COLOR[emo]}">
                <span class="emo-emoji">${EMOTION_EMOJI[emo]}</span>
                <span class="emo-label">${emo}</span>
            </div>
        `).join('');

        optsEl.querySelectorAll('.emotion-option').forEach(opt => {
            opt.addEventListener('click', () => selectAnswer(opt.dataset.emotion));
        });

        // 语音播报
        speak(q.text + '。猜猜他是什么心情？');
    }

    function selectAnswer(emotion) {
        if (answered) return;
        answered = true;
        const q = QUESTIONS[currentRound];
        const correct = emotion === q.answer;
        if (correct) correctCount++;

        roundDetails.push({ round: currentRound + 1, question: q.text, answer: q.answer, selected: emotion, correct });

        // 高亮
        document.querySelectorAll('.emotion-option').forEach(opt => {
            opt.classList.add('disabled');
            if (opt.dataset.emotion === q.answer) opt.classList.add('correct');
            if (opt.dataset.emotion === emotion && !correct) opt.classList.add('wrong');
        });

        setTimeout(() => { currentRound++; showRound(); }, 1200);
    }

    skipBtn?.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const q = QUESTIONS[currentRound];
        roundDetails.push({ round: currentRound + 1, question: q.text, answer: q.answer, selected: null, correct: false });
        currentRound++;
        showRound();
    });

    replayBtn?.addEventListener('click', () => {
        const q = QUESTIONS[currentRound];
        speak(q.text + '。猜猜他是什么心情？');
    });

    startBtn?.addEventListener('click', async () => {
        startScreen.style.display = 'none';
        gameArea.style.display = 'block';
        await speak('欢迎来到情绪识别小游戏！听故事，猜心情，一共8轮哦。准备好了吗？开始！');
        showRound();
    });

    async function endGame() {
        gameArea.style.display = 'none';
        resultScreen.style.display = 'block';
        const accuracy = Math.round((correctCount / TOTAL_ROUNDS) * 100);
        document.getElementById('resultCorrect').textContent = correctCount;
        document.getElementById('resultAccuracy').textContent = accuracy + '%';
        document.getElementById('progressFill').style.width = '100%';

        const urlParams = new URLSearchParams(window.location.search);
        const childId = urlParams.get('childId') || localStorage.getItem('starCompanionActiveChild');
        if (!childId) { document.getElementById('aiContent').textContent = '未找到宝贝信息'; return; }

        // 保存记录
        try {
            const resp = await fetch(`${API_BASE}/games/emotion-game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ child_id: parseInt(childId), round_total: TOTAL_ROUNDS, correct_count: correctCount, round_details: roundDetails })
            });
            const r = await resp.json();
            if (!r.success) throw new Error(r.message);

            // AI 分析
            const aiResp = await fetch(`${API_BASE}/emotion-game-ai/single-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ child_id: parseInt(childId), record_id: r.id })
            });
            const ai = await aiResp.json();
            document.getElementById('aiContent').textContent = ai?.data?.ai_analysis || '分析生成中，请稍后查看';
        } catch (e) {
            document.getElementById('aiContent').textContent = '数据保存失败，请检查网络';
        }
    }
})();
