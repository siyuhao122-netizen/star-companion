(function () {
    const API_BASE = 'http://localhost:7653/api';

    let childId = localStorage.getItem('starCompanionActiveChild');
    const urlParams = new URLSearchParams(window.location.search);
    const urlChildId = urlParams.get('childId');
    if (!childId && urlChildId) childId = urlChildId;
    if (childId) childId = parseInt(childId);

    const TOTAL_ROUNDS = 8;

    // ========== 场景题库（8组场景） ==========
    const SCENES = [
        {
            emoji: '🎂', scene: '今天是小明的生日，他收到了最喜欢的礼物！',
            correct: '开心', voice: '今天是小明的生日，他收到了最喜欢的礼物，猜猜小明的心情怎么样？'
        },
        {
            emoji: '🧸', scene: '小美的玩具熊不小心摔坏了，她最喜欢的熊坏了。',
            correct: '伤心', voice: '小美最喜欢的玩具熊摔坏了，她看着坏掉的熊，心情会是什么样的呢？'
        },
        {
            emoji: '🚗', scene: '小强正在玩小汽车，突然被其他小朋友抢走了。',
            correct: '生气', voice: '小强正在开心地玩小汽车，突然被人抢走了，他现在的感觉是什么？'
        },
        {
            emoji: '🌙', scene: '夜晚来了，房间里黑黑的，只有小亮一个人。',
            correct: '害怕', voice: '天黑了，房间里很暗，只有小亮一个人待着，他是什么感受呢？'
        },
        {
            emoji: '🎪', scene: '小华第一次看到魔术表演，帽子变出鸽子！',
            correct: '惊讶', voice: '小华第一次看到魔术表演，帽子一打开飞出了一只鸽子，他是什么表情？'
        },
        {
            emoji: '🌸', scene: '小静坐在窗边，安静地看着外面的花朵。',
            correct: '平静', voice: '小静安静地坐在窗边，看着外面的花朵，微风轻轻吹过，她现在感觉怎么样？'
        },
        {
            emoji: '🏥', scene: '小乐要打针了，看着医生拿着针筒走过来。',
            correct: '害怕', voice: '小乐要打针了，看到医生拿着针筒走过来，他会是什么感觉呢？'
        },
        {
            emoji: '🤗', scene: '小红放学回家，一进门看到妈妈张开了双臂。',
            correct: '开心', voice: '小红放学回家，一进门就看到妈妈张开双臂要抱抱，她心里是什么感觉？'
        }
    ];

    // 所有可能的情绪
    const EMOTIONS = ['开心', '伤心', '生气', '害怕', '惊讶', '平静'];

    // DOM 元素
    const currentRoundSpan = document.getElementById('currentRoundDisplay');
    const totalRoundsSpan = document.getElementById('totalRoundsDisplay');
    const sceneEmoji = document.getElementById('sceneEmoji');
    const sceneDesc = document.getElementById('sceneDesc');
    const sceneQuestion = document.getElementById('sceneQuestion');
    const voiceBtn = document.getElementById('voiceBtn');
    const feedbackBar = document.getElementById('feedbackBar');
    const correctSpan = document.getElementById('correctValue');
    const wrongSpan = document.getElementById('wrongValue');
    const skippedSpan = document.getElementById('skippedCount');
    const progressFill = document.getElementById('progressBarFill');
    const progressPercent = document.getElementById('progressPercentText');
    const optionsContainer = document.getElementById('optionsContainer');
    const skipBtn = document.getElementById('skipBtn');
    const endBtn = document.getElementById('endBtn');
    const homeBtn = document.getElementById('homeButton');
    const resultModal = document.getElementById('resultModal');
    const homeReturnBtn = document.getElementById('homeReturnBtn');
    const finalTotal = document.getElementById('finalTotal');
    const finalCorrect = document.getElementById('finalCorrect');
    const finalWrong = document.getElementById('finalWrong');
    const finalSkip = document.getElementById('finalSkip');
    const finalAccuracy = document.getElementById('finalAccuracy');
    const finalTotalTime = document.getElementById('finalTotalTime');
    const finalMaxTime = document.getElementById('finalMaxTime');
    const finalMinTime = document.getElementById('finalMinTime');
    const analysisText = document.getElementById('analysisText');

    totalRoundsSpan.textContent = TOTAL_ROUNDS;

    // 游戏状态
    let currentRound = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skipCount = 0;
    let roundDetails = [];
    let roundTimes = [];
    let roundStartTime = 0;
    let isAnswering = false;
    let gameEnded = false;
    let speechSynth = window.speechSynthesis;
    let currentUtterance = null;

    // ========== 语音播报 ==========
    function speak(text) {
        if (!speechSynth) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        currentUtterance = utterance;
        voiceBtn.classList.add('speaking');
        utterance.onend = () => {
            voiceBtn.classList.remove('speaking');
            currentUtterance = null;
        };
        utterance.onerror = () => {
            voiceBtn.classList.remove('speaking');
            currentUtterance = null;
        };
        speechSynth.speak(utterance);
    }

    // ========== 洗牌 ==========
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ========== 生成选项（1个正确+3个干扰） ==========
    function generateOptions(correctEmotion) {
        const others = EMOTIONS.filter(e => e !== correctEmotion);
        const shuffledOthers = shuffle([...others]);
        const distractors = shuffledOthers.slice(0, 3);
        return shuffle([correctEmotion, ...distractors]);
    }

    // ========== 获取情绪对应的表情 ==========
    function getEmojiForEmotion(emotion) {
        const map = {
            '开心': '😊', '伤心': '😢', '生气': '😡',
            '害怕': '😨', '惊讶': '😲', '平静': '😌'
        };
        return map[emotion] || '😊';
    }

    // ========== 开始一轮 ==========
    function startRound() {
        if (gameEnded || currentRound >= TOTAL_ROUNDS) {
            endGame();
            return;
        }

        isAnswering = true;
        roundStartTime = Date.now();
        const scene = SCENES[currentRound];

        // 更新UI
        sceneEmoji.textContent = scene.emoji;
        sceneDesc.textContent = scene.scene;
        sceneQuestion.textContent = '猜猜他/她现在是什么心情？';
        currentRoundSpan.textContent = currentRound + 1;

        // 自动语音播报
        setTimeout(() => speak(scene.voice), 300);

        // 生成选项
        const options = generateOptions(scene.correct);
        optionsContainer.innerHTML = '';
        options.forEach(emotion => {
            const btn = document.createElement('div');
            btn.className = 'emotion-option';
            btn.setAttribute('data-emotion', emotion);
            btn.innerHTML = `
                <div class="option-emoji">${getEmojiForEmotion(emotion)}</div>
                <div class="option-label">${emotion}</div>
            `;
            btn.addEventListener('click', () => handleOptionClick(btn, emotion, scene.correct));
            optionsContainer.appendChild(btn);
        });

        feedbackBar.textContent = `🎯 第 ${currentRound + 1} 轮：听场景，选心情`;
        updateProgress();
        // 启用跳过
        skipBtn.disabled = false;
    }

    // ========== 处理选项点击 ==========
    function handleOptionClick(btn, selected, correct) {
        if (!isAnswering || gameEnded) return;
        isAnswering = false;
        skipBtn.disabled = true;

        const allOptions = document.querySelectorAll('.emotion-option');
        allOptions.forEach(el => el.style.pointerEvents = 'none');

        const isCorrect = selected === correct;
        const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
        roundTimes.push(elapsed);

        roundDetails.push({
            round: currentRound + 1,
            scene: SCENES[currentRound].scene,
            correct_answer: correct,
            selected: selected,
            is_correct: isCorrect,
            skipped: false,
            time_sec: elapsed
        });

        if (isCorrect) {
            btn.classList.add('correct');
            correctCount++;
            correctSpan.textContent = correctCount;
            feedbackBar.textContent = `✅ 对啦！场景中的心情是「${correct}」呀！`;
            speak(`对啦，是${correct}的心情`);
        } else {
            btn.classList.add('wrong');
            // 高亮正确答案
            allOptions.forEach(el => {
                if (el.getAttribute('data-emotion') === correct) {
                    el.classList.add('correct');
                }
            });
            wrongCount++;
            wrongSpan.textContent = wrongCount;
            feedbackBar.textContent = `❌ 是「${correct}」哦，再想想～`;
            speak(`是${correct}的心情哦`);
        }

        updateStats();
        setTimeout(nextRound, 1200);
    }

    // ========== 跳过本轮 ==========
    function skipRound() {
        if (!isAnswering || gameEnded) return;
        isAnswering = false;
        skipBtn.disabled = true;

        window.speechSynthesis.cancel();
        voiceBtn.classList.remove('speaking');

        const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
        roundTimes.push(elapsed);

        roundDetails.push({
            round: currentRound + 1,
            scene: SCENES[currentRound].scene,
            correct_answer: SCENES[currentRound].correct,
            selected: null,
            is_correct: false,
            skipped: true,
            time_sec: elapsed
        });

        skipCount++;
        skippedSpan.textContent = skipCount;
        feedbackBar.textContent = `⏭️ 已跳过第 ${currentRound + 1} 轮，正确答案是「${SCENES[currentRound].correct}」`;
        speak(`正确答案是${SCENES[currentRound].correct}`);

        // 显示正确答案
        document.querySelectorAll('.emotion-option').forEach(el => {
            el.style.pointerEvents = 'none';
            if (el.getAttribute('data-emotion') === SCENES[currentRound].correct) {
                el.classList.add('correct');
            }
        });

        updateStats();
        setTimeout(nextRound, 1000);
    }

    // ========== 下一轮 ==========
    function nextRound() {
        currentRound++;
        if (currentRound >= TOTAL_ROUNDS) {
            endGame();
        } else {
            startRound();
        }
    }

    // ========== 更新进度 ==========
    function updateProgress() {
        const done = Math.min(currentRound, TOTAL_ROUNDS);
        const pct = Math.round((done / TOTAL_ROUNDS) * 100);
        progressFill.style.width = pct + '%';
        progressPercent.textContent = pct + '%';
    }

    function updateStats() {
        // 已通过 handleOptionClick/skipRound 更新
    }

    // ========== 结束游戏 ==========
    function endGame() {
        if (gameEnded) return;
        gameEnded = true;
        skipBtn.disabled = true;

        window.speechSynthesis.cancel();
        voiceBtn.classList.remove('speaking');

        document.querySelectorAll('.emotion-option').forEach(el => {
            el.style.pointerEvents = 'none';
        });

        updateProgress();

        const totalAnswered = correctCount + wrongCount;
        const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

        // 计算用时统计
        const totalTime = roundTimes.reduce((a, b) => a + b, 0);
        const maxTime = roundTimes.length > 0 ? Math.max(...roundTimes) : 0;
        const minTime = roundTimes.length > 0 ? Math.min(...roundTimes) : 0;

        // 显示结果
        finalTotal.textContent = TOTAL_ROUNDS;
        finalCorrect.textContent = correctCount;
        finalWrong.textContent = wrongCount;
        finalSkip.textContent = skipCount;
        finalAccuracy.textContent = accuracy;
        finalTotalTime.textContent = totalTime;
        finalMaxTime.textContent = maxTime;
        finalMinTime.textContent = minTime;

        resultModal.classList.add('show');

        // 保存并获取AI分析
        saveAndAnalyze(accuracy);
    }

    // ========== 保存并调用AI分析 ==========
    async function saveAndAnalyze(accuracy) {
        if (!childId) return;

        const payload = {
            child_id: childId,
            round_total: TOTAL_ROUNDS,
            correct_count: correctCount,
            wrong_count: wrongCount,
            round_details: roundDetails
        };

        try {
            // 先保存记录
            const saveRes = await fetch(`${API_BASE}/games/emotion-game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const saveData = await saveRes.json();
            const recordId = saveData.id;

            // 调用AI分析
            if (recordId) {
                const aiRes = await fetch(`${API_BASE}/emotion-game-ai/analyze/${recordId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const aiData = await aiRes.json();
                if (aiData.success && aiData.data && aiData.data.ai_analysis) {
                    analysisText.textContent = aiData.data.ai_analysis;
                } else {
                    generateLocalAnalysis(accuracy);
                }
            } else {
                generateLocalAnalysis(accuracy);
            }
        } catch (error) {
            console.error('保存或AI分析失败:', error);
            generateLocalAnalysis(accuracy);
        }
    }

    // ========== 本地生成分析（兜底） ==========
    function generateLocalAnalysis(accuracy) {
        const totalTime = roundTimes.reduce((a, b) => a + b, 0);
        const maxTime = roundTimes.length > 0 ? Math.max(...roundTimes) : 0;
        const minTime = roundTimes.length > 0 ? Math.min(...roundTimes) : 0;
        const avgTime = roundTimes.length > 0 ? Math.round(totalTime / roundTimes.length) : 0;

        let text = '';
        if (correctCount === 0 && wrongCount === 0) {
            text = '还没有完成任何轮次，下次再试试吧！';
        } else {
            text = `📊 本次训练共 ${TOTAL_ROUNDS} 轮，答对 ${correctCount} 轮，答错 ${wrongCount} 轮，跳过 ${skipCount} 轮，正确率 ${accuracy}%。总用时 ${totalTime} 秒，平均每轮 ${avgTime} 秒，最长轮次 ${maxTime} 秒，最短轮次 ${minTime} 秒。\n\n`;

            if (accuracy >= 80) {
                text += `🌟 宝贝表现非常棒！准确率达到 ${accuracy}%，说明宝贝对日常场景中的情绪理解能力很强！建议在日常生活中继续通过绘本故事讨论角色心情，进一步提升情绪认知能力。`;
            } else if (accuracy >= 50) {
                text += `🌱 宝贝正在进步中！在 ${TOTAL_ROUNDS} 轮中正确识别了 ${correctCount} 个情绪。可以和宝贝一起玩「表情猜猜看」的游戏来帮助加深对不同场景情绪的理解。`;
            } else if (skipCount >= 3) {
                text += `💪 宝贝今天可能状态不太好，跳过了 ${skipCount} 轮。建议休息一下，下次再玩。可以从最简单的开心、伤心、生气三种情绪开始练习。`;
            } else {
                text += `💪 这是一个好的开始！在 ${TOTAL_ROUNDS} 轮中正确识别了 ${correctCount} 个。建议从基础的开心、伤心、生气三种情绪开始，通过日常生活场景反复练习。`;
            }

            if (maxTime - minTime > 5) {
                text += `\n\n⏱️ 注意：各轮次用时差异较大（${minTime}-${maxTime}秒），可能存在注意力波动，建议适当缩短单次训练时长。`;
            } else if (avgTime < 3) {
                text += `\n\n⚡ 宝贝反应很快！平均每轮仅需 ${avgTime} 秒，说明对基本情绪的识别已经很熟练了。`;
            }
        }
        analysisText.textContent = text;
    }

    // ========== 事件绑定 ==========
    // 语音按钮
    voiceBtn.addEventListener('click', () => {
        if (currentRound < TOTAL_ROUNDS && !gameEnded) {
            window.speechSynthesis.cancel();
            speak(SCENES[currentRound].voice);
        }
    });

    // 跳过
    skipBtn.addEventListener('click', skipRound);

    // 结束
    endBtn.addEventListener('click', () => {
        if (!gameEnded) endGame();
    });

    // 返回首页
    function goHome() {
        location.href = 'mainPart.html';
    }
    homeBtn.addEventListener('click', goHome);
    homeReturnBtn.addEventListener('click', goHome);

    // ========== 初始化 ==========
    currentRound = 0;
    startRound();
    console.log('✅ 情绪识别游戏（场景版）已启动');
})();
