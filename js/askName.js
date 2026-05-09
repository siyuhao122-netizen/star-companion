(function () {
    const API_BASE = 'http://localhost:5000/api';

    // ========== 阈值配置 ==========
// 正脸状态下，叫名后只要有轻微头动即可算作回应
const HEAD_TURN_THRESHOLD_PX = 80;     // 头部转向阈值
const VOICE_THRESHOLD_DB = 75;          // 声音阈值
const ROUND_TIMEOUT_MS = 4000;          // 每轮 4 秒
const CALIBRATION_TIME_MS = 2000;
const TOTAL_ROUNDS = 8;
const RESPONSE_GRACE_MS = 800;          // 语音播报后保护期
const STATUS_UPDATE_INTERVAL_MS = 300;  // 状态展示刷新间隔

const STABLE_TRIGGER_FRAMES = 100;
const FACE_APPEAR_WINDOW_MS = 1500;


    // 面部表情阈值（相对于基线的变化比例）
    // const EXPRESSION_THRESHOLDS = {
    //     smile: 1.12,    // 微笑：嘴部宽度比 > 1.12
    //     mouthOpen: 1.20, // 张嘴：嘴部宽高比 > 1.20
    //     browRaise: 1.10, // 挑眉：眉毛高度 > 1.10
    //     eyeClose: 1.70   // 闭眼：眼部宽高比 < 0.70
    // };

const EXPRESSION_THRESHOLDS = {
    smile: 1.40,
    mouthOpen: 1.60,
    browRaise: 1.40,
    eyeClose: 0.40
};
    // ========== 全局状态 ==========
    let childId = localStorage.getItem('starCompanionActiveChild');
    let childName = '宝贝';

let baseline = {
    noseEyeOffsetX: 0,
    noseLeftEyeDiffX: 0,
    noseRightEyeDiffX: 0,
    mouthWidthRatio: 0,
    mouthAspectRatio: 0,
    browHeight: 0,
    eyeAspectRatio: 0,
    calibrated: false
};

let currentRoundStatus = {
    hasFace: false,
    headTurned: false,
    headDistance: 0,
    headTurnThreshold: HEAD_TURN_THRESHOLD_PX,
    expressionTriggered: false,
    expressionNames: [],
    voiceTriggered: false,
    voiceDB: 0,
    judgeMode: '等待开始',
    triggeredBy: '无'
};
let faceMesh = null;
let faceMeshReady = false;
let isProcessingFrame = false;
let detectionLoopStarted = false;
let roundExpressionBaselineCaptured = false;
let isCameraReady = false;
let isTraining = false;
let headTurnThreshold = HEAD_TURN_THRESHOLD_PX;
let roundStartHeadTurned = false;      // 本轮正式开始时是否已经转头
let headReturnedStableCount = 0;       // 从转头回正脸的稳定帧计数
let headTurnStableCount = 0;
let roundHeadBaseline = null;
let roundStartHadFace = false;
let lastHasFace = false;
let lastNoFaceTime = Date.now();
let lastStatusUpdateTime = 0;

let noFaceSeenThisRound = false;

// 平滑后的展示数值
let smoothHeadDistance = 0;
let smoothVoiceDB = 0;

// 连续触发计数，防止单帧误判
let stableCounter = {
    head: 0,
    expression: 0,
    voice: 0,
    faceAppear: 0
};
    let currentRound = 1;
    let successCount = 0;
   let roundStartTime = 0;
let hasResponded = false;
let roundCanRespond = false;
let roundTimeout = null;
    let animationFrame = null;
    let cameraStream = null;
    let audioContext = null;
    let audioAnalyser = null;
    let audioStream = null;

    let roundMouthBaseline = null;
let mouthOpenStableCount = 0;
let smileStableCount = 0;
    // 反应记录
    let reactionRecords = [];   // 每轮的详细记录

    let roundStartExpressionState = {
    smile: false,
    mouthOpen: false,
    browRaise: false,
    eyeClose: false
};
    // DOM
    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const canvasCtx = canvasElement.getContext('2d');
    const startBtn = document.getElementById('startBtn');
    const skipBtn = document.getElementById('skipBtn');
    const resultModal = document.getElementById('resultModal');
    const homeReturnBtn = document.getElementById('homeReturnBtn');
    const calibrationBar = document.getElementById('calibrationBar');
    const calibrationFill = document.getElementById('calibrationFill');
  
// ========== 面部关键点配置 ==========
// MediaPipe FaceMesh 常用点位
const FACE_POINTS = {
    // 头部转向
    nose: 1,
    leftEyeInner: 133,

    // 嘴部：微笑、张嘴
    leftMouth: 61,
    rightMouth: 291,
    upperLip: 13,
    lowerLip: 14,

    // 眉毛：挑眉
    leftBrow: 105,
    rightBrow: 334,

    // 左眼：闭眼
    leftEyeTop: 159,
    leftEyeBottom: 145,
    leftEyeLeft: 33,
    leftEyeRight: 133,

    // 右眼：闭眼
    rightEyeTop: 386,
    rightEyeBottom: 374,
    rightEyeLeft: 362,
    rightEyeRight: 263
};

// 需要画在画面上的关键点
const FACE_DRAW_POINTS = [
    FACE_POINTS.nose,
    FACE_POINTS.leftEyeInner,
    FACE_POINTS.leftMouth,
    FACE_POINTS.rightMouth,
    FACE_POINTS.upperLip,
    FACE_POINTS.lowerLip,
    FACE_POINTS.leftBrow,
    FACE_POINTS.rightBrow,
    FACE_POINTS.leftEyeTop,
    FACE_POINTS.leftEyeBottom,
    FACE_POINTS.leftEyeLeft,
    FACE_POINTS.leftEyeRight,
    FACE_POINTS.rightEyeTop,
    FACE_POINTS.rightEyeBottom,
    FACE_POINTS.rightEyeLeft,
    FACE_POINTS.rightEyeRight
];

    // 初始化孩子信息
    const urlParams = new URLSearchParams(window.location.search);
    const urlChildId = urlParams.get('childId');
    if (urlChildId) childId = parseInt(urlChildId);
    if (localStorage.getItem('currentChildName')) {
    childName = localStorage.getItem('currentChildName');
} else {
    childName = '宝贝';
}
    document.getElementById('childDisplayName').textContent = childName;
    document.getElementById('callMessage').innerHTML = `<i class="fas fa-star"></i> ${childName}！看这里~`;
    
    // ========== 语音提示 ==========
function speakText(text, onEnd) {
    try {
        if (!window.speechSynthesis) {
            if (onEnd) setTimeout(onEnd, 500);
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        utterance.pitch = 1.15;
        utterance.volume = 1;

        const voices = window.speechSynthesis.getVoices();
        const zhVoice = voices.find(v => v.lang.includes('zh-CN')) || voices.find(v => v.lang.includes('zh'));
        if (zhVoice) utterance.voice = zhVoice;

        utterance.onend = () => {
            if (onEnd) onEnd();
        };

        utterance.onerror = () => {
            if (onEnd) setTimeout(onEnd, 300);
        };

        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('语音播报失败:', e);
        if (onEnd) setTimeout(onEnd, 500);
    }
}

    // ========== 声音检测 ==========
    async function initAudio() {
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioAnalyser = audioContext.createAnalyser();
            audioAnalyser.fftSize = 256;
            const source = audioContext.createMediaStreamSource(audioStream);
            source.connect(audioAnalyser);
            if (audioContext.state === 'suspended') await audioContext.resume();
            console.log('🎤 麦克风已就绪');
        } catch (e) {
            console.warn('⚠️ 麦克风不可用，将不使用声音维度');
        }
    }

    function getCurrentVolumeDB() {
        if (!audioAnalyser) return 0;
        const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
        audioAnalyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        if (rms < 0.0001) return 0;
        return Math.round(20 * Math.log10(rms) + 94);
    }
    

     function resetStableCounter() {
    stableCounter = {
        head: 0,
        expression: 0,
        voice: 0,
        faceAppear: 0
    };
}

function updateStableCounter(key, triggered) {
    if (triggered) {
        stableCounter[key]++;
    } else {
        stableCounter[key] = 0;
    }

    return stableCounter[key] >= STABLE_TRIGGER_FRAMES;
}

function smoothValue(oldValue, newValue, factor = 0.25) {
    if (!oldValue) return newValue;
    return Math.round(oldValue * (1 - factor) + newValue * factor);
}

function getMouthMetrics(landmarks) {
    if (!landmarks || !canvasElement) return null;

    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];
    const upperLip = landmarks[13];
    const lowerLip = landmarks[14];

    const mouthWidth = Math.abs(rightMouth.x - leftMouth.x) * canvasElement.width;
    const mouthHeight = Math.abs(lowerLip.y - upperLip.y) * canvasElement.height;

    return {
        width: mouthWidth,
        height: mouthHeight
    };
}

function getHeadMetrics(landmarks) {
    if (!landmarks || !canvasElement) return null;

    const nose = landmarks[1];
    const leftEye = landmarks[133];
    const rightEye = landmarks[362];

    const noseLeftDiffX = Math.abs(nose.x - leftEye.x) * canvasElement.width;
    const noseRightDiffX = Math.abs(nose.x - rightEye.x) * canvasElement.width;

    // 左右眼内侧距离，用来判断脸大小
    const eyeDistance = Math.abs(rightEye.x - leftEye.x) * canvasElement.width;

    return {
        noseLeftDiffX,
        noseRightDiffX,
        eyeDistance
    };
}
    // ========== 表情检测（简化版 - 基于MediaPipe Landmarks） ==========
function detectExpressions(landmarks) {
    if (!landmarks || !baseline.calibrated) {
        return {
            smile: false,
            mouthOpen: false,
            browRaise: false,
            eyeClose: false,
            detail: {}
        };
    }

    const p = FACE_POINTS;

    const leftMouth = landmarks[p.leftMouth];
    const rightMouth = landmarks[p.rightMouth];
    const upperLip = landmarks[p.upperLip];
    const lowerLip = landmarks[p.lowerLip];

    const leftBrow = landmarks[p.leftBrow];
    const rightBrow = landmarks[p.rightBrow];
    const nose = landmarks[p.nose];

    const leftEyeTop = landmarks[p.leftEyeTop];
    const leftEyeBottom = landmarks[p.leftEyeBottom];
    const leftEyeLeft = landmarks[p.leftEyeLeft];
    const leftEyeRight = landmarks[p.leftEyeRight];

    const rightEyeTop = landmarks[p.rightEyeTop];
    const rightEyeBottom = landmarks[p.rightEyeBottom];
    const rightEyeLeft = landmarks[p.rightEyeLeft];
    const rightEyeRight = landmarks[p.rightEyeRight];

    // 嘴部宽度、高度
    const mouthWidth = Math.abs(rightMouth.x - leftMouth.x);
    const mouthHeight = Math.abs(lowerLip.y - upperLip.y);

    // MWR：嘴部宽度比，用于微笑
    const currentMWR = mouthWidth / (mouthHeight || 0.001);

    // MAR：嘴部宽高比，用于张嘴
    const currentMAR = mouthHeight / (mouthWidth || 0.001);

    // 眉毛高度
    const browAvgY = (leftBrow.y + rightBrow.y) / 2;
    const currentBrowHeight = Math.abs(nose.y - browAvgY);

    // EAR：眼部宽高比，用于闭眼
    const leftEAR =
        Math.abs(leftEyeTop.y - leftEyeBottom.y) /
        (Math.abs(leftEyeLeft.x - leftEyeRight.x) || 0.001);

    const rightEAR =
        Math.abs(rightEyeTop.y - rightEyeBottom.y) /
        (Math.abs(rightEyeLeft.x - rightEyeRight.x) || 0.001);

    const currentEAR = (leftEAR + rightEAR) / 2;

    const mwrRatio = baseline.mouthWidthRatio > 0
        ? currentMWR / baseline.mouthWidthRatio
        : 1;

    const marRatio = baseline.mouthAspectRatio > 0
        ? currentMAR / baseline.mouthAspectRatio
        : 1;

    const browRatio = baseline.browHeight > 0
        ? currentBrowHeight / baseline.browHeight
        : 1;

    const earRatio = baseline.eyeAspectRatio > 0
        ? currentEAR / baseline.eyeAspectRatio
        : 1;

    return {
        smile: mwrRatio > EXPRESSION_THRESHOLDS.smile,
        mouthOpen: marRatio > EXPRESSION_THRESHOLDS.mouthOpen,
        browRaise: browRatio > EXPRESSION_THRESHOLDS.browRaise,
        eyeClose: earRatio < EXPRESSION_THRESHOLDS.eyeClose,

        smileValue: mwrRatio,
        mouthOpenValue: marRatio,
        browRaiseValue: browRatio,
        eyeCloseValue: earRatio,

        detail: {
            currentMWR,
            currentMAR,
            currentBrowHeight,
            currentEAR,
            mwrRatio,
            marRatio,
            browRatio,
            earRatio
        }
    };
}
    
function getExpressionNames(expressions) {
    const names = [];

    if (!expressions) return names;

    if (expressions.smile) {
        names.push(`微笑 MWR×${Number(expressions.smileValue || 0).toFixed(2)}`);
    }

    if (expressions.mouthOpen) {
        names.push(`张嘴 MAR×${Number(expressions.mouthOpenValue || 0).toFixed(2)}`);
    }

    if (expressions.browRaise) {
        names.push(`挑眉×${Number(expressions.browRaiseValue || 0).toFixed(2)}`);
    }

    if (expressions.eyeClose) {
        names.push(`闭眼 EAR×${Number(expressions.eyeCloseValue || 0).toFixed(2)}`);
    }

    return names;
}

function getExpressionState(expressions) {
    return {
        smile: expressions && expressions.smile === true,
        mouthOpen: expressions && expressions.mouthOpen === true,
        browRaise: expressions && expressions.browRaise === true,
        eyeClose: expressions && expressions.eyeClose === true
    };
}

function hasExpressionStateChanged(startState, currentState) {
    // 必须是“从未触发 -> 触发”，才算面部变化
    // 已经微笑 -> 还是微笑，不算变化
    return (
        (!startState.smile && currentState.smile) ||
        (!startState.mouthOpen && currentState.mouthOpen) ||
        (!startState.browRaise && currentState.browRaise) ||
        (!startState.eyeClose && currentState.eyeClose)
    );
}

    // ========== 头部转向检测 ==========
function detectHeadTurn(landmarks, canvasWidth) {
    if (!landmarks || !baseline.calibrated) {
        return { turned: false, distance: 0, direction: 'none' };
    }

    if (
        !baseline.noseLeftEyeDiffX ||
        !baseline.noseRightEyeDiffX ||
        baseline.noseLeftEyeDiffX <= 0 ||
        baseline.noseRightEyeDiffX <= 0
    ) {
        return { turned: false, distance: 0, direction: 'none' };
    }

    const nose = landmarks[FACE_POINTS.nose];
    const leftEye = landmarks[FACE_POINTS.leftEyeInner];
    const rightEye = landmarks[FACE_POINTS.rightEyeLeft];

    const currentLeftDiff = Math.abs(nose.x - leftEye.x) * canvasWidth;
    const currentRightDiff = Math.abs(nose.x - rightEye.x) * canvasWidth;

    const leftDistance = Math.abs(currentLeftDiff - baseline.noseLeftEyeDiffX);
    const rightDistance = Math.abs(currentRightDiff - baseline.noseRightEyeDiffX);

    const maxDistance = Math.max(leftDistance, rightDistance);

    let direction = 'none';

    if (leftDistance > rightDistance && leftDistance > HEAD_TURN_THRESHOLD_PX) {
        direction = 'left';
    }

    if (rightDistance > leftDistance && rightDistance > HEAD_TURN_THRESHOLD_PX) {
        direction = 'right';
    }

    return {
        turned: maxDistance > HEAD_TURN_THRESHOLD_PX,
        distance: Math.round(maxDistance),
        leftDistance: Math.round(leftDistance),
        rightDistance: Math.round(rightDistance),
        direction
    };
}

function isHeadCurrentlyTurned(landmarks, canvasWidth) {
    if (!landmarks || !baseline.calibrated) {
        return false;
    }

    if (
        !baseline.noseLeftEyeDiffX ||
        !baseline.noseRightEyeDiffX ||
        baseline.noseLeftEyeDiffX <= 0 ||
        baseline.noseRightEyeDiffX <= 0
    ) {
        return false;
    }

    const nose = landmarks[FACE_POINTS.nose];
    const leftEye = landmarks[FACE_POINTS.leftEyeInner];
    const rightEye = landmarks[FACE_POINTS.rightEyeLeft];

    if (!nose || !leftEye || !rightEye) {
        return false;
    }

    const currentLeftDiff = Math.abs(nose.x - leftEye.x) * canvasWidth;
    const currentRightDiff = Math.abs(nose.x - rightEye.x) * canvasWidth;

    const leftDistance = Math.abs(currentLeftDiff - baseline.noseLeftEyeDiffX);
    const rightDistance = Math.abs(currentRightDiff - baseline.noseRightEyeDiffX);

    const maxDistance = Math.max(leftDistance, rightDistance);

    return maxDistance > HEAD_TURN_THRESHOLD_PX;
}


    // ========== 基线校准 ==========
    async function calibrateBaseline() {
        return new Promise((resolve, reject) => {
            calibrationBar.style.display = 'block';
            calibrationFill.style.width = '0%';
            document.getElementById('detectionResultText').textContent = '📐 正在校准，请让宝贝正对镜头...';

            let sampleCount = 0;
            const maxSamples = 20;  // 采集20个样本
            const sampleInterval = CALIBRATION_TIME_MS / maxSamples;
            const maxWaitTime = 5000; // 最多等待5秒
            const startTime = Date.now();

            // 临时存储基线样本
            window._calibrationSamples = [];
            window._isCalibrating = true;

            const intervalId = setInterval(() => {
                const elapsed = Date.now() - startTime;

                // 超时检查
                if (elapsed > maxWaitTime) {
                    clearInterval(intervalId);
                    window._isCalibrating = false;
                    calibrationBar.style.display = 'none';

                    if (window._calibrationSamples.length < 3) {
                        console.warn('⚠️ 校准超时，使用默认阈值');
                        baseline.calibrated = true; // 使用默认值
                        document.getElementById('detectionResultText').textContent = '⚠️ 未检测到人脸，使用默认阈值';
                        resolve();
                        return;
                    }
                }

                sampleCount++;
                calibrationFill.style.width = `${(sampleCount / maxSamples) * 100}%`;

                if (sampleCount >= maxSamples) {
                    clearInterval(intervalId);
                    window._isCalibrating = false;

                    if (window._calibrationSamples.length < 3) {
                        calibrationBar.style.display = 'none';
                        console.warn('⚠️ 样本不足，使用默认阈值');
                        baseline.calibrated = true;
                        document.getElementById('detectionResultText').textContent = '⚠️ 样本不足，使用默认阈值';
                        resolve();
                        return;
                    }

                    // 计算平均值作为基线
                  const avg = window._calibrationSamples.reduce((acc, s) => {
    acc.noseLeftEyeDiffX += s.noseLeftEyeDiffX;
    acc.noseRightEyeDiffX += s.noseRightEyeDiffX;
    acc.mouthWidthRatio += s.mouthWidthRatio;
    acc.mouthAspectRatio += s.mouthAspectRatio;
    acc.browHeight += s.browHeight;
    acc.eyeAspectRatio += s.eyeAspectRatio;
    return acc;
}, {
    noseLeftEyeDiffX: 0,
    noseRightEyeDiffX: 0,
    mouthWidthRatio: 0,
    mouthAspectRatio: 0,
    browHeight: 0,
    eyeAspectRatio: 0
});

const count = window._calibrationSamples.length;

baseline.noseLeftEyeDiffX = avg.noseLeftEyeDiffX / count;
baseline.noseRightEyeDiffX = avg.noseRightEyeDiffX / count;
baseline.mouthWidthRatio = avg.mouthWidthRatio / count;
baseline.mouthAspectRatio = avg.mouthAspectRatio / count;
baseline.browHeight = avg.browHeight / count;
baseline.eyeAspectRatio = avg.eyeAspectRatio / count;
baseline.calibrated = true;
                    calibrationBar.style.display = 'none';
                    document.getElementById('detectionResultText').textContent = '✅ 校准完成，准备开始训练';
                    console.log('📐 基线校准完成:', baseline);
                    resolve();
                }
            }, sampleInterval);
        });
    }

    // 采集单个校准样本
function collectCalibrationSample(landmarks, canvasWidth) {
    if (!window._isCalibrating || !landmarks) return;

    const p = FACE_POINTS;

    const nose = landmarks[p.nose];
    const leftEyeInner = landmarks[p.leftEyeInner];
   const rightEyeInner = landmarks[p.rightEyeRight];
    const leftMouth = landmarks[p.leftMouth];
    const rightMouth = landmarks[p.rightMouth];
    const upperLip = landmarks[p.upperLip];
    const lowerLip = landmarks[p.lowerLip];

    const leftBrow = landmarks[p.leftBrow];
    const rightBrow = landmarks[p.rightBrow];

    const leftEyeTop = landmarks[p.leftEyeTop];
    const leftEyeBottom = landmarks[p.leftEyeBottom];
    const leftEyeLeft = landmarks[p.leftEyeLeft];
    const leftEyeRight = landmarks[p.leftEyeRight];

    const rightEyeTop = landmarks[p.rightEyeTop];
    const rightEyeBottom = landmarks[p.rightEyeBottom];
    const rightEyeLeft = landmarks[p.rightEyeLeft];
    const rightEyeRight = landmarks[p.rightEyeRight];

    // 头部转向基线
    const noseLeftEyeDiffX = Math.abs(nose.x - leftEyeInner.x) * canvasWidth;
const noseRightEyeDiffX = Math.abs(nose.x - rightEyeInner.x) * canvasWidth;
    // 嘴部基线
    const mouthWidth = Math.abs(rightMouth.x - leftMouth.x);
    const mouthHeight = Math.abs(lowerLip.y - upperLip.y);
    const mouthWidthRatio = mouthWidth / (mouthHeight || 0.001);
    const mouthAspectRatio = mouthHeight / (mouthWidth || 0.001);

    // 眉毛高度基线
    const browAvgY = (leftBrow.y + rightBrow.y) / 2;
    const browHeight = Math.abs(nose.y - browAvgY);

    // 眼部 EAR 基线
    const leftEAR =
        Math.abs(leftEyeTop.y - leftEyeBottom.y) /
        (Math.abs(leftEyeLeft.x - leftEyeRight.x) || 0.001);

    const rightEAR =
        Math.abs(rightEyeTop.y - rightEyeBottom.y) /
        (Math.abs(rightEyeLeft.x - rightEyeRight.x) || 0.001);

    const eyeAspectRatio = (leftEAR + rightEAR) / 2;

  window._calibrationSamples.push({
    noseLeftEyeDiffX,
    noseRightEyeDiffX,
    mouthWidthRatio,
    mouthAspectRatio,
    browHeight,
    eyeAspectRatio
});
}

async function initFaceMesh() {
    try {
        if (typeof FaceMesh === 'undefined') {
            throw new Error('MediaPipe FaceMesh 脚本未加载，请检查网络或 CDN');
        }

        faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        faceMesh.onResults(onFaceMeshResults);
        faceMeshReady = true;
        return true;
    } catch (error) {
        console.error('FaceMesh init failed:', error);
        faceMeshReady = false;
        return false;
    }
}

// 找到 drawFaceMesh 函数，将其内容清空

function drawFaceMesh(landmarks) {
    // 所有可视化元素已隐藏，功能不受影响
    // 如果将来需要恢复显示，取消下面代码的注释即可
    return;
    
    /*
    if (!landmarks || !canvasElement || !canvasCtx) return;

    // 完整脸部网格
    if (typeof drawConnectors !== 'undefined' && typeof FACEMESH_TESSELATION !== 'undefined') {
        drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {
            color: 'rgba(76, 175, 80, 0.22)',
            lineWidth: 1
        });
    }

    // 关键点
    canvasCtx.fillStyle = '#4CAF50';
    FACE_DRAW_POINTS.forEach((idx) => {
        const lm = landmarks[idx];
        if (!lm) return;
        const x = lm.x * canvasElement.width;
        const y = lm.y * canvasElement.height;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
    });

    // 嘴部线：微笑 / 张嘴
    drawLine(landmarks[FACE_POINTS.leftMouth], landmarks[FACE_POINTS.rightMouth], '#FF9800');
    drawLine(landmarks[FACE_POINTS.upperLip], landmarks[FACE_POINTS.lowerLip], '#FF9800');

    // 眼部线：闭眼
    drawLine(landmarks[FACE_POINTS.leftEyeTop], landmarks[FACE_POINTS.leftEyeBottom], '#2196F3');
    drawLine(landmarks[FACE_POINTS.rightEyeTop], landmarks[FACE_POINTS.rightEyeBottom], '#2196F3');

    // 头部转向线：鼻子到左眼、鼻子到右眼
    drawLine(landmarks[FACE_POINTS.nose], landmarks[FACE_POINTS.leftEyeInner], '#E91E63');
    drawLine(landmarks[FACE_POINTS.nose], landmarks[FACE_POINTS.rightEyeLeft], '#E91E63');
    */
}

function drawLine(p1, p2, color) {
    if (!p1 || !p2) return;

    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = 3;
    canvasCtx.beginPath();
    canvasCtx.moveTo(p1.x * canvasElement.width, p1.y * canvasElement.height);
    canvasCtx.lineTo(p2.x * canvasElement.width, p2.y * canvasElement.height);
    canvasCtx.stroke();
}

function drawLine(p1, p2, color) {
    if (!p1 || !p2) return;

    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.moveTo(p1.x * canvasElement.width, p1.y * canvasElement.height);
    canvasCtx.lineTo(p2.x * canvasElement.width, p2.y * canvasElement.height);
    canvasCtx.stroke();
}
    // ========== FaceMesh 初始化 ==========
function onFaceMeshResults(results) {
    if (!canvasElement || !videoElement) return;

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
    const landmarks = hasFace ? results.multiFaceLandmarks[0] : null;
    const canvasWidth = canvasElement.width;
    const now = Date.now();

    const faceReappeared = hasFace && !lastHasFace;

// 本轮已经允许回应后，如果检测不到脸，记录本轮确实经历过“无脸”
if (roundCanRespond && !hasFace) {
    noFaceSeenThisRound = true;
}

if (!hasFace) {
    lastNoFaceTime = now;
}

    // 校准阶段采样
    if (window._isCalibrating && landmarks) {
        collectCalibrationSample(landmarks, canvasWidth);
    }

    let headTurnDetected = false;
    let headTurnDistance = 0;
    let headTurnDirection = 'none';
    let expressions = {};
    let expressionTriggered = false;

    // 声音维度：无论脸可不可见，都能检测
    const voiceDB = getCurrentVolumeDB();
    const voiceTriggered = voiceDB >= VOICE_THRESHOLD_DB;

    // 脸可见时，计算头部和面部
    if (hasFace && landmarks) {
    const headResult = detectHeadTurn(landmarks, canvasWidth);
const currentHeadTurned = headResult.turned;

headTurnDistance = headResult.distance;
headTurnDirection = headResult.direction || 'none';
headTurnThreshold = headResult.threshold || HEAD_TURN_THRESHOLD_PX;

// 本轮正式开始后，第一次检测到脸时，记录起始头部状态
if (roundCanRespond && roundStartTime > 0 && roundHeadBaseline === null) {
    roundStartHeadTurned = currentHeadTurned;
}

// 新规则：
// 如果本轮开始时就是转头状态，后面回到不转头状态，才算“头部回应”
if (roundCanRespond && roundStartHeadTurned) {
    if (!currentHeadTurned) {
        headReturnedStableCount++;
    } else {
        headReturnedStableCount = 0;
    }

    headTurnDetected = headReturnedStableCount >= 3;
} else {
    // 如果本轮开始时是正脸，不再靠“转头”判定成功
    // 保留面部和声音原有判定，不动
    headTurnDetected = false;
}
expressions = {
    smile: false,
    mouthOpen: false,
    browRaise: false,
    eyeClose: false,
    smileValue: 1,
    mouthOpenValue: 1,
    browRaiseValue: 1,
    eyeCloseValue: 1,
    detail: {}
};

const mouthMetrics = getMouthMetrics(landmarks);

if (roundCanRespond && mouthMetrics) {
    // 第一次有脸时，只记录本轮嘴部初始状态，不判定
    if (!roundMouthBaseline) {
        roundMouthBaseline = {
            width: mouthMetrics.width,
            height: mouthMetrics.height
        };
    } else {
        const widthDelta = mouthMetrics.width - roundMouthBaseline.width;
        const heightDelta = mouthMetrics.height - roundMouthBaseline.height;

        // 张嘴：嘴巴高度至少增加 10px，且增加比例明显
        const mouthOpenNow =
            heightDelta > 10 &&
            mouthMetrics.height > roundMouthBaseline.height * 1.45;

        // 微笑：嘴巴宽度至少增加 14px，同时嘴巴高度没有明显增加
        const smileNow =
            widthDelta > 14 &&
            mouthMetrics.width > roundMouthBaseline.width * 1.20 &&
            heightDelta < 8;

        if (mouthOpenNow) {
            mouthOpenStableCount++;
        } else {
            mouthOpenStableCount = 0;
        }

        if (smileNow) {
            smileStableCount++;
        } else {
            smileStableCount = 0;
        }

        expressions.mouthOpen = mouthOpenStableCount >= 5;
        expressions.smile = smileStableCount >= 5;

        expressions.mouthOpenValue = roundMouthBaseline.height > 0
            ? mouthMetrics.height / roundMouthBaseline.height
            : 1;

        expressions.smileValue = roundMouthBaseline.width > 0
            ? mouthMetrics.width / roundMouthBaseline.width
            : 1;

        expressions.detail = {
            mouthWidth: mouthMetrics.width,
            mouthHeight: mouthMetrics.height,
            baselineWidth: roundMouthBaseline.width,
            baselineHeight: roundMouthBaseline.height,
            widthDelta,
            heightDelta
        };
    }
}

// 暂时只让嘴部变化参与面部变化
// 眉毛、闭眼后面再单独调，避免多维度一起误判
expressionTriggered =
    expressions.smile === true ||
    expressions.mouthOpen === true;
}

    let triggeredByList = [];
if (hasFace) {
    // 脸可见：只能靠头部 / 面部 / 声音变化成功
    if (headTurnDetected) triggeredByList.push('头部回正');
    if (expressionTriggered) triggeredByList.push('面部变化');
    if (voiceTriggered) triggeredByList.push('声音变化');

    // 只有本轮一开始没脸，且过程中真的经历过无脸，再出现脸，才算“重新看向镜头”
    if (
    roundCanRespond &&
    noFaceSeenThisRound &&
    faceReappeared
) {
    triggeredByList.push('重新看向镜头');
}
} else {
    // 脸不可见：只能靠声音，或者等后面重新出现脸
    if (voiceTriggered) triggeredByList.push('声音变化');
}

    currentRoundStatus = {
        hasFace,
        headTurned: headTurnDetected,
        headDistance: headTurnDistance,
        expressionTriggered,
        expressionNames: getExpressionNames(expressions),
        voiceTriggered,
        voiceDB,
        judgeMode: hasFace
            ? '脸可见：头部 / 面部 / 声音'
            : '脸不可见：声音 / 重新出现人脸',
        triggeredBy: triggeredByList.length ? triggeredByList.join(' + ') : '无'
    };

    // 成功判定：只有语音播报结束、允许回应后才开始判断
    if (isTraining && roundCanRespond && roundStartTime > 0 && !hasResponded) {
        if (triggeredByList.length > 0) {
            const reactionTime = (Date.now() - roundStartTime) / 1000;

            handleResponse(
                reactionTime,
                headTurnDetected,
                expressionTriggered,
                voiceTriggered,
                headTurnDistance,
                voiceDB,
                expressions
            );
        }
    }

    // 状态展示，避免刷新太快
    if (now - lastStatusUpdateTime >= STATUS_UPDATE_INTERVAL_MS) {
        updateDetectionDisplay(hasFace, headTurnDetected, expressions, voiceTriggered, voiceDB);
        lastStatusUpdateTime = now;
    }

    if (landmarks) {
        drawFaceMesh(landmarks);
    }
    lastHasFace = hasFace;
}

    function updateDetectionDisplay(hasFace, headTurned, expressions, voiceTriggered, voiceDB) {
    const statusIndicator = document.getElementById('statusIndicator');
    const detectionResultText = document.getElementById('detectionResultText');
    const headPoseSpan = document.querySelector('#headPoseStatus span');
    const expressionSpan = document.querySelector('#expressionStatus span');
    const voiceSpan = document.querySelector('#voiceStatus span');
    const additionalInfo = document.getElementById('additionalInfo');

    const expressionNames = getExpressionNames(expressions);
    const expressionTriggered = expressionNames.length > 0;

    if (!hasFace) {
        headPoseSpan.textContent = '未检测到人脸';
    } else if (headTurned) {
    headPoseSpan.textContent = `头部从转头回正 ✓`;
    } else {
        headPoseSpan.textContent = `头部 ${currentRoundStatus.headDistance || 0}px / ${HEAD_TURN_THRESHOLD_PX}px`;
    }

    if (!hasFace) {
        expressionSpan.textContent = '脸不可见';
        expressionSpan.style.color = '#8F6A44';
    } else if (expressionTriggered) {
        expressionSpan.textContent = expressionNames.join(' / ') + ' ✓';
        expressionSpan.style.color = '#4CAF50';
    } else {
        expressionSpan.textContent = '面部自然';
        expressionSpan.style.color = '#8F6A44';
    }

    if (voiceTriggered) {
        voiceSpan.textContent = `声音 ${voiceDB}dB ✓`;
        voiceSpan.style.color = '#4CAF50';
    } else {
        voiceSpan.textContent = `声音 ${voiceDB}dB`;
        voiceSpan.style.color = '#8F6A44';
    }

    const hasTriggered = currentRoundStatus.triggeredBy !== '无';

    if (hasTriggered) {
        statusIndicator.className = 'status-indicator success';
        detectionResultText.textContent = `检测到回应：${currentRoundStatus.triggeredBy}`;
    } else if (isTraining && roundCanRespond) {
        statusIndicator.className = 'status-indicator active';
        detectionResultText.textContent = hasFace ? '监控中：脸可见，三维度判定' : '监控中：脸不可见，声音维度判定';
    } else {
        statusIndicator.className = 'status-indicator';
        detectionResultText.textContent = isTraining ? '等待语音提示结束...' : '等待开始训练';
    }

    additionalInfo.innerHTML = `
    <i class="fas fa-layer-group"></i>
    当前组状态：
    ${currentRoundStatus.judgeMode}；
    ${currentRoundStatus.hasFace ? '已识别正脸' : '暂未识别正脸'}；
    头部 ${currentRoundStatus.headDistance || 0}px / ${HEAD_TURN_THRESHOLD_PX}px；
    面部 ${currentRoundStatus.expressionNames && currentRoundStatus.expressionNames.length ? currentRoundStatus.expressionNames.join('、') : '未触发'}；
    声音 ${currentRoundStatus.voiceDB || 0}dB / ${VOICE_THRESHOLD_DB}dB；
    触发：${currentRoundStatus.triggeredBy}
`;
}

    // ========== 处理成功回应 ==========
  function handleResponse(reactionTime, headTurned, expressionTriggered, voiceTriggered, headDistance, voiceDB, expressions) {
    if (hasResponded || !roundCanRespond) return;

    hasResponded = true;
    roundCanRespond = false;
    successCount++;
    clearTimeout(roundTimeout);

        const successReasons = [];

if (headTurned) successReasons.push('头部');
if (expressionTriggered) successReasons.push('面部');
if (voiceTriggered) successReasons.push('声音');

if (
    currentRoundStatus &&
    currentRoundStatus.triggeredBy &&
    currentRoundStatus.triggeredBy.includes('重新看向镜头')
) {
    successReasons.push('重新看向镜头');
}

const record = {
    round: currentRound,
    success: true,
    reactionTime: parseFloat(reactionTime.toFixed(2)),

    // 三个核心维度
    headTurned,
    expressionTriggered,
    voiceTriggered,

    // 新增：本轮成功原因，给后端打印用
    successReasons,
    successReasonText: successReasons.length ? successReasons.join(' + ') : '未知',

    headDistance: Math.round(headDistance),
    voiceDB,

    expressions: {
        smile: expressions.smile === true,
        mouthOpen: expressions.mouthOpen === true,
        browRaise: expressions.browRaise === true,
        eyeClose: expressions.eyeClose === true,
        names: getExpressionNames(expressions),
        detail: expressions.detail || {}
    }
};
        reactionRecords.push(record);

        document.getElementById('successCount').textContent = successCount;
        document.getElementById('reactionTime').innerHTML = reactionTime.toFixed(1) + '<span class="stat-unit">秒</span>';
        document.getElementById('callMessage').innerHTML = '<i class="fas fa-check-circle" style="color: #4CAF50;"></i> 太棒了！';
        document.getElementById('statusIndicator').className = 'status-indicator success';
        document.getElementById('detectionResultText').textContent = '✓ 回应成功！';

        setTimeout(() => nextRound(), 800);
    }

    // ========== 轮次控制 ==========
function startRound() {
    if (!isTraining) return;
    if (currentRound > TOTAL_ROUNDS) {
        finishTraining();
        return;
    }

    clearTimeout(roundTimeout);

hasResponded = false;

roundCanRespond = false;
roundStartTime = 0;
roundStartHadFace = false;
noFaceSeenThisRound = false;
lastNoFaceTime = Date.now();

resetStableCounter();
smoothHeadDistance = 0;
smoothVoiceDB = 0;

    document.getElementById('roundDisplay').textContent = `${currentRound}/${TOTAL_ROUNDS}`;
    document.getElementById('reactionTime').innerHTML = '—<span class="stat-unit">秒</span>';
    updateProgress();

    document.getElementById('callMessage').innerHTML = `<i class="fas fa-star"></i> ${childName}！看这里~`;
    document.getElementById('callSubMessage').innerHTML = '<i class="fas fa-volume-up"></i> 正在叫宝贝的名字';
    document.getElementById('additionalInfo').innerHTML =
        '<i class="fas fa-hourglass-half"></i> 第 ' + currentRound + ' 轮 · 请等待语音提示结束后回应';
    document.getElementById('detectionResultText').textContent = '正在语音叫名...';
    document.getElementById('statusIndicator').className = 'status-indicator active';

    // 先语音叫名，语音结束后再开始计时和检测
    speakText(`${childName}，看这里`, () => {
        if (!isTraining || hasResponded) return;

        document.getElementById('callSubMessage').innerHTML = '<i class="fas fa-cat"></i> 小猫正在等待回应';
        document.getElementById('additionalInfo').innerHTML =
            '<i class="fas fa-hourglass-half"></i> 第 ' + currentRound + ' 轮 · 等待宝贝回应';
        document.getElementById('detectionResultText').textContent = '等待回应...';

       setTimeout(() => {
    if (!isTraining || hasResponded) return;
roundStartHadFace = lastHasFace;
noFaceSeenThisRound = !lastHasFace;

roundStartExpressionState = {
    smile: false,
    mouthOpen: false,
    browRaise: false,
    eyeClose: false
};

roundExpressionBaselineCaptured = false;

// 每轮重新记录嘴部基线
roundMouthBaseline = null;
mouthOpenStableCount = 0;
smileStableCount = 0;

// 每轮重新记录头部状态
roundHeadBaseline = null;
headTurnStableCount = 0;
headReturnedStableCount = 0;

// 先默认不是转头，后面 onFaceMeshResults 第一帧有脸时会补真实状态
roundStartHeadTurned = false;

roundCanRespond = true;
roundStartTime = Date.now();
    roundTimeout = setTimeout(() => {
        if (!hasResponded && isTraining) {
            roundCanRespond = false;

            reactionRecords.push({
                round: currentRound,
                success: false,
                reactionTime: 4.0,
                reason: 'timeout'
            });

            document.getElementById('detectionResultText').textContent = '超时';
            document.getElementById('statusIndicator').className = 'status-indicator';

            setTimeout(() => nextRound(), 500);
        }
    }, ROUND_TIMEOUT_MS);
}, RESPONSE_GRACE_MS);
    });
}

    function nextRound() {
    clearTimeout(roundTimeout);
    roundCanRespond = false;
    roundStartTime = 0;
    currentRound++;
    startRound();
}

   function skipRound() {
    if (!isTraining) return;
    clearTimeout(roundTimeout);
    roundCanRespond = false;
        reactionRecords.push({
            round: currentRound,
            success: false,
            reason: 'skip'
        });
        setTimeout(() => nextRound(), 300);
    }

    function updateProgress() {
        const progress = (currentRound - 1) / TOTAL_ROUNDS * 100;
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressPercent').textContent = Math.round(progress) + '%';
    }

    // ========== 保存和显示结果 ==========
    async function saveTrainingRecord() {
        const successRecords = reactionRecords.filter(r => r.success);
        const successTimes = successRecords.map(r => r.reactionTime).filter(t => t > 0);
        const avgReactionTime = successTimes.length > 0
            ? parseFloat((successTimes.reduce((a, b) => a + b, 0) / successTimes.length).toFixed(2))
            : null;

        const headSuccess = successRecords.filter(r => r.headTurned && !r.voiceTriggered);
        const voiceSuccess = successRecords.filter(r => r.voiceTriggered && !r.headTurned && !r.expressionTriggered);
        const bothSuccess = successRecords.filter(r => (r.headTurned || r.expressionTriggered) && r.voiceTriggered);
        const headDistances = successRecords.filter(r => r.headDistance > 0).map(r => r.headDistance);
        const voiceDBs = successRecords.filter(r => r.voiceDB > 0).map(r => r.voiceDB);

        const record = {
            child_id: childId,
            session_date: new Date().toISOString().split('T')[0],
            round_total: TOTAL_ROUNDS,
            success_count: successCount,
            avg_reaction_time: avgReactionTime,
            round_details: reactionRecords,
            extra_data: {
                headTurnRatio: Math.round((headSuccess.length / TOTAL_ROUNDS) * 100),
                voiceRatio: Math.round((voiceSuccess.length / TOTAL_ROUNDS) * 100),
                bothRatio: Math.round((bothSuccess.length / TOTAL_ROUNDS) * 100),
                avgHeadDistance: headDistances.length > 0 ? Math.round(headDistances.reduce((a, b) => a + b, 0) / headDistances.length) : 0,
                avgVoiceDB: voiceDBs.length > 0 ? Math.round(voiceDBs.reduce((a, b) => a + b, 0) / voiceDBs.length) : 0
            }
        };

        try {
            const response = await fetch(`${API_BASE}/games/name-reaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            const result = await response.json();
            if (response.ok && result.id) {
                return { success: true, recordId: result.id, aiAnalysis: result.ai_analysis };
            } else {
                console.error('保存失败:', result);
                return { success: false };
            }
        } catch (error) {
            console.error('网络错误:', error);
            return { success: false };
        }
    }

    function showResultModal(recordId, aiAnalysis) {
        const successRate = Math.round((successCount / TOTAL_ROUNDS) * 100);
        const successRecords = reactionRecords.filter(r => r.success);
        const times = successRecords.map(r => r.reactionTime).filter(t => t > 0);
        const avgTime = times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : '—';
        const minTime = times.length ? Math.min(...times).toFixed(1) : '—';
        const maxTime = times.length ? Math.max(...times).toFixed(1) : '—';

        const headOnly = successRecords.filter(r => r.headTurned && !r.voiceTriggered && !r.expressionTriggered);
        const voiceOnly = successRecords.filter(r => r.voiceTriggered && !r.headTurned && !r.expressionTriggered);
        const both = successRecords.filter(r => (r.headTurned || r.expressionTriggered) && r.voiceTriggered);
        const headDists = successRecords.filter(r => r.headDistance > 0).map(r => r.headDistance);
        const voiceDBs = successRecords.filter(r => r.voiceDB > 0).map(r => r.voiceDB);

        document.getElementById('reportTotalRounds').innerText = TOTAL_ROUNDS;
        document.getElementById('reportSuccessCount').innerText = successCount;
        document.getElementById('reportSuccessRate').innerText = successRate + '%';
        document.getElementById('reportAvgTime').innerHTML = avgTime !== '—' ? avgTime + '<span class="stat-unit">秒</span>' : '—';
        document.getElementById('reportMinTime').innerHTML = minTime !== '—' ? minTime + '<span class="stat-unit">秒</span>' : '—';
        document.getElementById('reportMaxTime').innerHTML = maxTime !== '—' ? maxTime + '<span class="stat-unit">秒</span>' : '—';
        document.getElementById('reportHeadRatio').innerText = Math.round((headOnly.length / TOTAL_ROUNDS) * 100) + '%';
        document.getElementById('reportVoiceRatio').innerText = Math.round((voiceOnly.length / TOTAL_ROUNDS) * 100) + '%';
        document.getElementById('reportBothRatio').innerText = Math.round((both.length / TOTAL_ROUNDS) * 100) + '%';
        document.getElementById('reportAvgHeadDist').innerHTML = headDists.length > 0 ? Math.round(headDists.reduce((a, b) => a + b, 0) / headDists.length) + '<span class="stat-unit">px</span>' : '—';
        document.getElementById('reportAvgVoiceDb').innerHTML = voiceDBs.length > 0 ? Math.round(voiceDBs.reduce((a, b) => a + b, 0) / voiceDBs.length) + '<span class="stat-unit">dB</span>' : '—';
        document.getElementById('reportTimeout').innerText = reactionRecords.filter(r => r.reason === 'timeout').length;

        document.getElementById('analysisText').innerText = aiAnalysis || `本次训练成功${successCount}次，成功率${successRate}%。继续加油，宝贝会越来越棒！✨`;
        resultModal.classList.add('show');
    }

    async function finishTraining() {
        isTraining = false;
        startBtn.innerHTML = '<i class="fas fa-play"></i> 开始训练';
        startBtn.disabled = false;
        skipBtn.disabled = true;
        updateProgress();
        document.getElementById('callMessage').innerHTML = '<i class="fas fa-party-horn"></i> 训练完成！';
        document.getElementById('statusIndicator').className = 'status-indicator success';
        document.getElementById('detectionResultText').textContent = `训练完成 · 成功率 ${Math.round(successCount / TOTAL_ROUNDS * 100)}%`;

        const result = await saveTrainingRecord();
        showResultModal(result.recordId, result.aiAnalysis);
    }

    // ========== 启动训练流程 ==========
async function requestCameraAndStart() {
    if (isTraining) return;

    // 只有摄像头、FaceMesh、检测循环都准备好，才允许直接开始下一轮训练
    if (isCameraReady && faceMeshReady && detectionLoopStarted) {
        if (!baseline.calibrated) baseline.calibrated = true;
        startTrainingCore();
        return;
    }

    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在准备...';
    startBtn.disabled = true;

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('当前浏览器不支持摄像头调用，请使用 Chrome / Edge，并通过 localhost 或 https 访问');
        }

        document.querySelector('#cameraStatus span').textContent = '正在请求摄像头...';

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
            audio: false
        });

        cameraStream = stream;
        videoElement.srcObject = stream;
        videoElement.muted = true;

        // 等待 video 真正可播放，避免 onloadedmetadata 不触发导致一直卡住
        await new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                reject(new Error('摄像头画面加载超时，请刷新页面后重试'));
            }, 8000);

            const done = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);

                videoElement.play().catch(() => {});
                canvasElement.width = videoElement.videoWidth || 640;
                canvasElement.height = videoElement.videoHeight || 480;

                isCameraReady = true;
                document.querySelector('#cameraStatus span').textContent = '摄像头已就绪';
                resolve();
            };

            if (videoElement.readyState >= 2 && videoElement.videoWidth) {
                done();
            } else {
                videoElement.onloadedmetadata = done;
                videoElement.oncanplay = done;
            }
        });

        document.getElementById('detectionResultText').textContent = '正在加载人脸检测模型...';

        const ok = await initFaceMesh();
        if (!ok) {
            throw new Error('人脸检测初始化失败，请检查网络或 MediaPipe CDN 是否可访问');
        }

        // 麦克风失败不影响训练
        await initAudio();

        startDetectionLoop();

        // 不强制等到检测出人脸，否则容易一直卡在开始前
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            await calibrateBaseline();
        } catch (e) {
            console.warn('校准失败，使用默认阈值:', e);
            calibrationBar.style.display = 'none';
            baseline.calibrated = true;
            document.getElementById('detectionResultText').textContent = '⚠️ 校准失败，使用默认阈值继续训练';
        }

        startTrainingCore();

    } catch (err) {
        console.error('叫名反应启动失败:', err);

        let errorMsg = '启动失败：';
        if (err.name === 'NotAllowedError') {
            errorMsg += '请允许摄像头权限';
        } else if (err.name === 'NotFoundError') {
            errorMsg += '未检测到摄像头';
        } else {
            errorMsg += (err.message || '未知错误');
        }

        alert(errorMsg);

        document.querySelector('#cameraStatus span').textContent = '摄像头未就绪';
        document.getElementById('detectionResultText').textContent = '启动失败，请重试';

        startBtn.innerHTML = '<i class="fas fa-play"></i> 开始训练';
        startBtn.disabled = false;
    }
}

    function startTrainingCore() {
        isTraining = true;
        currentRound = 1;
        successCount = 0;
        reactionRecords = [];
        document.getElementById('successCount').textContent = '0';
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 训练中...';
        startBtn.disabled = true;
        skipBtn.disabled = false;
        updateProgress();
        startRound();
    }

function startDetectionLoop() {
    if (detectionLoopStarted) return;
    detectionLoopStarted = true;

    async function detectFrame() {
        if (
            videoElement.readyState >= 2 &&
            faceMeshReady &&
            faceMesh &&
            !isProcessingFrame
        ) {
            isProcessingFrame = true;

            try {
                // 关键修复：必须 await，防止每一帧都塞 faceMesh.send，导致页面无响应
                await faceMesh.send({ image: videoElement });
            } catch (e) {
                console.warn('FaceMesh 单帧检测失败，已跳过:', e.message || e);
            } finally {
                isProcessingFrame = false;
            }
        }

        animationFrame = requestAnimationFrame(detectFrame);
    }

    detectFrame();
}

    // ========== 按钮事件 ==========
    startBtn.addEventListener('click', requestCameraAndStart);
    skipBtn.addEventListener('click', skipRound);
    homeReturnBtn.addEventListener('click', () => { window.location.href = 'mainPart.html'; });
    skipBtn.disabled = true;

    window.addEventListener('beforeunload', () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
        if (audioStream) audioStream.getTracks().forEach(track => track.stop());
        if (audioContext) audioContext.close();
    });
})();