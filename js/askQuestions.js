(function () {
    const API_BASE = 'http://localhost:5000/api';
    
    // 获取参数
    let childId = localStorage.getItem('starCompanionActiveChild');
    const urlParams = new URLSearchParams(window.location.search);
    const urlChildId = urlParams.get('childId');
    const scaleType = urlParams.get('scale') || 'mchat';
    
    if (!childId && urlChildId) childId = urlChildId;
    if (!childId) {
        alert('无法获取孩子信息，请返回主界面重新进入');
        window.location.href = 'mainPart.html';
        return;
    }
    childId = parseInt(childId);
    
    // 状态变量
    let questions = [];
    let scaleConfig = null;
    let currentIndex = 0;
    let answers = [];
    let totalQuestions = 0;
    
    // DOM 元素
    const surveyMain = document.getElementById('surveyMain');
    const loadingArea = document.getElementById('loadingArea');
    const questionArea = document.getElementById('questionArea');
    const resultArea = document.getElementById('resultArea');
    const aiLoadingArea = document.getElementById('aiLoadingArea');
    const progressText = document.getElementById('progressText');
    const surveyTitle = document.getElementById('surveyTitle');
    const surveySubtitle = document.getElementById('surveySubtitle');
    
    // 选项配置
    const freqOptions = [
        { main: '从不', sub: '几乎没有', value: 0 },
        { main: '偶尔', sub: '有时出现', value: 0 },
        { main: '经常', sub: '频繁出现', value: 1 }
    ];
    
    const yesNoOptions = [
        { main: '是', sub: '能做到/有', value: 1 },
        { main: '否', sub: '做不到/没有', value: 0 }
    ];
    
    function showToast(msg, bg = '#FEF3E2') {
        let old = document.querySelector('.toast-msg');
        if (old) old.remove();
        let div = document.createElement('div');
        div.className = 'toast-msg';
        div.innerHTML = `<i class="fas fa-heart"></i> ${msg}`;
        div.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: ${bg}; padding: 10px 24px; border-radius: 48px;
            font-weight: 600; color: #B4753E; z-index: 1000;
            box-shadow: 0 4px 16px rgba(0,0,0,0.1); border: 1px solid #FFE4CA;
        `;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2000);
    }
    
    async function fetchScaleInfo() {
        try {
            const response = await fetch(`${API_BASE}/ai/scale-info/${scaleType}`);
            const result = await response.json();
            if (result.success) {
                scaleConfig = result.data;
            }
        } catch (error) {
            console.error('获取量表信息失败:', error);
        }
    }
    
    async function fetchQuestions() {
        try {
            const response = await fetch(`${API_BASE}/survey/questions/${scaleType}`);
            const result = await response.json();
            if (result.success) {
                questions = result.data.questions;
                totalQuestions = result.data.total;
                surveyTitle.textContent = '问卷筛查';
                surveySubtitle.textContent = result.data.scale_name;
                
                // 初始化答案数组
                answers = new Array(totalQuestions).fill(null);
                
                // 隐藏加载，显示题目
                loadingArea.style.display = 'none';
                questionArea.style.display = 'block';
                
                renderCurrentQuestion();
            }
        } catch (error) {
            console.error('获取题目失败:', error);
            loadingArea.innerHTML = '<p style="color: #C06060;">加载失败，请刷新重试</p>';
        }
    }
    
    function updateProgressUI() {
        progressText.innerHTML = `<i class="far fa-question-circle"></i> 第 ${currentIndex + 1} / ${totalQuestions} 题`;
    }
    
    function renderCurrentQuestion() {
        if (!questions.length) return;
        
        const question = questions[currentIndex];
        const currentVal = answers[currentIndex];
        
        let optionsHtml = '';
        yesNoOptions.forEach(opt => {
            const isSelected = (currentVal === opt.value);
            optionsHtml += `
                <div class="option-btn ${isSelected ? 'selected' : ''}" data-val="${opt.value}">
                    <span class="option-main">${opt.main}</span>
                    <span class="option-sub">${opt.sub}</span>
                </div>
            `;
        });
        
        const html = `
            <div class="question-card">
                <div class="question-number">问题 ${currentIndex + 1} / ${totalQuestions}</div>
                <div class="question-text">${question.text}</div>
                <div class="options-group" id="optionsGroup">
                    ${optionsHtml}
                </div>
            </div>
            <div class="nav-buttons">
                ${currentIndex > 0 ? `<button class="nav-btn secondary" id="prevBtn"><i class="fas fa-arrow-left"></i> 上一题</button>` : ''}
                <button class="nav-btn primary" id="nextBtn">${currentIndex === totalQuestions - 1 ? '完成并查看结果' : '下一题'} <i class="fas fa-arrow-right"></i></button>
            </div>
        `;
        
        questionArea.innerHTML = html;
        updateProgressUI();
        surveyMain.scrollTop = 0;
        
        // 绑定选项事件
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseInt(btn.dataset.val);
                document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                answers[currentIndex] = val;
                const nextBtn = document.getElementById('nextBtn');
                if (nextBtn) nextBtn.disabled = false;
            });
        });
        
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.disabled = (answers[currentIndex] === null);
            nextBtn.addEventListener('click', () => {
                if (answers[currentIndex] === null) {
                    showToast('请选择一个选项再继续～', '#FCE8E8');
                    return;
                }
                if (currentIndex === totalQuestions - 1) {
                    submitAndAnalyze();
                } else {
                    currentIndex++;
                    renderCurrentQuestion();
                }
            });
        }
        
        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentIndex > 0) {
                    currentIndex--;
                    renderCurrentQuestion();
                }
            });
        }
    }
    
    async function submitAndAnalyze() {
        // 显示AI加载界面
        questionArea.style.display = 'none';
        aiLoadingArea.style.display = 'block';
        progressText.innerHTML = `<i class="fas fa-robot"></i> AI分析中...`;
        
        try {
            const response = await fetch(`${API_BASE}/ai/survey-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    child_id: childId,
                    scale_type: scaleType,
                    answers: answers
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                renderResultPage(result.data);
            } else {
                showToast(result.message || '分析失败', '#FCE8E8');
                aiLoadingArea.style.display = 'none';
                questionArea.style.display = 'block';
            }
        } catch (error) {
            console.error('AI分析失败:', error);
            showToast('网络错误，请稍后重试', '#FCE8E8');
            aiLoadingArea.style.display = 'none';
            questionArea.style.display = 'block';
        }
    }
    
    function renderResultPage(data) {
        aiLoadingArea.style.display = 'none';
        resultArea.style.display = 'block';
        progressText.innerHTML = `<i class="fas fa-check-circle"></i> 分析完成`;
        
        const riskClass = data.risk_level === '低风险' ? 'risk-low' : 
                         (data.risk_level === '中风险' ? 'risk-medium' : 'risk-high');
        
        // 构建维度图表
        let dimensionsHtml = '';
        if (data.dimension_scores) {
            Object.entries(data.dimension_scores).forEach(([key, dim]) => {
                dimensionsHtml += `
                    <div class="dimension-item">
                        <div class="dimension-name">${dim.name}</div>
                        <div class="dimension-score">${dim.score}</div>
                        <div class="dimension-max">/ ${dim.max} 分</div>
                    </div>
                `;
            });
        }
        
        // 解析AI分析（支持Markdown简单转换）
        let aiAnalysisHtml = data.ai_analysis || '分析报告生成中...';
        aiAnalysisHtml = aiAnalysisHtml
            .replace(/## 🌟 整体评估/g, '<h2>🌟 整体评估</h2>')
            .replace(/## 📊 能力维度分析/g, '<h2>📊 能力维度分析</h2>')
            .replace(/### ✅ 优势领域/g, '<h3>✅ 优势领域</h3>')
            .replace(/### 🌱 需要关注的领域/g, '<h3>🌱 需要关注的领域</h3>')
            .replace(/## 💡 家庭陪伴建议/g, '<h2>💡 家庭陪伴建议</h2>')
            .replace(/### 本周可以尝试的3个小游戏/g, '<h3>🎮 本周可以尝试的3个小游戏</h3>')
            .replace(/### 日常互动小贴士/g, '<h3>📝 日常互动小贴士</h3>')
            .replace(/## 🏥 专业支持建议/g, '<h2>🏥 专业支持建议</h2>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/- /g, '• ');
        
        const html = `
            <div class="ai-report">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div class="risk-badge ${riskClass}">${data.risk_level}</div>
                    <div style="font-size: 36px; font-weight: 800; color: #5E422C;">
                        ${data.total_score} <span style="font-size: 18px; color: #B89A78;">/ ${data.max_score} 分</span>
                    </div>
                    <p style="color: #9B846C; margin-top: 8px;">
                        ${data.scale_name} · ${data.child_name} · ${data.age_months}个月
                    </p>
                </div>
                
                ${dimensionsHtml ? `
                <div class="dimension-chart">
                    ${dimensionsHtml}
                </div>
                ` : ''}
                
                <div class="ai-analysis-content">
                    ${aiAnalysisHtml.split('\n').map(line => {
                        if (line.startsWith('•')) return `<li>${line.substring(1)}</li>`;
                        return `<p>${line}</p>`;
                    }).join('')}
                </div>
                
                <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #F0E5DA; font-size: 12px; color: #B89A78; text-align: center;">
                    <i class="fas fa-robot"></i> 本报告由AI生成，仅供家庭参考，不能替代专业医疗诊断
                </div>
            </div>
            
            <div class="action-buttons">
                <button class="action-btn secondary" id="restartBtn">
                    <i class="fas fa-redo-alt"></i> 重新筛查
                </button>
                <button class="action-btn primary" id="homeBtn">
                    <i class="fas fa-home"></i> 返回首页
                </button>
            </div>
        `;
        
        resultArea.innerHTML = html;
        surveyMain.scrollTop = 0;
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            window.location.href = `survey-select.html?childId=${childId}`;
        });
        
        document.getElementById('homeBtn').addEventListener('click', () => {
            window.location.href = 'mainPart.html';
        });
    }
    
    // 底部导航
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const to = item.dataset.nav;
            if (to === 'home') location.href = 'mainPart.html';
            else if (to === 'dashboard') location.href = 'dataLook.html';
            else if (to === 'treehole') location.href = 'seniorHole.html';
            else if (to === 'survey') location.href = 'survey-select.html';
        });
    });
    
    // 初始化
    async function init() {
        await fetchScaleInfo();
        await fetchQuestions();
    }
    
    init();
})();