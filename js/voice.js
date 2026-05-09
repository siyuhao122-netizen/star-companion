(function () {
    const API_BASE = 'http://localhost:5000/api';

    // ========== 阈值配置 ==========
    const VOICE_THRESHOLD_DB = 45;          // 声音阈值（分贝）
    const ROUND_TIMEOUT_MS = 8000;          // 超时时间（4秒）
    const TOTAL_ROUNDS = 8;

    // ========== 获取孩子ID ==========
    let childId = localStorage.getItem('starCompanionActiveChild');
    const urlParams = new URLSearchParams(window.location.search);
    const urlChildId = urlParams.get('childId');
    if (!childId && urlChildId) childId = urlChildId;
    if (childId) childId = parseInt(childId);

    // ========== 检查浏览器是否支持语音识别 ==========
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasSpeechRecognition = !!SpeechRecognition;
    
    if (!hasSpeechRecognition) {
        console.warn('⚠️ 浏览器不支持语音识别，将使用音量检测');
    }

    // ========== TTS 语音播报 ==========
    const VoiceSpeaker = {
        synth: window.speechSynthesis,
        speaking: false,
        getChineseVoice() {
            const voices = this.synth.getVoices();
            return voices.find(v => v.lang.includes('zh-CN')) || voices.find(v => v.lang.includes('zh')) || voices[0];
        },
        speak(text, onEnd = null) {
            this.stop();
            const u = new SpeechSynthesisUtterance(text);
            u.voice = this.getChineseVoice();
            u.lang = 'zh-CN';
            u.rate = 0.9;
            u.pitch = 1.2;
            this.speaking = true;
            document.getElementById('speakBtn')?.classList.add('speaking');
            u.onend = u.onerror = () => {
                this.speaking = false;
                document.getElementById('speakBtn')?.classList.remove('speaking');
                if (onEnd) onEnd();
            };
            this.synth.speak(u);
        },
        stop() {
            if (this.synth.speaking) this.synth.cancel();
            this.speaking = false;
            document.getElementById('speakBtn')?.classList.remove('speaking');
        }
    };

    // ========== 发声库（含关键词列表） ==========
    const library = [
        { text: "a", display: "a — 啊", hint: "张开小嘴巴～", full: "小猫咪想听你学 a ～ 张开小嘴巴", keywords: ["a", "啊", "阿", "呀", "哎"] },
        { text: "o", display: "o — 喔", hint: "圆圆的嘴巴～", full: "小猫咪想听你学 o ～ 圆圆的嘴巴", keywords: ["o", "喔", "哦", "噢", "哟"] },
        { text: "e", display: "e — 鹅", hint: "嘴巴扁扁～", full: "小猫咪想听你学 e ～ 嘴巴扁扁", keywords: ["e", "鹅", "呃", "饿", "额", "诶"] },
        { text: "ma", display: "ma — 妈", hint: "轻轻说妈～", full: "小猫咪想听你学 ma ～ 轻轻说妈", keywords: ["ma", "妈", "嘛", "马", "麻", "妈妈"] },
        { text: "ba", display: "ba — 爸", hint: "试试 ba～", full: "小猫咪想听你学 ba ～ 试试 ba", keywords: ["ba", "爸", "吧", "八", "巴", "爸爸"] },
        { text: "wu", display: "wu — 呜", hint: "小火车呜～", full: "小猫咪想听你学 wu ～ 小火车呜呜", keywords: ["wu", "呜", "乌", "屋", "吴", "呜呜"] },
        { text: "yi", display: "yi — 衣", hint: "衣服的衣～", full: "小猫咪想听你学 yi ～ 衣服的衣", keywords: ["yi", "衣", "一", "依", "伊", "医"] },
        { text: "yu", display: "yu — 鱼", hint: "小鱼游游～", full: "小猫咪想听你学 yu ～ 小鱼游游", keywords: ["yu", "鱼", "雨", "玉", "遇", "语"] }
    ];

    // ========== 全局状态 ==========
    let idx = 0;
    let successCount = 0;       // 有效轮次（说出关键词）
    let voiceRoundCount = 0;    // 有声音的轮次
    let hasSucceeded = false;
    let hasVoiceThisRound = false;
    let roundStartTime = 0;
    let roundMaxDB = 0;
    let roundTimers = [];
    let active = true;
    let voiceDBs = [];
    let reactionTimes = [];
    let roundDetails = [];

    // 音频相关
    let stream = null;
    let audioCtx = null;
    let analyser = null;
    let loop = null;
    let confirmCallback = null;

    // 语音识别相关
    let recognition = null;
    let isRecognitionRunning = false;

    // DOM
    const target = document.getElementById('targetSound');
    const hint = document.getElementById('hintText');
    const volume = document.getElementById('volumeFill');
    const successSpan = document.getElementById('successCount');
    const curRound = document.getElementById('currentRound');
    const progress = document.getElementById('progressFill');
    const nextBtn = document.getElementById('nextBtn');
    const micIcon = document.getElementById('micIcon');
    const successIndicator = document.getElementById('successIndicator');
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMsg = document.getElementById('confirmMessage');
    const resultModal = document.getElementById('resultModal');

    document.getElementById('totalRounds').innerText = TOTAL_ROUNDS;

    // ========== 提示 ==========
    function showToast(msg, bg = '#FEF3E2') {
        let t = document.querySelector('.feedback-toast');
        if (t) t.remove();
        t = document.createElement('div');
        t.className = 'feedback-toast';
        t.innerHTML = `<i class="fas fa-microphone"></i> ${msg}`;
        t.style.background = bg;
        document.querySelector('.mic-game').appendChild(t);
        setTimeout(() => t.remove(), 1500);
    }

    // ========== 语音识别 ==========
    function initSpeechRecognition() {
        if (!hasSpeechRecognition) {
            console.warn('浏览器不支持语音识别');
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;       // 持续识别
        recognition.interimResults = true;   // 返回临时结果
        recognition.maxAlternatives = 3;     // 返回多个备选

        recognition.onresult = (event) => {
            if (!active || hasSucceeded) return;

            const currentKeywords = library[idx].keywords;
            
            // 遍历所有识别结果
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                
                if (result.isFinal) {
                    // 最终结果：检查是否包含关键词
                    for (let j = 0; j < result.length; j++) {
                        const transcript = result[j].transcript.toLowerCase().trim();
                        const confidence = result[j].confidence;
                        
                        console.log(`🎤 识别到: "${transcript}" (置信度: ${(confidence * 100).toFixed(0)}%)`);
                        
                        // 检查是否匹配关键词
                        const matched = currentKeywords.some(keyword => 
                            transcript.includes(keyword.toLowerCase())
                        );
                        
                        if (matched && confidence > 0.3) {  // 置信度 > 30%
                            console.log(`✅ 关键词匹配成功！目标: ${library[idx].text}, 识别: ${transcript}`);
                            const db = getCurrentDB();
                            handleSuccess(db, transcript);
                            return;
                        }
                    }
                    
                    // 有声音但没匹配关键词
                    if (transcript.length > 0 && !hasVoiceThisRound) {
                        hasVoiceThisRound = true;
                        voiceRoundCount++;
                        console.log(`🔊 检测到声音但未匹配: "${transcript}"，目标关键词: ${currentKeywords.join(', ')}`);
                    }
                }
            }
        };

        recognition.onerror = (event) => {
            console.warn('语音识别错误:', event.error);
            if (event.error === 'no-speech' || event.error === 'aborted') {
                // 正常情况，忽略
            } else if (event.error === 'not-allowed') {
                showToast('请允许麦克风权限', '#FCE8E8');
            }
        };

        recognition.onend = () => {
            isRecognitionRunning = false;
            // 如果本轮还没结束，自动重启
            if (active && !hasSucceeded) {
                try {
                    recognition.start();
                    isRecognitionRunning = true;
                } catch (e) {
                    // 已经在运行中，忽略
                }
            }
        };
    }

    function startRecognition() {
        if (!recognition || isRecognitionRunning) return;
        try {
            recognition.start();
            isRecognitionRunning = true;
            console.log('🎤 语音识别已启动');
        } catch (e) {
            console.warn('启动语音识别失败:', e);
        }
    }

    function stopRecognition() {
        if (recognition && isRecognitionRunning) {
            try {
                recognition.stop();
                isRecognitionRunning = false;
            } catch (e) {}
        }
    }

    // ========== 音频控制（用于检测音量和有声音） ==========
    function stopAudioMonitoring() {
        if (loop) { cancelAnimationFrame(loop); loop = null; }
    }

    async function startAudioMonitoring() {
        if (!audioCtx) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);
                if (audioCtx.state === 'suspended') await audioCtx.resume();
            } catch {
                showToast('需要麦克风权限', '#FCE8E8');
                return;
            }
        }
        startMeter();
    }

    function getCurrentDB() {
        if (!analyser) return 0;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        if (rms < 0.0001) return 0;
        return Math.round(20 * Math.log10(rms) + 94);
    }

    function startMeter() {
        if (loop) cancelAnimationFrame(loop);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        function update() {
            if (!analyser || !active) { loop = requestAnimationFrame(update); return; }
            analyser.getByteTimeDomainData(dataArray);
            let max = 0;
            for (let i = 0; i < dataArray.length; i++) max = Math.max(max, Math.abs((dataArray[i] - 128) / 128));
            
            const db = getCurrentDB();
            volume.style.width = Math.min(100, max * 250) + '%';

            // 记录本轮最大音量
            if (db > roundMaxDB) roundMaxDB = db;

            // 检测到声音（超过阈值）
            if (db > VOICE_THRESHOLD_DB && !hasVoiceThisRound && !hasSucceeded && active) {
                hasVoiceThisRound = true;
                voiceRoundCount++;
                voiceDBs.push(db);
            }

            loop = requestAnimationFrame(update);
        }
        loop = requestAnimationFrame(update);
    }

// ========== 录音相关 ==========
let mediaRecorder = null;
let audioChunks = [];

async function startRecording() {
    if (!stream) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            if (audioCtx.state === 'suspended') await audioCtx.resume();
        } catch {
            showToast('需要麦克风权限', '#FCE8E8');
            return null;
        }
    }

    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.start();
    console.log('🔴 开始录音');
}

function stopRecording() {
    return new Promise((resolve) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            resolve(null);
            return;
        }
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log('⏹️ 录音结束，大小:', audioBlob.size);
            resolve(audioBlob);
        };
        mediaRecorder.stop();
    });
}

// ========== 发送音频到后端识别 ==========
async function recognizeSpeech(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('keywords', JSON.stringify(library[idx].keywords));
        formData.append('target', library[idx].text);

        const response = await fetch(`${API_BASE}/voice/speech-recognize`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        
        if (result.success) {
            console.log('🎤 识别结果:', result.text);
            return {
                matched: result.matched,
                text: result.text,
                confidence: result.confidence
            };
        }
        return { matched: false, text: '', confidence: 0 };
    } catch (e) {
        console.error('语音识别失败:', e);
        return { matched: false, text: '', confidence: 0 };
    }
}

// ========== 检测逻辑（音量触发 + 阿里云识别） ==========
const VOICE_DURATION_MS = 500;  // 持续500ms触发录音
let voiceStartTime = 0;
let voiceSustained = false;
let isProcessing = false;

function startMeter() {
    if (loop) cancelAnimationFrame(loop);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function update() {
        if (!analyser || !active) { loop = requestAnimationFrame(update); return; }
        analyser.getByteTimeDomainData(dataArray);
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) max = Math.max(max, Math.abs((dataArray[i] - 128) / 128));

        const db = getCurrentDB();
        volume.style.width = Math.min(100, max * 250) + '%';

        if (db > roundMaxDB) roundMaxDB = db;

        // 音量触发录音识别
        if (db > VOICE_THRESHOLD_DB) {
            if (!hasVoiceThisRound) {
                hasVoiceThisRound = true;
                voiceRoundCount++;
                voiceDBs.push(db);
            }

            if (voiceStartTime === 0) {
                voiceStartTime = Date.now();
            } else if (!voiceSustained && !hasSucceeded && !isProcessing) {
                const duration = Date.now() - voiceStartTime;
                if (duration >= VOICE_DURATION_MS) {
                    voiceSustained = true;
                    // 触发录音+阿里云识别
                    processVoiceResponse();
                }
            }
        } else {
            voiceStartTime = 0;
        }

        loop = requestAnimationFrame(update);
    }
    loop = requestAnimationFrame(update);
}

async function processVoiceResponse() {
    if (isProcessing || hasSucceeded || !active) return;

    isProcessing = true;
    micIcon.classList.add('recording');
    showToast('🎤 正在听你说话...', '#E8F5E9');

    // 录制 2 秒音频
    await startRecording();
    await new Promise(resolve => setTimeout(resolve, 2000));
    const audioBlob = await stopRecording();
    micIcon.classList.remove('recording');

    if (!audioBlob || audioBlob.size < 1000) {
        showToast('没有检测到声音，再试一次～', '#FDF5EC');
        isProcessing = false;
        voiceStartTime = 0;
        voiceSustained = false;
        return;
    }

    showToast('🤖 正在识别中...', '#FEF3E2');

    // 发送到后端识别
    const result = await recognizeSpeech(audioBlob);

    console.log('识别结果:', result);

    if (result.matched) {
        const db = roundMaxDB || getCurrentDB();
        handleSuccess(db, result.text);
    } else {
        // 没匹配到关键词
        if (result.text) {
            showToast(`听到了"${result.text}"，再试试说"${library[idx].text}"～`, '#FDF5EC');
        } else {
            showToast('没听清楚，大声一点再说一次～', '#FDF5EC');
        }
        voiceStartTime = 0;
        voiceSustained = false;
        isProcessing = false;
    }
}

// ========== 成功判定处理 ==========
function handleSuccess(db, recognizedText = '') {
    if (hasSucceeded || !active) return;

    hasSucceeded = true;
    successCount++;

    const reactionTime = ((Date.now() - roundStartTime) / 1000).toFixed(2);
    reactionTimes.push(parseFloat(reactionTime));

    if (db > 0 && !voiceDBs.includes(db)) {
        voiceDBs.push(db);
    }

    // 记录本轮详情
    roundDetails[idx] = {
        round: idx + 1,
        success: true,
        reason: 'matched',
        hasVoice: true,
        maxDB: roundMaxDB,
        targetSound: library[idx].text,
        recognizedText: recognizedText,
        reactionTime: parseFloat(reactionTime)
    };

    // 停止识别和监听
    stopRecognition();
    stopAudioMonitoring();
    VoiceSpeaker.stop();
    clearRoundTimers();

    // 更新UI
    successSpan.innerText = successCount;
    successIndicator.innerHTML = `
        <div class="success-message" style="background:#E8F5E9;color:#4CAF50;border-color:#81C784;">
            <i class="fas fa-check-circle"></i>
            太棒了！说得很好 ${recognizedText ? `"${recognizedText}"` : ''}
        </div>
    `;

    // 播放成功音效（可选）
    playSuccessSound();

    // 1秒后自动进入下一轮
    setTimeout(() => {
        if (active) nextRound();
    }, 1000);
}

// ========== 成功音效（可选） ==========
function playSuccessSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('音效播放失败:', e);
    }
}

    // ========== 语音提示 ==========
    function speakHint() {
        if (!active) return;
        roundStartTime = Date.now();
        roundMaxDB = 0;
        hasVoiceThisRound = false;
        
        VoiceSpeaker.speak(library[idx].full, () => {
            if (active && !hasSucceeded) {
                startAudioMonitoring();
                startRecognition();
            }
        });
    }

    // ========== 轮次控制 ==========
    function updateDisplay() {
    if (!active) return;

    const item = library[idx];
    target.innerText = item.display;
    hint.innerHTML = `🐱 小猫咪想听你学 "${item.text}" ～ ${item.hint}`;
    hasSucceeded = false;
    hasVoiceThisRound = false;
    roundMaxDB = 0;
    voiceStartTime = 0;
    voiceSustained = false;
    isProcessing = false;
        successIndicator.innerHTML = '';
        volume.style.width = '0%';
        progress.style.width = `${(idx / TOTAL_ROUNDS) * 100}%`;
        curRound.innerText = idx + 1;
        nextBtn.disabled = false;
        stopRecognition();
        stopAudioMonitoring();
        speakHint();

        // 20秒超时
        clearRoundTimers();
        roundTimers.push(setTimeout(() => {
            if (!hasSucceeded && active) {
                roundDetails[idx] = {
                    round: idx + 1,
                    success: false,
                    reason: 'timeout',
                    hasVoice: hasVoiceThisRound,
                    maxDB: roundMaxDB,
                    targetSound: library[idx].text
                };
                stopRecognition();
                stopAudioMonitoring();
                VoiceSpeaker.stop();
                successIndicator.innerHTML = '<div class="success-message" style="background:#FCE8E8;color:#C06060;border-color:#D4A0A0;"><i class="fas fa-clock"></i> 时间到</div>';
                setTimeout(() => { if (active) nextRound(); }, 600);
            }
        }, ROUND_TIMEOUT_MS));
    }

    function clearRoundTimers() {
        roundTimers.forEach(t => clearTimeout(t));
        roundTimers = [];
    }

    function nextRound() {
        if (!active) return;
        clearRoundTimers();
        
        if (roundDetails[idx] === undefined) {
            roundDetails[idx] = {
                round: idx + 1,
                success: false,
                reason: 'incomplete',
                hasVoice: hasVoiceThisRound,
                maxDB: roundMaxDB,
                targetSound: library[idx].text
            };
        }

        stopRecognition();
        stopAudioMonitoring();
        VoiceSpeaker.stop();

        if (idx + 1 < TOTAL_ROUNDS) {
            idx++;
            updateDisplay();
        } else {
            finish();
        }
    }

    function skipRound() {
        if (!active) return;
        clearRoundTimers();
        
        roundDetails[idx] = {
            round: idx + 1,
            success: false,
            reason: 'skip',
            hasVoice: hasVoiceThisRound,
            maxDB: roundMaxDB,
            targetSound: library[idx].text
        };

        stopRecognition();
        stopAudioMonitoring();
        VoiceSpeaker.stop();

        if (idx + 1 < TOTAL_ROUNDS) {
            idx++;
            updateDisplay();
        } else {
            finish();
        }
    }

    // ========== 结束训练 ==========
    async function finish() {
        if (!active) return;
        active = false;
        clearRoundTimers();
        stopRecognition();
        stopAudioMonitoring();
        VoiceSpeaker.stop();

        progress.style.width = '100%';
        const completedRounds = roundDetails.length;

        showResultModal(null, true);

        if (!childId) {
            updateResultModalAI(null);
            return;
        }

        const recordData = {
            child_id: childId,
            session_date: new Date().toISOString().split('T')[0],
            round_total: TOTAL_ROUNDS,
            completed_rounds: completedRounds,
            success_count: successCount,
            voice_round_count: voiceRoundCount,
            round_details: roundDetails,
            voice_dbs: voiceDBs,
            reaction_times: reactionTimes
        };

        try {
            const saveRes = await fetch(`${API_BASE}/games/voice-game`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recordData)
            });
            const saveData = await saveRes.json();
            if (!saveRes.ok) throw new Error(saveData.message || '保存失败');
            
            const recordId = saveData.id;
            const aiRes = await fetch(`${API_BASE}/voice-game-ai/single-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ child_id: childId, record_id: recordId })
            });
            const aiData = await aiRes.json();
            updateResultModalAI(aiData.success ? aiData.data.ai_analysis : null);
        } catch (err) {
            console.error('保存或AI分析失败:', err);
            updateResultModalAI(null);
        }
    }

    // ========== 结果弹窗 ==========
    function showResultModal(aiAnalysis, isLoading = false) {
        const successRate = Math.round((successCount / TOTAL_ROUNDS) * 100);
        const validTimes = reactionTimes.filter(t => t > 0);
        const avgTime = validTimes.length > 0 ? (validTimes.reduce((a, b) => a + b, 0) / validTimes.length).toFixed(1) : '—';
        const minTime = validTimes.length > 0 ? Math.min(...validTimes).toFixed(1) : '—';
        const maxTime = validTimes.length > 0 ? Math.max(...validTimes).toFixed(1) : '—';
        const avgDB = voiceDBs.length > 0 ? Math.round(voiceDBs.reduce((a, b) => a + b, 0) / voiceDBs.length) : '—';
        let stdDev = '—';
        if (validTimes.length > 1) {
            const mean = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
            const variance = validTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / validTimes.length;
            stdDev = Math.sqrt(variance).toFixed(2);
        }

        document.getElementById('finalTotalRounds').innerText = TOTAL_ROUNDS;
        document.getElementById('finalSuccessCount').innerText = successCount;
        document.getElementById('finalSuccessRate').innerText = successRate + '%';
        document.getElementById('finalAvgTime').innerHTML = avgTime !== '—' ? avgTime + '<span class="stat-unit">秒</span>' : '—';
        document.getElementById('finalMinTime').innerHTML = minTime !== '—' ? minTime + '<span class="stat-unit">秒</span>' : '—';
        document.getElementById('finalMaxTime').innerHTML = maxTime !== '—' ? maxTime + '<span class="stat-unit">秒</span>' : '—';
        document.getElementById('finalStdDev').innerHTML = stdDev !== '—' ? stdDev + '<span class="stat-unit">秒</span>' : '—';
        document.getElementById('finalAvgDB').innerHTML = avgDB !== '—' ? avgDB + '<span class="stat-unit">dB</span>' : '—';
        document.getElementById('finalKeywordCount').innerText = successCount;
        document.getElementById('finalVoiceRoundCount').innerText = voiceRoundCount;
        document.getElementById('finalCompletedRounds').innerText = roundDetails.length;

        const analysisTextEl = document.getElementById('analysisText');
        if (isLoading) {
            analysisTextEl.innerHTML = `<div style="display:flex;align-items:center;gap:10px;color:#B89A78;"><i class="fas fa-spinner fa-spin" style="font-size:18px;color:#D9A066;"></i><span>🤖 AI正在分析中，请稍候...</span></div>`;
        } else {
            analysisTextEl.innerText = aiAnalysis || generateLocalAnalysis();
        }
        resultModal.classList.add('show');
        nextBtn.disabled = true;
    }

    function updateResultModalAI(aiAnalysis) {
        const el = document.getElementById('analysisText');
        el.innerHTML = aiAnalysis || generateLocalAnalysis();
    }

    function generateLocalAnalysis() {
        const rate = Math.round((successCount / TOTAL_ROUNDS) * 100);
        if (rate >= 80) return `✨ 宝贝说出了${successCount}个关键词，非常棒！发音模仿能力很强。`;
        if (rate >= 60) return `💪 宝贝说出了${successCount}个关键词，继续鼓励宝贝模仿发音。`;
        if (rate >= 40) return `🌱 宝贝说出了${successCount}个关键词，多给宝贝做示范哦。`;
        return `🌟 宝贝说出了${successCount}个关键词，坚持练习会越来越好。`;
    }

    // ========== 重新开始 ==========
    function reset() {
        active = true;
        idx = 0;
        successCount = 0;
        voiceRoundCount = 0;
        hasSucceeded = false;
        hasVoiceThisRound = false;
        roundDetails = [];
        voiceDBs = [];
        reactionTimes = [];
        roundTimers = [];
        successSpan.innerText = '0';
        updateDisplay();
        progress.style.width = '0%';
        resultModal.classList.remove('show');
        hideConfirm();
        nextBtn.disabled = false;
    }

    function goHome() { window.location.href = 'mainPart.html'; }

    function showConfirm(title, msg, onOk) {
        confirmTitle.innerText = title;
        confirmMsg.innerText = msg;
        confirmCallback = onOk;
        confirmModal.classList.add('show');
    }

    function hideConfirm() {
        confirmModal.classList.remove('show');
        confirmCallback = null;
    }

    // ========== 事件绑定 ==========
    document.getElementById('homeBtn').onclick = () => {
        VoiceSpeaker.stop(); stopRecognition(); stopAudioMonitoring();
        showConfirm('返回主页', '返回主页将结束当前游戏，确定吗？', () => { hideConfirm(); goHome(); });
    };
    document.getElementById('nextBtn').onclick = () => {
        if (!active) return;
        stopRecognition(); stopAudioMonitoring(); VoiceSpeaker.stop();
        nextRound();
    };
    document.getElementById('skipBtn').onclick = () => { VoiceSpeaker.stop(); skipRound(); };
    document.getElementById('endBtn').onclick = () => {
        VoiceSpeaker.stop(); stopRecognition(); stopAudioMonitoring();
        showConfirm('结束练习', '确定要结束练习并查看成绩吗？', () => { hideConfirm(); finish(); });
    };
    document.getElementById('speakBtn').onclick = () => { stopRecognition(); stopAudioMonitoring(); VoiceSpeaker.stop(); speakHint(); };
    document.getElementById('listenHint').onclick = () => { stopRecognition(); stopAudioMonitoring(); VoiceSpeaker.stop(); speakHint(); };
    target.onclick = () => { VoiceSpeaker.speak(library[idx].text, () => { if (active && !hasSucceeded) { startAudioMonitoring(); startRecognition(); } }); };
    micIcon.onclick = () => {
        if (isRecognitionRunning) { stopRecognition(); stopAudioMonitoring(); } else { stopRecognition(); stopAudioMonitoring(); speakHint(); }
    };
    document.getElementById('confirmCancel').onclick = hideConfirm;
    document.getElementById('confirmOk').onclick = () => { if (confirmCallback) confirmCallback(); hideConfirm(); };
    document.getElementById('restartBtn').onclick = reset;
    document.getElementById('homeBtn2').onclick = () => { resultModal.classList.remove('show'); goHome(); };

    // ========== 初始化 ==========
    initSpeechRecognition();
    updateDisplay();
    window.speechSynthesis.getVoices();

    window.addEventListener('beforeunload', () => {
        VoiceSpeaker.stop();
        stopRecognition();
        stopAudioMonitoring();
        clearRoundTimers();
        if (stream) stream.getTracks().forEach(t => t.stop());
        if (audioCtx) audioCtx.close();
    });
})();