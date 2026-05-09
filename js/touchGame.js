(function () {
    // ========== API 配置 ==========
    const API_BASE = 'http://localhost:5000/api';

    // ========== 获取孩子ID ==========
    let childId = localStorage.getItem('starCompanionActiveChild');
    const urlParams = new URLSearchParams(window.location.search);
    const urlChildId = urlParams.get('childId');
    if (!childId && urlChildId) childId = urlChildId;
    if (!childId) {
        console.error('无法获取孩子ID，训练记录将无法保存');
    } else {
        childId = parseInt(childId);
    }

    const TOTAL_ROUNDS = 8;
    const MAX_TIME = 4;
    const MAX_ERRORS_PER_ROUND = 1;
    const ITEMS = [{ name: '苹果', emoji: '🍎' }, { name: '香蕉', emoji: '🍌' }, { name: '橘子', emoji: '🍊' }, { name: '西瓜', emoji: '🍉' }];

    // DOM 元素
    const currentRoundSpan = document.getElementById('currentRoundDisplay');
    const totalRoundsSpan = document.getElementById('totalRoundsDisplay');
    const targetNameSpan = document.getElementById('targetName');
    const targetEmojiSpan = document.getElementById('targetEmoji');
    const hintTargetSpan = document.getElementById('hintTarget');
    const successSpan = document.getElementById('successValue');
    const errorSpan = document.getElementById('errorValue');
    const timerSpan = document.getElementById('timerValue');
    const progressFill = document.getElementById('progressBarFill');
    const progressPercent = document.getElementById('progressPercentText');
    const inlineFeedback = document.getElementById('inlineFeedback');
    const reminderPopup = document.getElementById('reminderPopup');
    const reminderText = document.getElementById('reminderText');
    const itemsGrid = document.getElementById('itemsGridContainer');
    const skipBtn = document.getElementById('skipRoundButton');
    const endBtn = document.getElementById('endGameButton');
    const homeBtn = document.getElementById('homeButton');
    const resultModal = document.getElementById('resultModal');
    const roundErrorSpan = document.getElementById('roundErrorCount');

    // 报告DOM
    const finalTotalClicks = document.getElementById('finalTotalClicks');
    const finalCorrectClicks = document.getElementById('finalCorrectClicks');
    const finalWrongClicks = document.getElementById('finalWrongClicks');
    const finalCorrectRounds = document.getElementById('finalCorrectRounds');
    const finalWrongRounds = document.getElementById('finalWrongRounds');
    const finalClickRate = document.getElementById('finalClickRate');
    const finalRoundAccuracy = document.getElementById('finalRoundAccuracy');
    const finalAvgTime = document.getElementById('finalAvgTime');
    const finalTimeout = document.getElementById('finalTimeout');
    const finalSkip = document.getElementById('finalSkip');
    const analysisTextSpan = document.getElementById('analysisText');
    const homeReturnBtn = document.getElementById('homeReturnBtn');

    totalRoundsSpan.textContent = TOTAL_ROUNDS;

    // 游戏状态
    let currentRound = 1;
    let currentTarget = '苹果';
    let roundActive = true;
    let gameActive = true;
    let roundErrorCount = 0;
    let roundStartTime = 0;
    let totalTimeSpent = 0;
    let roundTimes = [];
    let fingerGuideTimeout = null;
    
    

    // 统计数据
    let stats = {
        totalClicks: 0,
        correctClicks: 0,
        wrongClicks: 0,
        correctRounds: 0,
        wrongRounds: 0,
        timeoutCount: 0,
        skipCount: 0
    };

    let timerInterval = null;
    let reminderTimeouts = [];
    let autoNextTimeout = null;
    let popupTimeout = null;

    // 渲染物品网格
    function renderItemsGrid() {
        itemsGrid.innerHTML = '';
        ITEMS.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.dataset.item = item.name;
            card.dataset.emoji = item.emoji;
            card.innerHTML = `
                <div class="item-emoji">${item.emoji}</div>
                <div class="item-name">${item.name}</div>
            `;
            itemsGrid.appendChild(card);
        });
    }

    function showFingerGuide(targetItemName) {
        document.querySelectorAll('.finger-guide').forEach(el => el.remove());
        if (fingerGuideTimeout) clearTimeout(fingerGuideTimeout);
        const targetCard = Array.from(document.querySelectorAll('.item-card')).find(card => card.dataset.item === targetItemName);
        if (targetCard) {
            const finger = document.createElement('div');
            finger.className = 'finger-guide';
            finger.innerHTML = '👆';
            targetCard.style.position = 'relative';
            targetCard.appendChild(finger);
            fingerGuideTimeout = setTimeout(() => finger.remove(), 3000);
        }
    }

    function speak(text, isCorrect = null) {
        if (!window.speechSynthesis) return;
        try {
            let speakText = text;
            if (isCorrect === true) {
                const arr = ['真棒！', '好厉害！', '太聪明了！'];
                speakText = arr[Math.floor(Math.random() * arr.length)] + text;
            } else if (isCorrect === false) {
                const arr = ['再试试看，', '没关系，', '加油，'];
                speakText = arr[Math.floor(Math.random() * arr.length)] + text;
            }
            const utterance = new SpeechSynthesisUtterance(speakText);
            utterance.lang = 'zh-CN';
            utterance.rate = 0.95;
            utterance.pitch = 1.2;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        } catch (e) { }
    }

    function updateRoundUI() {
        currentRoundSpan.textContent = currentRound;
        const completedRounds = currentRound - 1;
        const pct = (completedRounds / TOTAL_ROUNDS) * 100;
        progressFill.style.width = `${pct}%`;
        progressPercent.textContent = `${Math.round(pct)}%`;
    }

    function updateErrorTotalDisplay() {
        const totalErrors = stats.wrongClicks + stats.timeoutCount + stats.skipCount;
        errorSpan.textContent = totalErrors;
        successSpan.textContent = stats.correctRounds;
    }

    function updateRoundErrorUI() {
        roundErrorSpan.textContent = roundErrorCount;
        updateErrorTotalDisplay();
    }

    function setTarget(itemName) {
        const item = ITEMS.find(i => i.name === itemName) || ITEMS[0];
        currentTarget = item.name;
        targetNameSpan.textContent = item.name;
        targetEmojiSpan.textContent = item.emoji;
        hintTargetSpan.textContent = item.name;
        inlineFeedback.innerHTML = `🔍 第 ${currentRound} 轮：指一指"${currentTarget}"，点击卡片吧`;
        inlineFeedback.style.color = '#7F9A6B';
        speak(`指一指${item.name}`);
    }

    function clearTimers() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        reminderTimeouts.forEach(t => clearTimeout(t));
        reminderTimeouts = [];
        if (autoNextTimeout) clearTimeout(autoNextTimeout);
        if (popupTimeout) clearTimeout(popupTimeout);
        if (fingerGuideTimeout) clearTimeout(fingerGuideTimeout);
        reminderPopup.classList.remove('show');
        document.querySelectorAll('.finger-guide').forEach(el => el.remove());
    }

    function finalizeRound(isSuccess) {
        if (isSuccess) stats.correctRounds++;
        else stats.wrongRounds++;
        updateErrorTotalDisplay();
        const completedRounds = currentRound;
        const pct = (completedRounds / TOTAL_ROUNDS) * 100;
        progressFill.style.width = `${pct}%`;
        progressPercent.textContent = `${Math.round(pct)}%`;
    }

    function goToNextRound() {
        if (!gameActive) return;
        document.querySelectorAll('.item-card').forEach(c => c.classList.remove('correct-glow', 'wrong-shake'));
        document.querySelectorAll('.finger-guide').forEach(el => el.remove());
        if (currentRound >= TOTAL_ROUNDS) {
            finishGame();
            return;
        }
        currentRound++;
        let newTarget;
        do {
            newTarget = ITEMS[Math.floor(Math.random() * ITEMS.length)].name;
        } while (newTarget === currentTarget && ITEMS.length > 1);
        setTarget(newTarget);
        roundActive = true;
        roundErrorCount = 0;
        updateRoundErrorUI();
        updateRoundUI();
        timerSpan.textContent = '0';
        startRound();
    }

    function startRound() {
        clearTimers();
        roundErrorCount = 0;
        updateRoundErrorUI();
        roundStartTime = Date.now();
        timerSpan.textContent = '0';

        timerInterval = setInterval(() => {
            if (!roundActive || !gameActive) return;
            const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
            timerSpan.textContent = elapsed;
            if (elapsed >= MAX_TIME && roundActive) {
                roundActive = false;
                clearTimers();
                stats.timeoutCount++;
                const elapsedSec = Math.floor((Date.now() - roundStartTime) / 1000);
                roundTimes.push(elapsedSec);
                totalTimeSpent += elapsedSec;
                finalizeRound(false);
                inlineFeedback.innerHTML = `⏳ ${MAX_TIME}秒已到，自动进入下一题`;
                inlineFeedback.style.color = '#B27A4A';
                speak('时间到，我们看下一个', false);
                setTimeout(() => { if (gameActive) goToNextRound(); }, 800);
            }
        }, 200);

      

        autoNextTimeout = setTimeout(() => {
            if (roundActive && gameActive) {
                roundActive = false;
                clearTimers();
                stats.timeoutCount++;
                const elapsedSec = Math.floor((Date.now() - roundStartTime) / 1000);
                roundTimes.push(elapsedSec);
                totalTimeSpent += elapsedSec;
                finalizeRound(false);
                inlineFeedback.innerHTML = `⏳ 时间到，进入下一题`;
                inlineFeedback.style.color = '#B27A4A';
                speak('时间到', false);
                setTimeout(() => { if (gameActive) goToNextRound(); }, 800);
            }
        }, MAX_TIME * 1000 + 100);
    }



    function highlightCorrect() {
        document.querySelectorAll('.item-card').forEach(card => {
            if (card.dataset.item === currentTarget) {
                card.classList.add('correct-glow');
                setTimeout(() => card.classList.remove('correct-glow'), 1200);
            }
        });
    }

    function handleCorrect() {
        if (!roundActive || !gameActive) return;
        roundActive = false;
        clearTimers();
        const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
        roundTimes.push(elapsed);
        totalTimeSpent += elapsed;
        stats.correctClicks++;
        stats.totalClicks++;
        finalizeRound(true);
        highlightCorrect();
        inlineFeedback.innerHTML = `🎉 太棒了！正确指出了"${currentTarget}"！`;
        inlineFeedback.style.color = '#7F9A6B';
        speak(currentTarget, true);
        setTimeout(() => {
            if (gameActive) {
                if (currentRound < TOTAL_ROUNDS) goToNextRound();
                else finishGame();
            }
        }, 1200);
    }

    function handleWrong(cardElement) {
        if (!roundActive || !gameActive) return;
        stats.totalClicks++;
        stats.wrongClicks++;
        roundErrorCount++;
        updateRoundErrorUI();
        cardElement.classList.add('wrong-shake');
        setTimeout(() => cardElement.classList.remove('wrong-shake'), 300);
        inlineFeedback.innerHTML = `🌱 再试试看，"${currentTarget}"在哪里？ (${roundErrorCount}/${MAX_ERRORS_PER_ROUND})`;
        inlineFeedback.style.color = '#B27A4A';
        speak('再找找看', false);

        if (roundErrorCount === 1) {
            showFingerGuide(currentTarget);
        }

        if (roundErrorCount >= MAX_ERRORS_PER_ROUND) {
            roundActive = false;
            clearTimers();
            const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
            roundTimes.push(elapsed);
            totalTimeSpent += elapsed;
            finalizeRound(false);
            inlineFeedback.innerHTML = `📝 已经尝试${MAX_ERRORS_PER_ROUND}次了，我们看下一题吧`;
            inlineFeedback.style.color = '#B27A4A';
            speak('没关系，我们看下一个', false);
            setTimeout(() => {
                if (gameActive) {
                    if (currentRound < TOTAL_ROUNDS) goToNextRound();
                    else finishGame();
                }
            }, 1000);
        }
    }

    function skipRound() {
        if (!roundActive || !gameActive) return;
        roundActive = false;
        clearTimers();
        stats.skipCount++;
        const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
        roundTimes.push(elapsed);
        totalTimeSpent += elapsed;
        finalizeRound(false);
        updateRoundErrorUI();
        inlineFeedback.innerHTML = `⏩ 已跳过本轮`;
        inlineFeedback.style.color = '#B27A4A';
        speak('跳过本轮', false);
        setTimeout(() => {
            if (gameActive) {
                if (currentRound < TOTAL_ROUNDS) goToNextRound();
                else finishGame();
            }
        }, 500);
    }

    function generateAnalysis() {
        const totalRoundsCompleted = stats.correctRounds + stats.wrongRounds;
        const roundAcc = totalRoundsCompleted > 0 ? (stats.correctRounds / totalRoundsCompleted) * 100 : 0;
        const clickRateVal = stats.totalClicks > 0 ? (stats.correctClicks / stats.totalClicks) * 100 : 0;
        let suggestion = "";
        if (roundAcc >= 85) suggestion = "太出色了！孩子对物品指认掌握非常扎实，继续保持正向激励✨";
        else if (roundAcc >= 60) suggestion = "表现良好！偶尔需要提示，建议多给予语音鼓励和手指辅助示范💪";
        else suggestion = "正在逐步熟悉中，建议多重复几轮游戏，家长可一起指认提升兴趣🍀";
        if (stats.timeoutCount > 2) suggestion += " 出现较多超时，可适当缩短每轮预期或提前提醒。";
        if (stats.skipCount > 1) suggestion += " 跳过次数较多，下次可以降低难度或增加趣味性。";
        return `✅ 轮次正确率 ${Math.round(roundAcc)}% ，点击准确率 ${Math.round(clickRateVal)}% 。${suggestion}`;
    }

    function updateReportModal() {
        const totalRoundsCompleted = stats.correctRounds + stats.wrongRounds;
        const roundAccuracy = totalRoundsCompleted > 0 ? Math.round((stats.correctRounds / totalRoundsCompleted) * 100) : 0;
        const clickRate = stats.totalClicks > 0 ? Math.round((stats.correctClicks / stats.totalClicks) * 100) : 0;
        const avgRoundTime = roundTimes.length > 0 ? (roundTimes.reduce((a, b) => a + b, 0) / roundTimes.length).toFixed(1) : '0';
        finalTotalClicks.textContent = stats.totalClicks;
        finalCorrectClicks.textContent = stats.correctClicks;
        finalWrongClicks.textContent = stats.wrongClicks;
        finalCorrectRounds.textContent = stats.correctRounds;
        finalWrongRounds.textContent = stats.wrongRounds;
        finalClickRate.textContent = clickRate;
        finalRoundAccuracy.textContent = roundAccuracy;
        finalAvgTime.textContent = avgRoundTime;
        finalTimeout.textContent = stats.timeoutCount;
        finalSkip.textContent = stats.skipCount;
        analysisTextSpan.textContent = generateAnalysis();
    }
// ========== 新增：调用AI单次分析 ==========
async function getAISingleAnalysis(recordId) {
    if (!childId || !recordId) {
        console.error('缺少参数，无法获取AI分析');
        return null;
    }
    
    try {
        const response = await fetch(`${API_BASE}/point-game-ai/single-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                child_id: childId,
                record_id: recordId
            })
        });
        const result = await response.json();
        if (result.success && result.data) {
            return result.data.ai_analysis;
        } else {
            console.error('AI分析失败:', result);
            return null;
        }
    } catch (error) {
        console.error('AI分析网络错误:', error);
        return null;
    }
}

// ========== 修改：保存训练记录后获取AI分析 ==========
async function saveGameRecord() {
    if (!childId) {
        console.error('❌ 没有孩子ID，无法保存记录');
        return null;
    }

    // 计算所有统计数据
    const totalRoundsCompleted = stats.correctRounds + stats.wrongRounds;
    const accuracy = totalRoundsCompleted > 0 
        ? Math.round((stats.correctRounds / totalRoundsCompleted) * 100 * 100) / 100
        : 0;
    const clickAccuracy = stats.totalClicks > 0 
        ? Math.round((stats.correctClicks / stats.totalClicks) * 100 * 100) / 100
        : 0;
    const totalTime = roundTimes.reduce((a, b) => a + b, 0);
    const avgTime = roundTimes.length > 0 
        ? Math.round((totalTime / roundTimes.length) * 100) / 100 
        : 0;
    const avgReactionTime = roundTimes.length > 0 
        ? Math.round((totalTime / roundTimes.length) * 100) / 100 
        : 0;

    // 构建完整的请求体
    const record = {
        child_id: childId,
        session_date: new Date().toISOString().split('T')[0],
        round_total: TOTAL_ROUNDS,
        correct_rounds: stats.correctRounds,
        wrong_rounds: stats.wrongRounds,
        total_clicks: stats.totalClicks,
        correct_clicks: stats.correctClicks,
        wrong_clicks: stats.wrongClicks,
        timeout_count: stats.timeoutCount,
        skip_count: stats.skipCount,
        avg_reaction_time: avgReactionTime,
        round_details: roundTimes.map((t, idx) => ({
            round: idx + 1,
            time_sec: t,
            success: idx < stats.correctRounds  // 简化处理
        }))
    };

    console.log('📤 完整训练数据:', {
        ...record,
        accuracy: accuracy + '%',
        clickAccuracy: clickAccuracy + '%',
        totalTime: totalTime + 's',
        avgTime: avgTime + 's'
    });

    try {
        const response = await fetch(`${API_BASE}/games/point-game`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });
        const result = await response.json();
        console.log('📥 服务器响应:', result);
        
        if (response.ok) {
            console.log('✅ 指物练习记录保存成功，ID:', result.id);
            return result.id;
        } else {
            console.error('❌ 保存失败:', result);
            alert(`保存失败：${result.message || '服务器错误'}`);
            return null;
        }
    } catch (error) {
        console.error('❌ 网络错误:', error);
        alert('网络错误，无法连接服务器');
        return null;
    }
}

// ========== 修改：完成训练 ==========
async function finishGame() {
    if (!gameActive) return;
    gameActive = false;
    roundActive = false;
    clearTimers();
    progressFill.style.width = '100%';
    progressPercent.textContent = '100%';
    updateReportModal();

    // 保存数据到后端
    const recordId = await saveGameRecord();
    
    if (recordId) {
        // 调用AI分析
        analysisTextSpan.textContent = '🤖 AI正在分析本次训练...';
        
        const aiAnalysis = await getAISingleAnalysis(recordId);
        
        if (aiAnalysis) {
            analysisTextSpan.textContent = aiAnalysis;
        } else {
            analysisTextSpan.textContent = generateAnalysis();  // 降级使用本地分析
        }
    } else {
        analysisTextSpan.textContent = '⚠️ 数据保存失败，请检查网络';
    }

    resultModal.classList.add('show');
    inlineFeedback.innerHTML = `🎯 练习结束！ 轮次正确率 ${finalRoundAccuracy.textContent}%`;
    speak('练习完成，你真棒！', true);
}

    function goToMainPart() {
        window.location.href = 'mainPart.html';
    }

    function resetGame() {
        gameActive = true;
        currentRound = 1;
        currentTarget = '苹果';
        roundActive = true;
        roundErrorCount = 0;
        totalTimeSpent = 0;
        roundTimes = [];
        stats = {
            totalClicks: 0,
            correctClicks: 0,
            wrongClicks: 0,
            correctRounds: 0,
            wrongRounds: 0,
            timeoutCount: 0,
            skipCount: 0
        };
        successSpan.textContent = '0';
        errorSpan.textContent = '0';
        renderItemsGrid();
        setTarget('苹果');
        updateRoundUI();
        updateRoundErrorUI();
        timerSpan.textContent = '0';
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        clearTimers();
        startRound();
        resultModal.classList.remove('show');
    }

    itemsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.item-card');
        if (!card || !gameActive || !roundActive) return;
        if (card.dataset.item === currentTarget) handleCorrect();
        else handleWrong(card);
    });
    skipBtn.addEventListener('click', () => { if (gameActive && roundActive) skipRound(); });
    endBtn.addEventListener('click', () => { if (gameActive && confirm('确定结束练习吗？')) finishGame(); });
    homeBtn.addEventListener('click', () => { goToMainPart(); });
    homeReturnBtn.addEventListener('click', () => { goToMainPart(); });

    renderItemsGrid();
    resetGame();
})();