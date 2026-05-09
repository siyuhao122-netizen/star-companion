(function () {
    const API_BASE = 'http://localhost:5000/api';
    
    let childrenData = [];
    let currentChildId = null;
    let currentUserId = null;
    
    const gameMeta = {
        name: { title: '叫名反应', insight: '平均反应时间缩短0.3s', encourage: '宝贝最近叫名反应越来越快！比上周进步12% ✨', analysisDesc: '反应速度提升27%，社交回应频率显著增加，建议每日保持训练。' },
        point: { title: '指物练习', insight: '主动指认准确率提升15%', encourage: '指物练习正确率稳步提高，共同注意能力明显增强！', analysisDesc: '主动指认正确率提升至75%，共同注意能力增强，可加入更多物品指认。' },
        mic: { title: '声音小话筒', insight: '发声频率提升42%', encourage: '声音模仿越来越积极，语言意愿明显增强！', analysisDesc: '发声频率与模仿意愿上升，58.3%正确率，多玩声音模仿游戏促进语言。' }
    };

    let currentCount = 7;
    let currentGame = 'point';
    let trendChart;
    let pointGameRecords = [];
    let nameReactionRecords = [];   
let voiceGameRecords = [];      
    let isLoading = false;

    // DOM 元素
    const childInfoCard = document.getElementById('childInfoCard');
    const childDropdown = document.getElementById('childDropdown');
    const currentChildName = document.getElementById('currentChildName');
    const currentChildAge = document.getElementById('currentChildAge');
    const currentChildAvatar = document.getElementById('currentChildAvatar');
    const childList = document.getElementById('childList');
    const ctx = document.getElementById('trendChart').getContext('2d');

    // ========== 初始化 ==========
    async function init() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        currentUserId = user.id;
        
        if (!currentUserId) {
            showToast('请先登录');
            setTimeout(() => { location.href = 'sign-inANDsign-up.html'; }, 1500);
            return;
        }
        
        await loadChildren();
        
        // ✅ 关键：初始化时并行加载所有三种训练数据
        await Promise.all([
            loadPointGameData(currentCount, false),
            loadNameReactionData(currentCount),
            loadVoiceGameData(currentCount)
        ]);
        
        setDefaultActiveGame();
        setupEventListeners();
    }

    // ========== 叫名反应详情弹窗 ==========
// ========== 叫名反应详情弹窗 ==========
async function showNameDetail(recordId) {
    const modal = document.getElementById('detailModal');
    document.querySelector('.modal-title').innerHTML = '<i class="fas fa-ear-deaf"></i> 叫名反应 · 详细数据';
    
    // 1. 先获取数据
    let record = null;
    try {
        const response = await fetch(`${API_BASE}/name-reaction-ai/records/${currentChildId}?limit=50`);
        const result = await response.json();
        const records = result.success ? (result.data.records || []) : [];
        record = records.find(r => r.id === recordId);
    } catch (e) { console.error('获取详情失败:', e); }
    
    if (!record) { showToast('记录不存在'); return; }
    
    const child = childrenData.find(c => c.id === currentChildId);
    document.getElementById('modalSubtitle').innerHTML = 
        `${record.session_date} · ${child ? child.name : '宝贝'} · ${child ? calculateAge(child.birth_date) : ''}`;
    
    const successRate = ((record.success_count / record.round_total) * 100).toFixed(1);
    
    document.getElementById('modalStatsGrid').innerHTML = `
        <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-bullseye"></i></div><div class="stat-content"><div class="stat-label-sm">正确率</div><div class="stat-value-sm">${successRate}%</div></div></div>
        <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-check-circle"></i></div><div class="stat-content"><div class="stat-label-sm">成功/总轮数</div><div class="stat-value-sm">${record.success_count}/${record.round_total}</div></div></div>
        <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-clock"></i></div><div class="stat-content"><div class="stat-label-sm">平均反应时间</div><div class="stat-value-sm">${record.avg_reaction_time || 0}秒</div></div></div>
    `;
    
    // 2. 先显示弹窗，AI分析区域显示"分析中"
    document.getElementById('modalRates').innerHTML = '';
    
    const existingAiDiv = document.getElementById('modalAiAnalysis');
    if (existingAiDiv) existingAiDiv.remove();
    
    const aiDiv = document.createElement('div');
    aiDiv.id = 'modalAiAnalysis';
    aiDiv.style.cssText = 'margin-top:16px;background:linear-gradient(135deg,#FCF8F0,#F8EFE4);border-radius:20px;padding:16px 20px;border-left:4px solid #D9A066;';
    aiDiv.innerHTML = `
        <h4 style="font-size:14px;font-weight:700;color:#6C4F32;margin-bottom:8px;"><i class="fas fa-robot" style="color:#D9A066;"></i> AI智能分析</h4>
        <div style="font-size:13px;line-height:1.7;color:#B89A78;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-spinner fa-spin" style="color:#D9A066;"></i> 🤖 AI正在分析中，请稍候...
        </div>
    `;
    document.getElementById('modalRates').appendChild(aiDiv);
    
    modal.classList.add('show');
    
    // 3. 如果已有缓存AI分析，直接显示
    if (record.ai_analysis) {
        aiDiv.querySelector('div:last-child').innerHTML = record.ai_analysis;
        aiDiv.querySelector('div:last-child').style.color = '#5E422C';
        return;
    }
    
    // 4. 没有缓存，异步获取AI分析
    try {
        const aiResponse = await fetch(`${API_BASE}/name-reaction-ai/single-analysis`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ child_id: currentChildId, record_id: recordId })
        });
        const aiResult = await aiResponse.json();
        
        if (aiResult.success && aiResult.data.ai_analysis) {
            aiDiv.querySelector('div:last-child').innerHTML = aiResult.data.ai_analysis;
            aiDiv.querySelector('div:last-child').style.color = '#5E422C';
        } else {
            aiDiv.querySelector('div:last-child').innerHTML = '✨ 本次训练完成，继续加油哦！';
            aiDiv.querySelector('div:last-child').style.color = '#5E422C';
        }
    } catch (e) {
        aiDiv.querySelector('div:last-child').innerHTML = '✨ AI暂时无法分析，但宝贝表现很棒！';
        aiDiv.querySelector('div:last-child').style.color = '#5E422C';
    }
}

// ========== 声音小话筒详情弹窗 ==========
async function showMicDetail(recordId) {
    const modal = document.getElementById('detailModal');
    document.querySelector('.modal-title').innerHTML = '<i class="fas fa-microphone-alt"></i> 声音小话筒 · 详细数据';
    
    // 1. 先获取数据
    let record = null;
    try {
        const response = await fetch(`${API_BASE}/voice-game-ai/records/${currentChildId}?limit=50`);
        const result = await response.json();
        const records = result.success ? (result.data.records || []) : [];
        record = records.find(r => r.id === recordId);
    } catch (e) { console.error('获取详情失败:', e); }
    
    if (!record) { showToast('记录不存在'); return; }
    
    const child = childrenData.find(c => c.id === currentChildId);
    document.getElementById('modalSubtitle').innerHTML = 
        `${record.session_date} · ${child ? child.name : '宝贝'} · ${child ? calculateAge(child.birth_date) : ''}`;
    
    const successRate = record.completed_rounds > 0 
        ? ((record.success_count / record.completed_rounds) * 100).toFixed(1) 
        : '0';
    const completionRate = ((record.completed_rounds / record.round_total) * 100).toFixed(1);
    
    document.getElementById('modalStatsGrid').innerHTML = `
        <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-bullseye"></i></div><div class="stat-content"><div class="stat-label-sm">发音成功率</div><div class="stat-value-sm">${successRate}%</div></div></div>
        <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-check-circle"></i></div><div class="stat-content"><div class="stat-label-sm">成功/完成轮数</div><div class="stat-value-sm">${record.success_count}/${record.completed_rounds || 0}</div></div></div>
        <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-tasks"></i></div><div class="stat-content"><div class="stat-label-sm">完成率</div><div class="stat-value-sm">${record.completed_rounds || 0}/${record.round_total} (${completionRate}%)</div></div></div>
    `;
    
    // 2. 先显示弹窗，AI分析区域显示"分析中"
    document.getElementById('modalRates').innerHTML = '';
    
    const existingAiDiv = document.getElementById('modalAiAnalysis');
    if (existingAiDiv) existingAiDiv.remove();
    
    const aiDiv = document.createElement('div');
    aiDiv.id = 'modalAiAnalysis';
    aiDiv.style.cssText = 'margin-top:16px;background:linear-gradient(135deg,#FCF8F0,#F8EFE4);border-radius:20px;padding:16px 20px;border-left:4px solid #D9A066;';
    aiDiv.innerHTML = `
        <h4 style="font-size:14px;font-weight:700;color:#6C4F32;margin-bottom:8px;"><i class="fas fa-robot" style="color:#D9A066;"></i> AI智能分析</h4>
        <div style="font-size:13px;line-height:1.7;color:#B89A78;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-spinner fa-spin" style="color:#D9A066;"></i> 🤖 AI正在分析中，请稍候...
        </div>
    `;
    document.getElementById('modalRates').appendChild(aiDiv);
    
    modal.classList.add('show');
    
    // 3. 如果已有缓存AI分析，直接显示
    if (record.ai_analysis) {
        aiDiv.querySelector('div:last-child').innerHTML = record.ai_analysis;
        aiDiv.querySelector('div:last-child').style.color = '#5E422C';
        return;
    }
    
    // 4. 没有缓存，异步获取AI分析
    try {
        const aiResponse = await fetch(`${API_BASE}/voice-game-ai/single-analysis`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ child_id: currentChildId, record_id: recordId })
        });
        const aiResult = await aiResponse.json();
        
        if (aiResult.success && aiResult.data.ai_analysis) {
            aiDiv.querySelector('div:last-child').innerHTML = aiResult.data.ai_analysis;
            aiDiv.querySelector('div:last-child').style.color = '#5E422C';
        } else {
            aiDiv.querySelector('div:last-child').innerHTML = '🎤 宝贝的发声练习很棒，继续坚持！';
            aiDiv.querySelector('div:last-child').style.color = '#5E422C';
        }
    } catch (e) {
        aiDiv.querySelector('div:last-child').innerHTML = '🎤 AI暂时无法分析，但宝贝表现很棒！';
        aiDiv.querySelector('div:last-child').style.color = '#5E422C';
    }
}

function setDefaultActiveGame() {
    currentGame = 'name';
    
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.analysis === 'name');
    });
    document.querySelectorAll('.chart-switch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.chart === 'name');
    });
    
    document.getElementById('analysisTitle').textContent = gameMeta.name.title;
    
    // ✅ 关键：必须调用渲染函数（无论有没有数据）
    renderNameTrendChart(nameReactionRecords);
    updateAnalysisForName(nameReactionRecords);
    
    bindGameCardClick();
}

function updateAnalysisForName(records) {
    if (records.length > 0) {
        const latest = records[0];
        document.getElementById('analysisDesc').textContent = 
            `最近训练：正确率${latest.accuracy || 0}%，平均反应${latest.avg_reaction_time || 0}秒`;
        document.getElementById('chartInsight').innerHTML = 
            `<i class="fas fa-brain"></i> 正确率${latest.accuracy || 0}% · 平均${latest.avg_reaction_time || 0}秒`;
        document.getElementById('chartEncourage').innerHTML = 
            `<i class="fas fa-leaf"></i> ${generateNameEncourage(records)}`;
        document.getElementById('chartRangeTitle').innerHTML = `近${records.length}次趋势`;
    } else {
        document.getElementById('analysisDesc').textContent = '完成训练后查看分析';
        document.getElementById('chartInsight').innerHTML = '<i class="fas fa-brain"></i> 暂无数据';
        document.getElementById('chartEncourage').innerHTML = '<i class="fas fa-leaf"></i> 完成第一次训练后显示 ✨';
        document.getElementById('chartRangeTitle').innerHTML = '暂无数据';
    }
}
    // ========== 绑定游戏卡片点击事件 ==========
    function bindGameCardClick() {
        const nameCard = document.querySelector('.metric-card[data-game="name"]');
        if (nameCard) {
            nameCard.removeEventListener('click', handleNameCardClick);
            nameCard.addEventListener('click', handleNameCardClick);
        }
        
        const pointCard = document.querySelector('.metric-card[data-game="point"]');
        if (pointCard) {
            pointCard.removeEventListener('click', handlePointCardClick);
            pointCard.addEventListener('click', handlePointCardClick);
        }
        
        const micCard = document.querySelector('.metric-card[data-game="mic"]');
        if (micCard) {
            micCard.removeEventListener('click', handleMicCardClick);
            micCard.addEventListener('click', handleMicCardClick);
        }
    }

    function handleNameCardClick() { switchGame('name'); }
    function handlePointCardClick() { switchGame('point'); }
    function handleMicCardClick() { switchGame('mic'); }

    // ========== 加载孩子列表 ==========
    async function loadChildren() {
        try {
            const response = await fetch(`${API_BASE}/child/list/${currentUserId}`);
            const result = await response.json();
            
            if (result.success && result.data.length > 0) {
                childrenData = result.data;
                
                const activeChild = childrenData.find(c => c.is_active);
                currentChildId = activeChild ? activeChild.id : childrenData[0].id;
                
                renderChildList();
                updateCurrentChildDisplay();
            }
        } catch (error) {
            console.error('加载孩子列表失败:', error);
        }
    }

    // ========== 更新当前孩子显示 ==========
    function updateCurrentChildDisplay() {
        const child = childrenData.find(c => c.id === currentChildId);
        if (!child) return;
        
        currentChildName.textContent = child.name;
        currentChildAge.textContent = calculateAge(child.birth_date);
        
        const avatarContainer = currentChildAvatar;
        avatarContainer.innerHTML = '';
        if (child.avatar_type === 'custom' && child.avatar) {
            const img = document.createElement('img');
            img.src = child.avatar;
            img.style.cssText = 'width:40px;height:40px;border-radius:32px;object-fit:cover;';
            avatarContainer.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className = `fas ${child.avatar || 'fa-face-smile'}`;
            avatarContainer.appendChild(icon);
        }
    }

    function calculateAge(birthDateStr) {
        if (!birthDateStr) return '';
        const birth = new Date(birthDateStr);
        const today = new Date();
        const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
        if (months < 12) return months + '个月';
        return Math.floor(months / 12) + '岁';
    }

    // ========== 渲染孩子列表 ==========
    function renderChildList() {
        childList.innerHTML = '';
        childrenData.forEach(child => {
            const li = document.createElement('li');
            li.className = `child-list-item ${child.id === currentChildId ? 'active' : ''}`;
            li.setAttribute('data-child-id', child.id);
            
            let avatarHtml = '';
            if (child.avatar_type === 'custom' && child.avatar) {
                avatarHtml = `<img src="${child.avatar}" style="width:36px;height:36px;border-radius:24px;object-fit:cover;">`;
            } else {
                avatarHtml = `<i class="fas ${child.avatar || 'fa-face-smile'}"></i>`;
            }
            
            li.innerHTML = `
                <div class="list-avatar">${avatarHtml}</div>
                <div class="list-info">
                    <div class="list-name">${child.name}</div>
                    <div class="list-age">${calculateAge(child.birth_date)}</div>
                </div>
                ${child.id === currentChildId ? '<i class="fas fa-check-circle active-indicator"></i>' : ''}
            `;
            
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                if (child.id !== currentChildId) switchChild(child.id);
            });
            
            childList.appendChild(li);
        });
    }

    // ========== 切换孩子 ==========
    async function switchChild(childId) {
        try {
            await fetch(`${API_BASE}/child/switch/${childId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUserId })
            });
            
            currentChildId = childId;
            localStorage.setItem('starCompanionActiveChild', childId);
            
            updateCurrentChildDisplay();
            renderChildList();
            
            // ✅ 切换后加载三种数据
            await Promise.all([
                loadPointGameData(currentCount, false),
                loadNameReactionData(currentCount),
                loadVoiceGameData(currentCount)
            ]);
            
            const child = childrenData.find(c => c.id === childId);
            if (child) showToast(`✨ 已切换到${child.name}宝贝`);
        } catch (error) {
            console.error('切换失败:', error);
        }
    }

    function switchGame(game) {
        if (currentGame === game || isLoading) return;
        
        currentGame = game;
        
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.analysis === game);
        });
        document.querySelectorAll('.chart-switch-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.chart === game);
        });
        
        document.getElementById('analysisTitle').textContent = gameMeta[game]?.title || '';
        
        if (game === 'point') {
            loadPointGameData(currentCount, false);
        } else if (game === 'name') {
            loadNameReactionData(currentCount);
        } else if (game === 'mic') {
            loadVoiceGameData(currentCount);
        }
        
        setTimeout(bindGameCardClick, 100);
    }

    // ========== 核心：加载指物练习数据 ==========
    async function loadPointGameData(count, callAI = false) {
        if (!currentChildId || isLoading) return;
        
        isLoading = true;
        
        try {
            const endpoint = callAI 
                ? `${API_BASE}/point-game-ai/trend-analysis/${currentChildId}?limit=${count}`
                : `${API_BASE}/point-game-ai/point-records/${currentChildId}?limit=${count}`;
            
            const response = await fetch(endpoint);
            const result = await response.json();
            
            if (result.success && result.data) {
                pointGameRecords = result.data.records || [];
                
                updatePointMetrics(pointGameRecords);
                renderTrendChart(pointGameRecords);
                updateGameCard(pointGameRecords);
                
                if (callAI && result.data.ai_analysis) {
                    document.getElementById('analysisDesc').textContent = 
                        result.data.ai_analysis.substring(0, 100) + '...';
                } else if (!callAI) {
                    if (pointGameRecords.length > 0) {
                        const latest = pointGameRecords[0];
                        document.getElementById('analysisDesc').textContent = 
                            `最近训练：正确率${latest.accuracy || 0}%，点击准确率${latest.click_accuracy || 0}%，平均${latest.avg_time_sec || 0}秒/轮`;
                    } else {
                        document.getElementById('analysisDesc').textContent = '完成训练后查看分析';
                    }
                }
                
                document.getElementById('chartInsight').innerHTML = 
                    `<i class="fas fa-brain"></i> ${generateInsight(pointGameRecords)}`;
                document.getElementById('chartEncourage').innerHTML = 
                    `<i class="fas fa-leaf"></i> ${generateEncourage(pointGameRecords)}`;
                document.getElementById('chartRangeTitle').innerHTML = 
                    `近${pointGameRecords.length}次趋势`;
                
            } else {
                showEmptyPointData();
            }
        } catch (error) {
            console.error('加载指物练习数据失败:', error);
        }
        
        isLoading = false;
    }

    // ========== 更新指物练习指标卡片 ==========
    function updatePointMetrics(records) {
        if (records.length === 0) {
            document.getElementById('metricPoint').textContent = '—';
            document.getElementById('trendPoint').innerHTML = '<i class="fas fa-minus"></i> 暂无数据';
            return;
        }
        
        const latest = records[0];
        const latestRate = latest.accuracy || 0;
        
        document.getElementById('metricPoint').textContent = latestRate + '%';
        
        if (records.length >= 2) {
            const previousRecords = records.slice(1);
            const prevAvgRate = previousRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / previousRecords.length;
            const diff = (latestRate - prevAvgRate).toFixed(1);
            const trendIcon = diff >= 0 ? 'up' : 'down';
            const trendText = diff >= 0 ? `+${diff}%` : `${diff}%`;
            const compareText = records.length > 2 ? `近${previousRecords.length}次平均` : '上次';
            document.getElementById('trendPoint').innerHTML = 
                `<i class="fas fa-arrow-${trendIcon}"></i> ${trendText}（vs ${compareText}）`;
        } else {
            document.getElementById('trendPoint').innerHTML = '<i class="fas fa-minus"></i> 首次训练';
        }
    }

    function generateEncourage(records) {
        if (records.length === 0) return '完成第一次训练后，这里会出现分析报告 ✨';
        
        if (records.length >= 2) {
            const latest = records[0];
            const previousRecords = records.slice(1);
            const latestRate = latest.accuracy || 0;
            const prevAvgRate = previousRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / previousRecords.length;
            
            if (latestRate > prevAvgRate) {
                return `最新正确率${latestRate}%，高于前${previousRecords.length}次平均${prevAvgRate.toFixed(1)}%，进步明显 ✨`;
            } else if (latestRate === prevAvgRate) {
                return `正确率保持在${latestRate}%，和前${previousRecords.length}次持平，表现稳定`;
            } else {
                return `最新正确率${latestRate}%，略有波动，继续加油就会回升 🌱`;
            }
        }
        
        const latest = records[0];
        const rate = latest.accuracy || 0;
        if (rate >= 80) return `首次训练正确率达到${rate}%，开局不错 🎉`;
        if (rate >= 60) return `首次训练正确率${rate}%，不错的开始 💪`;
        return `第一次训练完成，坚持练习会越来越好 🌟`;
    }

    function generateInsight(records) {
        if (records.length === 0) return '完成训练后查看分析';
        
        const latest = records[0];
        const accuracy = latest.accuracy || 0;
        const clickAccuracy = latest.click_accuracy || 0;
        const avgTime = latest.avg_time_sec || 0;
        
        return `轮次正确率${accuracy}% · 点击准确率${clickAccuracy}% · 平均${avgTime}秒/轮`;
    }

    function renderTrendChart(records) {
        if (trendChart) trendChart.destroy();
        
        if (records.length === 0) {
            trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['暂无数据'],
                    datasets: [{
                        label: '正确率 (%)', data: [0],
                        borderColor: '#CFA276', backgroundColor: '#CFA27620',
                        tension: 0.3, fill: true,
                        pointBackgroundColor: '#CFA276', pointBorderColor: '#FFF',
                        pointBorderWidth: 2, pointRadius: 4
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { min: 0, max: 100, grid: { color: '#F0E6DC' } },
                        x: { grid: { display: false } }
                    }
                }
            });
            return;
        }
        
        const reversed = [...records].reverse();
        const labels = reversed.map((r, i) => `第${i + 1}次`);
        const rates = reversed.map(r => r.accuracy || 0);
        
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '正确率 (%)', data: rates,
                    borderColor: '#9BBF7A', backgroundColor: '#9BBF7A20',
                    tension: 0.3, fill: true,
                    pointBackgroundColor: '#9BBF7A', pointBorderColor: '#FFF',
                    pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const record = records[records.length - 1 - ctx.dataIndex];
                                if (!record) return `${ctx.raw}%`;
                                return [
                                    `正确率: ${ctx.raw}%`,
                                    `点击准确率: ${record.click_accuracy || 0}%`,
                                    `平均用时: ${record.avg_time_sec || 0}秒`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: { min: 0, max: 100, grid: { color: '#F0E6DC' }, title: { display: true, text: '正确率 (%)', font: { size: 11 } } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function updateGameCard(records) {
        if (records.length === 0) {
            document.querySelector('#pointStats .game-rate').textContent = '暂无数据';
            document.querySelector('#pointStats .game-compare').innerHTML = '完成训练后显示';
            document.getElementById('pointHistoryList').innerHTML = `
                <div style="text-align:center; padding:20px; color:#B89A78;">
                    <i class="fas fa-clipboard-list" style="font-size:32px; margin-bottom:8px;"></i>
                    <p>还没有训练记录</p>
                </div>
            `;
            return;
        }
        
        const latest = records[0];
        const latestRate = latest.accuracy || 0;
        
        document.querySelector('#pointStats .game-rate').textContent = 
            `${latest.correct_rounds}/${latest.round_total} (${latestRate}%)`;
        
        if (records.length >= 2) {
            const previousRecords = records.slice(1);
            const prevAvgRate = previousRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / previousRecords.length;
            const diff = latestRate >= prevAvgRate ? 'up' : 'down';
            const text = latestRate >= prevAvgRate ? '进步' : '退步';
            document.querySelector('#pointStats .game-compare').innerHTML = 
                `前${previousRecords.length}次均 ${prevAvgRate.toFixed(1)}% <i class="fas fa-arrow-${diff}"></i> ${text}`;
        } else {
            document.querySelector('#pointStats .game-compare').innerHTML = '首次训练';
        }
        
        let historyHtml = '';
        records.forEach((r) => {
            const dateStr = r.session_date || '未知日期';
            historyHtml += `
                <div class="history-row">
                    <span class="history-date"><i class="far fa-calendar-alt"></i> ${dateStr}</span>
                    <span class="history-rate">正确率：${r.correct_rounds}/${r.round_total} (${r.accuracy || 0}%)</span>
                    <span class="history-detail">点击准确率 ${r.click_accuracy || 0}% · ${r.avg_time_sec || 0}秒</span>
                    <button class="detail-btn" data-record-id="${r.id}"><i class="fas fa-chart-simple"></i> 详情</button>
                </div>
            `;
        });
        document.getElementById('pointHistoryList').innerHTML = historyHtml;

        document.querySelectorAll('#pointHistoryList .detail-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const recordId = parseInt(this.dataset.recordId);
                if (recordId) showPointDetail(recordId);
            });
        });

        // 更新鼓励语
        let encourageText = '';
        if (records.length >= 2) {
            const prevAvg = records.slice(1).reduce((s, r) => s + (r.accuracy || 0), 0) / (records.length - 1);
            if (latestRate > prevAvg) encourageText = `最新正确率${latestRate}%，比前${records.length-1}次平均提高了${(latestRate - prevAvg).toFixed(1)}个百分点，进步明显 ✨`;
            else if (latestRate < prevAvg) encourageText = `最新正确率${latestRate}%，略有波动，继续坚持就会回升 🌱`;
            else encourageText = `正确率稳定在${latestRate}%，保持得很好 💪`;
        } else {
            encourageText = `首次训练正确率${latestRate}%，是个很好的开始 🌟`;
        }
        document.querySelector('#pointCard .game-encourage').innerHTML = `<i class="fas fa-hand-peace"></i> ${encourageText}`;
    }

    function showEmptyPointData() {
        document.getElementById('metricPoint').textContent = '—';
        document.getElementById('trendPoint').innerHTML = '<i class="fas fa-minus"></i> 暂无数据';
        document.getElementById('analysisDesc').textContent = '完成训练后查看分析';
        document.getElementById('chartInsight').innerHTML = '<i class="fas fa-brain"></i> 等待训练数据';
        document.getElementById('chartEncourage').innerHTML = '<i class="fas fa-leaf"></i> 完成第一次训练后，这里会出现分析报告 ✨';
        document.getElementById('chartRangeTitle').innerHTML = '暂无数据';
        
        document.querySelector('#pointStats .game-rate').textContent = '暂无数据';
        document.querySelector('#pointStats .game-compare').innerHTML = '完成训练后显示';
        document.getElementById('pointHistoryList').innerHTML = `
            <div style="text-align:center; padding:20px; color:#B89A78;">
                <i class="fas fa-clipboard-list" style="font-size:32px; margin-bottom:8px;"></i>
                <p>还没有训练记录</p>
            </div>
        `;
        
        if (trendChart) trendChart.destroy();
        trendChart = new Chart(ctx, {
            type: 'line',
            data: { labels: ['暂无数据'], datasets: [{ label: '正确率 (%)', data: [0], borderColor: '#9BBF7A', backgroundColor: '#9BBF7A20' }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 }, x: { grid: { display: false } } } }
        });
    }

    // ========== 查看详情 ==========
    async function showPointDetail(recordId) {
        let record = pointGameRecords.find(r => r.id === recordId);
        
        if (!record) {
            try {
                const response = await fetch(`${API_BASE}/point-game-ai/point-records/${currentChildId}?limit=50`);
                const result = await response.json();
                if (result.success && result.data.records) {
                    record = result.data.records.find(r => r.id === recordId);
                }
            } catch (e) { console.error('获取记录详情失败:', e); }
        }
        
        if (!record) { showToast('记录不存在'); return; }
        
        if (!record.ai_analysis) {
            try {
                const aiResponse = await fetch(`${API_BASE}/point-game-ai/single-analysis`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ child_id: currentChildId, record_id: recordId })
                });
                const aiResult = await aiResponse.json();
                if (aiResult.success && aiResult.data.ai_analysis) {
                    record.ai_analysis = aiResult.data.ai_analysis;
                }
            } catch (e) { console.error('获取AI分析失败:', e); }
        }
        
        const modal = document.getElementById('detailModal');
        const child = childrenData.find(c => c.id === currentChildId);
        
        document.getElementById('modalSubtitle').innerHTML = 
            `${record.session_date} · ${child ? child.name : '宝贝'} · ${child ? calculateAge(child.birth_date) : ''}`;
        
        document.getElementById('modalStatsGrid').innerHTML = `
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-bullseye"></i></div><div class="stat-content"><div class="stat-label-sm">轮次正确率</div><div class="stat-value-sm">${record.accuracy || 0}%</div></div></div>
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-mouse-pointer"></i></div><div class="stat-content"><div class="stat-label-sm">点击准确率</div><div class="stat-value-sm">${record.click_accuracy || 0}%</div></div></div>
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-check-circle"></i></div><div class="stat-content"><div class="stat-label-sm">正确轮数</div><div class="stat-value-sm">${record.correct_rounds}/${record.round_total}</div></div></div>
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-times-circle"></i></div><div class="stat-content"><div class="stat-label-sm">错误轮数</div><div class="stat-value-sm">${record.wrong_rounds}</div></div></div>
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-clock"></i></div><div class="stat-content"><div class="stat-label-sm">平均用时</div><div class="stat-value-sm">${(record.avg_time_sec || 0).toFixed(1)}秒</div></div></div>
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-hourglass-end"></i></div><div class="stat-content"><div class="stat-label-sm">总用时</div><div class="stat-value-sm">${(record.total_time_sec || 0).toFixed(1)}秒</div></div></div>
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-mouse"></i></div><div class="stat-content"><div class="stat-label-sm">总点击次数</div><div class="stat-value-sm">${record.total_clicks}</div></div></div>
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-hand-pointer"></i></div><div class="stat-content"><div class="stat-label-sm">正确/错误点击</div><div class="stat-value-sm">${record.correct_clicks}/${record.wrong_clicks}</div></div></div>
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-clock"></i></div><div class="stat-content"><div class="stat-label-sm">超时次数</div><div class="stat-value-sm">${record.timeout_count}次</div></div></div>
            <div class="stat-item"><div class="stat-icon-sm"><i class="fas fa-forward"></i></div><div class="stat-content"><div class="stat-label-sm">跳过次数</div><div class="stat-value-sm">${record.skip_count}次</div></div></div>
        `;
        
        let roundDetailsHtml = '';
        if (record.round_details && Array.isArray(record.round_details)) {
            roundDetailsHtml = `
                <div style="margin-top: 12px;">
                    <h4 style="font-size: 14px; font-weight: 700; color: #6C4F32; margin-bottom: 8px;">
                        <i class="fas fa-list-ol" style="color: #D9A066;"></i> 每轮详情
                    </h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${record.round_details.map((rd, i) => {
                            const isSuccess = rd.success;
                            return `
                                <div style="background: ${isSuccess ? '#E8F0D8' : '#FCE8E8'}; border: 1px solid ${isSuccess ? '#B8D4A3' : '#D4A0A0'}; border-radius: 16px; padding: 8px 12px; text-align: center; min-width: 60px;">
                                    <div style="font-size: 12px; font-weight: 600; color: #6C4F32;">第${i + 1}轮</div>
                                    <div style="font-size: 16px; font-weight: 700; color: ${isSuccess ? '#6B8C4A' : '#C06060'};">${isSuccess ? '✅' : '❌'}</div>
                                    <div style="font-size: 11px; color: #9B846C;">${rd.time_sec || 0}秒</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        document.getElementById('modalRates').innerHTML = roundDetailsHtml;
        
        if (record.ai_analysis) {
            const existingAiDiv = document.getElementById('modalAiAnalysis');
            if (existingAiDiv) existingAiDiv.remove();
            
            const aiDiv = document.createElement('div');
            aiDiv.id = 'modalAiAnalysis';
            aiDiv.style.cssText = 'margin-top:16px;background:linear-gradient(135deg,#FCF8F0,#F8EFE4);border-radius:20px;padding:16px 20px;border-left:4px solid #D9A066;';
            aiDiv.innerHTML = `
                <h4 style="font-size:14px;font-weight:700;color:#6C4F32;margin-bottom:8px;"><i class="fas fa-robot" style="color:#D9A066;"></i> AI智能分析</h4>
                <div style="font-size:13px;line-height:1.7;color:#5E422C;white-space:pre-wrap;">${record.ai_analysis}</div>
            `;
            
            const ratesDiv = document.getElementById('modalRates');
            ratesDiv.parentNode.insertBefore(aiDiv, ratesDiv.nextSibling);
        }
        
        modal.classList.add('show');
    }

async function loadNameReactionData(count) {
    if (!currentChildId) return;
    
    try {
        const response = await fetch(`${API_BASE}/name-reaction-ai/records/${currentChildId}?limit=${count}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            nameReactionRecords = result.data.records || [];  // ✅ 存到全局变量
            
            updateNameMetrics(nameReactionRecords);
            updateNameGameCard(nameReactionRecords);
            
            if (currentGame === 'name') {
                renderNameTrendChart(nameReactionRecords);
                document.getElementById('analysisDesc').textContent =
                    nameReactionRecords.length > 0
                        ? `最近训练：正确率${nameReactionRecords[0].accuracy || 0}%，平均反应${nameReactionRecords[0].avg_reaction_time || 0}秒`
                        : '完成训练后查看分析';
                document.getElementById('chartInsight').innerHTML =
                    `<i class="fas fa-brain"></i> ${generateNameInsight(nameReactionRecords)}`;
                document.getElementById('chartEncourage').innerHTML =
                    `<i class="fas fa-leaf"></i> ${generateNameEncourage(nameReactionRecords)}`;
                document.getElementById('chartRangeTitle').innerHTML = `近${nameReactionRecords.length}次趋势`;
            }
            } else {
                showEmptyNameData();
            }
        } catch (error) {
            console.error('加载叫名反应数据失败:', error);
        }
    }

    function updateNameMetrics(records) {
        if (records.length === 0) {
            document.getElementById('metricName').textContent = '—';
            document.getElementById('trendName').innerHTML = '<i class="fas fa-minus"></i> 暂无数据';
            return;
        }
        
        const latest = records[0];
        const latestRate = latest.accuracy || 0;
        document.getElementById('metricName').textContent = latestRate + '%';
        
        if (records.length >= 2) {
            const previousRecords = records.slice(1);
            const prevAvgRate = previousRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / previousRecords.length;
            const diff = (latestRate - prevAvgRate).toFixed(1);
            const trendIcon = diff >= 0 ? 'up' : 'down';
            const trendText = diff >= 0 ? `+${diff}%` : `${diff}%`;
            document.getElementById('trendName').innerHTML = 
                `<i class="fas fa-arrow-${trendIcon}"></i> ${trendText}（vs 前${previousRecords.length}次平均）`;
        } else {
            document.getElementById('trendName').innerHTML = '<i class="fas fa-minus"></i> 首次训练';
        }
    }

    function generateNameInsight(records) {
        if (records.length === 0) return '完成训练后查看分析';
        const latest = records[0];
        return `正确率${latest.accuracy || 0}% · 平均反应${latest.avg_reaction_time || 0}秒`;
    }

    function generateNameEncourage(records) {
        if (records.length === 0) return '完成第一次训练后，这里会出现分析报告 ✨';
        
        if (records.length >= 2) {
            const latest = records[0];
            const previousRecords = records.slice(1);
            const latestRate = latest.accuracy || 0;
            const prevAvgRate = previousRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / previousRecords.length;
            
            if (latestRate > prevAvgRate) return `最新正确率${latestRate}%，高于前${previousRecords.length}次平均${prevAvgRate.toFixed(1)}%，进步明显 ✨`;
            if (latestRate === prevAvgRate) return `正确率保持在${latestRate}%，表现稳定`;
            return `最新正确率${latestRate}%，略有波动，继续加油就会回升 🌱`;
        }
        
        const rate = records[0].accuracy || 0;
        if (rate >= 80) return `首次训练正确率达到${rate}%，开局不错 🎉`;
        return `第一次训练完成，坚持练习会越来越好 🌟`;
    }

    function renderNameTrendChart(records) {
        if (trendChart) trendChart.destroy();
        
        if (records.length === 0) {
            trendChart = new Chart(ctx, {
                type: 'line',
                data: { labels: ['暂无数据'], datasets: [{ label: '正确率 (%)', data: [0], borderColor: '#CFA276', backgroundColor: '#CFA27620', tension: 0.3, fill: true }] },
                options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: '#F0E6DC' } }, x: { grid: { display: false } } } }
            });
            return;
        }
        
        const reversed = [...records].reverse();
        const labels = reversed.map((r, i) => `第${i + 1}次`);
        const rates = reversed.map(r => r.accuracy || 0);
        
        trendChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{ label: '正确率 (%)', data: rates, borderColor: '#CDA87A', backgroundColor: '#CDA87A20', tension: 0.3, fill: true, pointBackgroundColor: '#CDA87A', pointBorderColor: '#FFF', pointBorderWidth: 2, pointRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: '#F0E6DC' } }, x: { grid: { display: false } } } }
        });
    }

    function updateNameGameCard(records) {
        if (records.length === 0) {
            document.querySelector('#nameStats .game-rate').textContent = '暂无数据';
            document.querySelector('#nameStats .game-compare').innerHTML = '完成训练后显示';
            document.getElementById('nameHistoryList').innerHTML = '<div style="text-align:center;padding:20px;color:#B89A78;"><i class="fas fa-clipboard-list" style="font-size:32px;margin-bottom:8px;"></i><p>还没有训练记录</p></div>';
            return;
        }
        
        const latest = records[0];
        const latestRate = latest.accuracy || 0;
        
        document.querySelector('#nameStats .game-rate').textContent = `${latest.success_count}/${latest.round_total} (${latestRate}%)`;
        
        if (records.length >= 2) {
            const previousRecords = records.slice(1);
            const prevAvgRate = previousRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / previousRecords.length;
            const diff = latestRate >= prevAvgRate ? 'up' : 'down';
            const text = latestRate >= prevAvgRate ? '进步' : '退步';
            document.querySelector('#nameStats .game-compare').innerHTML = `前${previousRecords.length}次均 ${prevAvgRate.toFixed(1)}% <i class="fas fa-arrow-${diff}"></i> ${text}`;
        } else {
            document.querySelector('#nameStats .game-compare').innerHTML = '首次训练';
        }
        
        let historyHtml = '';
        records.forEach((r) => {
            historyHtml += `
                <div class="history-row">
                    <span class="history-date"><i class="far fa-calendar-alt"></i> ${r.session_date || '未知日期'}</span>
                    <span class="history-rate">正确率：${r.success_count}/${r.round_total} (${r.accuracy || 0}%)</span>
                    <span class="history-detail">平均反应 ${r.avg_reaction_time || 0}秒</span>
                    <button class="detail-btn" data-record-id="${r.id}" onclick="event.stopPropagation();showNameDetail(${r.id})">
                        <i class="fas fa-chart-simple"></i> 详情
                    </button>
                </div>
            `;
        });
        document.getElementById('nameHistoryList').innerHTML = historyHtml;

        // 更新鼓励语
        let encourage = '';
        if (records.length >= 2) {
            const prevAvg = records.slice(1).reduce((s, r) => s + (r.accuracy || 0), 0) / (records.length - 1);
            if (latestRate > prevAvg) encourage = `最新正确率${latestRate}%，比前${records.length-1}次平均提高了${(latestRate - prevAvg).toFixed(1)}个百分点，进步明显 ✨`;
            else if (latestRate < prevAvg) encourage = `最新正确率${latestRate}%，略有波动，继续坚持就会回升 🌱`;
            else encourage = `正确率稳定在${latestRate}%，保持得很好，可以尝试增加一点挑战 💪`;
        } else {
            encourage = `首次训练正确率${latestRate}%，是个很好的开始 🌟`;
        }
        document.querySelector('#nameCard .game-encourage').innerHTML = `<i class="fas fa-chart-line"></i> ${encourage}`;
    }

    function showEmptyNameData() {
        document.getElementById('metricName').textContent = '—';
        document.getElementById('trendName').innerHTML = '<i class="fas fa-minus"></i> 暂无数据';
    }

    // ========== 加载声音小话筒数据 ==========
    async function loadVoiceGameData(count) {
        // ✅ 只检查 childId，不检查 isLoading
        if (!currentChildId) return;
        
        try {
            const response = await fetch(`${API_BASE}/voice-game-ai/records/${currentChildId}?limit=${count}`);
            const result = await response.json();
            
         if (result.success && result.data) {
    voiceGameRecords = result.data.records || [];  // ✅ 存到全局变量
                const records = result.data.records || [];
                
                updateMicMetrics(records);
                updateMicGameCard(records);
                
                if (currentGame === 'mic') {
                    renderMicTrendChart(records);
                    document.getElementById('analysisDesc').textContent = 
                        records.length > 0 
                            ? `最近训练：成功率${records[0].accuracy || 0}%，完成${records[0].completed_rounds || 0}/${records[0].round_total || 0}轮`
                            : '完成训练后查看分析';
                    document.getElementById('chartInsight').innerHTML = 
                        `<i class="fas fa-brain"></i> ${generateMicInsight(records)}`;
                    document.getElementById('chartEncourage').innerHTML = 
                        `<i class="fas fa-leaf"></i> ${generateMicEncourage(records)}`;
                    document.getElementById('chartRangeTitle').innerHTML = `近${records.length}次趋势`;
                }
            } else {
                showEmptyMicData();
            }
        } catch (error) {
            console.error('加载声音小话筒数据失败:', error);
        }
    }

    function updateMicMetrics(records) {
        if (records.length === 0) {
            document.getElementById('metricMic').textContent = '—';
            document.getElementById('trendMic').innerHTML = '<i class="fas fa-minus"></i> 暂无数据';
            return;
        }
        
        const latest = records[0];
        const latestRate = latest.accuracy || 0;
        document.getElementById('metricMic').textContent = latestRate + '%';
        
        if (records.length >= 2) {
            const previousRecords = records.slice(1);
            const prevAvgRate = previousRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / previousRecords.length;
            const diff = (latestRate - prevAvgRate).toFixed(1);
            const trendIcon = diff >= 0 ? 'up' : 'down';
            const trendText = diff >= 0 ? `+${diff}%` : `${diff}%`;
            document.getElementById('trendMic').innerHTML = 
                `<i class="fas fa-arrow-${trendIcon}"></i> ${trendText}（vs 前${previousRecords.length}次平均）`;
        } else {
            document.getElementById('trendMic').innerHTML = '<i class="fas fa-minus"></i> 首次训练';
        }
    }

    function generateMicInsight(records) {
        if (records.length === 0) return '完成训练后查看分析';
        const latest = records[0];
        return `成功率${latest.accuracy || 0}% · 完成${latest.completed_rounds || 0}/${latest.round_total || 0}轮`;
    }

    function generateMicEncourage(records) {
        if (records.length === 0) return '完成第一次训练后，这里会出现分析报告 ✨';
        
        if (records.length >= 2) {
            const latest = records[0];
            const previousRecords = records.slice(1);
            const latestRate = latest.accuracy || 0;
            const prevAvgRate = previousRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / previousRecords.length;
            
            if (latestRate > prevAvgRate) return `最新成功率${latestRate}%，高于前${previousRecords.length}次平均${prevAvgRate.toFixed(1)}%，进步明显 ✨`;
            if (latestRate === prevAvgRate) return `成功率保持在${latestRate}%，表现稳定`;
            return `最新成功率${latestRate}%，继续加油哦 🌱`;
        }
        
        const rate = records[0].accuracy || 0;
        if (rate >= 80) return `首次训练成功率达到${rate}%，很棒！🎉`;
        return `第一次训练完成，坚持练习会越来越好 🌟`;
    }

    function renderMicTrendChart(records) {
        if (trendChart) trendChart.destroy();
        
        if (records.length === 0) {
            trendChart = new Chart(ctx, {
                type: 'line',
                data: { labels: ['暂无数据'], datasets: [{ label: '成功率 (%)', data: [0], borderColor: '#B89A78', backgroundColor: '#B89A7820', tension: 0.3, fill: true }] },
                options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: '#F0E6DC' } }, x: { grid: { display: false } } } }
            });
            return;
        }
        
        const reversed = [...records].reverse();
        const labels = reversed.map((r, i) => `第${i + 1}次`);
        const rates = reversed.map(r => r.accuracy || 0);
        
        trendChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: [{ label: '成功率 (%)', data: rates, borderColor: '#B89A78', backgroundColor: '#B89A7820', tension: 0.3, fill: true, pointBackgroundColor: '#B89A78', pointBorderColor: '#FFF', pointBorderWidth: 2, pointRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, grid: { color: '#F0E6DC' } }, x: { grid: { display: false } } } }
        });
    }

    function updateMicGameCard(records) {
        if (records.length === 0) {
            document.querySelector('#micStats .game-rate').textContent = '暂无数据';
            document.querySelector('#micStats .game-compare').innerHTML = '完成训练后显示';
            document.getElementById('micHistoryList').innerHTML = '<div style="text-align:center;padding:20px;color:#B89A78;"><i class="fas fa-clipboard-list" style="font-size:32px;margin-bottom:8px;"></i><p>还没有训练记录</p></div>';
            return;
        }
        
        const latest = records[0];
        const latestRate = latest.accuracy || 0;
        
        document.querySelector('#micStats .game-rate').textContent = `${latest.success_count}/${latest.completed_rounds || latest.round_total} (${latestRate}%)`;
        
        if (records.length >= 2) {
            const previousRecords = records.slice(1);
            const prevAvgRate = previousRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / previousRecords.length;
            const diff = latestRate >= prevAvgRate ? 'up' : 'down';
            const text = latestRate >= prevAvgRate ? '进步' : '退步';
            document.querySelector('#micStats .game-compare').innerHTML = `前${previousRecords.length}次均 ${prevAvgRate.toFixed(1)}% <i class="fas fa-arrow-${diff}"></i> ${text}`;
        } else {
            document.querySelector('#micStats .game-compare').innerHTML = '首次训练';
        }
        
       let historyHtml = '';
        records.forEach((r) => {
            historyHtml += `
                <div class="history-row">
                    <span class="history-date"><i class="far fa-calendar-alt"></i> ${r.session_date || '未知日期'}</span>
                    <span class="history-rate">成功率：${r.success_count}/${r.completed_rounds || r.round_total} (${r.accuracy || 0}%)</span>
                    <span class="history-detail">完成 ${r.completed_rounds || 0}/${r.round_total || 0} 轮</span>
                    <button class="detail-btn" data-record-id="${r.id}" onclick="event.stopPropagation();showMicDetail(${r.id})">
                        <i class="fas fa-chart-simple"></i> 详情
                    </button>
                </div>
            `;
        });
        document.getElementById('micHistoryList').innerHTML = historyHtml;

        // 更新鼓励语
        let micEncourage = '';
        if (records.length >= 2) {
            const prevAvg = records.slice(1).reduce((s, r) => s + (r.accuracy || 0), 0) / (records.length - 1);
            if (latestRate > prevAvg) micEncourage = `最新成功率${latestRate}%，比前${records.length-1}次平均提高了${(latestRate - prevAvg).toFixed(1)}个百分点，进步明显 ✨`;
            else if (latestRate < prevAvg) micEncourage = `最新成功率${latestRate}%，略有波动，声音模仿需要更多时间和耐心 🌱`;
            else micEncourage = `成功率稳定在${latestRate}%，基础打得很扎实 💪`;
        } else {
            micEncourage = `首次训练成功率${latestRate}%，愿意发出声音就是很棒的开始 🌟`;
        }
        document.querySelector('#micCard .game-encourage').innerHTML = `<i class="fas fa-volume-up"></i> ${micEncourage}`;
    }

    function showEmptyMicData() {
        document.getElementById('metricMic').textContent = '—';
        document.getElementById('trendMic').innerHTML = '<i class="fas fa-minus"></i> 暂无数据';
    }

    // ========== 事件监听 ==========
    function setupEventListeners() {
        childInfoCard.addEventListener('click', toggleChildDropdown);
        document.getElementById('overlay').addEventListener('click', closeAllDropdowns);
        
        const filterBtn = document.getElementById('filterBtn');
        if (filterBtn) filterBtn.addEventListener('click', toggleFilterDropdown);
        
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const count = parseInt(this.dataset.count);
                const label = this.querySelector('span').textContent;
                selectFilter(count, label);
            });
        });
        
        document.getElementById('analysisJumpBtn').addEventListener('click', goToFullAnalysis);
        
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => switchGame(tab.dataset.analysis));
        });
        
        document.querySelectorAll('.chart-switch-btn').forEach(btn => {
            btn.addEventListener('click', () => switchGame(btn.dataset.chart));
        });
        
        bindGameCardClick();
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const nav = this.dataset.nav;
                if (nav === 'home') location.href = 'mainPart.html';
                else if (nav === 'treehole') location.href = 'seniorHole.html';
                else if (nav === 'survey') location.href = 'survey-select.html';
            });
        });

        // 导出PDF
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', toggleExportPanel);

        const confirmExportBtn = document.getElementById('confirmExportBtn');
        if (confirmExportBtn) confirmExportBtn.addEventListener('click', exportPDF);

        document.querySelectorAll('#exportPanel .checkbox-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleExportCheckbox(this);
            });
        });
    }

    function toggleChildDropdown(e) { e.stopPropagation(); childDropdown.classList.toggle('show'); document.getElementById('overlay').classList.toggle('show'); }
    function toggleFilterDropdown(e) { e.stopPropagation(); document.getElementById('dropdownMenu').classList.toggle('show'); document.getElementById('overlay').classList.toggle('show'); }
    function closeAllDropdowns() { childDropdown.classList.remove('show'); document.getElementById('dropdownMenu').classList.remove('show'); document.getElementById('exportPanel').classList.remove('show'); document.getElementById('overlay').classList.remove('show'); }

    function goToFullAnalysis() {
        if (!currentChildId) return;
        location.href = `dataAnalys.html?childId=${currentChildId}&game=point&count=${currentCount}`;
    }

    function selectFilter(count, label) {
        currentCount = count;
        document.getElementById('selectedFilterText').textContent = label;
        
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.count) === count);
        });
        
        // ✅ 切换次数时加载三种数据
        loadPointGameData(count, false);
        loadNameReactionData(count);
        loadVoiceGameData(count);
        
        closeAllDropdowns();
        showToast(`📊 已切换至${label}数据`);
    }

    function showToast(msg) {
        let t = document.querySelector('.toast-msg');
        if (t) t.remove();
        t = document.createElement('div');
        t.className = 'toast-msg';
        t.innerHTML = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 1800);
    }

    // 暴露全局函数
    window.showPointDetail = showPointDetail;
    window.showNameDetail = showNameDetail;
window.showMicDetail = showMicDetail;
    window.toggleGameCard = function(cardId) {
        const body = document.getElementById(cardId);
        const icon = document.getElementById(cardId + 'Icon');
        if (body && icon) {
            if (body.classList.contains('open')) {
                body.classList.remove('open');
                icon.className = 'fas fa-chevron-down';
            } else {
                body.classList.add('open');
                icon.className = 'fas fa-chevron-up';
            }
        }
    };
    window.closeDetailModal = function() {
        document.getElementById('detailModal').classList.remove('show');
        const aiDiv = document.getElementById('modalAiAnalysis');
        if (aiDiv) aiDiv.remove();
    };

    // ========== PDF导出功能 ==========
    function toggleExportPanel(e) {
        e.stopPropagation();
        const panel = document.getElementById('exportPanel');
        const overlay = document.getElementById('overlay');
        const isOpen = panel.classList.contains('show');
        if (isOpen) {
            panel.classList.remove('show');
            overlay.classList.remove('show');
        } else {
            closeAllDropdowns();
            panel.classList.add('show');
            overlay.classList.add('show');
        }
    }

    function toggleExportCheckbox(el) {
        const icon = el.querySelector('i');
        if (el.classList.contains('checked')) {
            el.classList.remove('checked');
            icon.className = 'far fa-square';
        } else {
            el.classList.add('checked');
            icon.className = 'far fa-check-square';
        }
    }

    // ========== PDF 导出 — 纯文字数据报告 ==========

    const GAME_CFG = {
        name:  { label: '叫名反应 · 听觉回应', endpoint: 'name-reaction-ai',  records: () => nameReactionRecords },
        point: { label: '指物练习 · 趣味指认', endpoint: 'point-game-ai',     records: () => pointGameRecords },
        mic:   { label: '声音小话筒 · 发声启蒙', endpoint: 'voice-game-ai',    records: () => voiceGameRecords }
    };

    async function fetchAIAnalysis(gameType) {
        try {
            const ep = GAME_CFG[gameType].endpoint;
            const resp = await fetch(`${API_BASE}/${ep}/trend-analysis/${currentChildId}?limit=7`);
            const d = await resp.json();
            if (d.success && d.data && d.data.ai_analysis) return d.data.ai_analysis;
        } catch (e) { console.warn('AI分析获取失败:', e); }
        return null;
    }

    // 自动换行文本，返回结束 Y 坐标
    function writeText(pdf, text, x, y, maxW, lh, fs, color) {
        pdf.setFontSize(fs || 10);
        if (color) pdf.setTextColor.apply(pdf, color);
        const lines = pdf.splitTextToSize(text, maxW);
        const ph = pdf.internal.pageSize.getHeight(), mb = 12;
        let cy = y;
        for (const l of lines) {
            if (cy + lh > ph - mb) { pdf.addPage(); cy = mb; }
            pdf.text(l, x, cy);
            cy += lh;
        }
        return cy;
    }

    // 绘制标题栏
    function drawTitleBar(pdf, title, y) {
        const PW = pdf.internal.pageSize.getWidth(), M = 12;
        pdf.setFillColor(77, 55, 36);
        pdf.rect(M, y, PW - 2 * M, 9, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(11);
        pdf.text(title, M + 3, y + 6.2);
        return y + 13;
    }

    // 绘制表格行
    function drawTableRow(pdf, cols, widths, y, isHeader) {
        const M = 12, rowH = 7;
        if (isHeader) {
            pdf.setFillColor(249, 242, 235);
            pdf.rect(M, y - 4.5, pdf.internal.pageSize.getWidth() - 2 * M, rowH, 'F');
            pdf.setFontSize(9);
            pdf.setTextColor(140, 110, 80);
        } else {
            pdf.setFontSize(9);
            pdf.setTextColor(77, 55, 36);
        }
        let x = M;
        cols.forEach((col, i) => {
            pdf.text(col, x, y);
            x += widths[i];
        });
        return y + rowH;
    }

    async function exportPDF() {
        const panel = document.getElementById('exportPanel');
        const checkedItems = panel.querySelectorAll('.checkbox-item.checked');
        if (checkedItems.length === 0) { showToast('请至少选择一个模块'); return; }

        const checkedSet = new Set();
        checkedItems.forEach(i => checkedSet.add(i.dataset.module));

        showToast('正在生成报告...');

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const PW = pdf.internal.pageSize.getWidth(), M = 12;

            const childName = (document.getElementById('currentChildName')?.textContent || '宝贝').trim();
            const childAge = (document.getElementById('currentChildAge')?.textContent || '').trim();
            const today = new Date().toISOString().slice(0, 10);

            // ===== 封面 =====
            pdf.setFillColor(77, 55, 36); pdf.rect(0, 0, PW, 24, 'F');
            pdf.setTextColor(255, 255, 255); pdf.setFontSize(17);
            pdf.text('星伴 · 数据成长报告', M, 16);
            pdf.setFontSize(25);
            pdf.text('*', PW - 20, 17);

            pdf.setTextColor(77, 55, 36);
            let y = 34;
            pdf.setFontSize(13);
            pdf.text(childName, M, y); y += 8;
            if (childAge) { pdf.setFontSize(10); pdf.text(childAge, M, y); y += 6; }
            pdf.setFontSize(10);
            pdf.text(`导出日期：${today}`, M, y); y += 6;
            pdf.text('数据范围：最近 7 次训练记录', M, y); y += 6;
            pdf.text('报告说明：本报告由星伴平台自动生成，数据来源于孩子的游戏训练记录。', M, y); y += 4;
            pdf.text('AI 分析基于循证 ASD 专业知识库，仅供参考，不构成医疗诊断。', M, y);
            y += 8;
            pdf.setDrawColor(207, 162, 118); pdf.setLineWidth(0.3);
            pdf.line(M, y, PW - M, y);

            // ===== 核心指标概览 =====
            if (checkedSet.has('overview')) {
                y += 10;
                y = drawTitleBar(pdf, '核心指标概览', y);
                y += 4;

                const games = ['name', 'point', 'mic'];
                const colW = [(PW - 2 * M) / 4, (PW - 2 * M) / 4, (PW - 2 * M) / 4, (PW - 2 * M) / 4];
                y = drawTableRow(pdf, ['训练项目', '最新正确率', '趋势', '评价'], colW, y, true);

                for (const g of games) {
                    const recs = GAME_CFG[g].records() || [];
                    if (recs.length === 0) {
                        y = drawTableRow(pdf, [GAME_CFG[g].label, '暂无数据', '—', '完成训练后显示'], colW, y);
                        continue;
                    }
                    const latest = recs[0].accuracy || 0;
                    let trend = '—', comment = '';
                    if (recs.length >= 2) {
                        const prevAvg = recs.slice(1).reduce((s, r) => s + (r.accuracy || 0), 0) / (recs.length - 1);
                        const diff = latest - prevAvg;
                        trend = diff >= 0 ? `↑ +${diff.toFixed(1)}%` : `↓ ${diff.toFixed(1)}%`;
                        comment = diff > 0 ? '持续进步' : (diff < -3 ? '需要关注' : '基本稳定');
                    } else {
                        trend = '首次训练'; comment = '刚刚开始';
                    }
                    y = drawTableRow(pdf, [GAME_CFG[g].label, `${latest}%`, trend, comment], colW, y);
                }
            }

            // ===== 每个游戏: AI 分析 + 历史记录 =====
            const gameOrder = ['name', 'point', 'mic'].filter(g => checkedSet.has(g));
            for (const g of gameOrder) {
                const cfg = GAME_CFG[g];
                const recs = cfg.records() || [];

                y += 10;
                if (y > 240) { pdf.addPage(); y = M; }
                y = drawTitleBar(pdf, cfg.label + '  —  AI 分析与建议', y);
                y += 2;

                const aiText = await fetchAIAnalysis(g);
                if (aiText) {
                    const clean = aiText.replace(/^#{1,3}\s+/gm, '').replace(/\*\*/g, '').trim();
                    y = writeText(pdf, clean, M, y, PW - 2 * M, 5, 10, [77, 55, 36]);
                } else {
                    y = writeText(pdf, '暂无 AI 分析数据。完成更多训练后，系统将自动生成个性化的专业分析与建议。', M, y, PW - 2 * M, 5, 10, [150, 130, 110]);
                }

                // 训练历史表
                y += 5;
                if (y > 245) { pdf.addPage(); y = M; }
                y = drawTitleBar(pdf, cfg.label + '  —  训练记录', y);
                y += 2;
                const tw = [(PW - 2 * M) * 0.28, (PW - 2 * M) * 0.28, (PW - 2 * M) * 0.22, (PW - 2 * M) * 0.22];
                y = drawTableRow(pdf, ['日期', '正确率', '完成情况', '反应/用时'], tw, y, true);

                if (recs.length === 0) {
                    y = drawTableRow(pdf, ['暂无训练记录', '', '', ''], tw, y);
                } else {
                    for (const r of recs.slice(0, 7)) {
                        const date = r.session_date || '';
                        const rate = `${r.accuracy || 0}%`;
                        let complete = '', extra = '';
                        if (g === 'name') {
                            complete = `${r.success_count || 0}/${r.round_total || 0} 成功`;
                            extra = `${r.avg_reaction_time || 0}秒`;
                        } else if (g === 'point') {
                            complete = `${r.correct_rounds || 0}/${r.round_total || 0} 正确`;
                            extra = `${r.avg_time_sec || 0}秒/轮`;
                        } else {
                            complete = `${r.completed_rounds || 0}/${r.round_total || 0} 完成`;
                            extra = `${r.success_count || 0}次成功`;
                        }
                        y = drawTableRow(pdf, [date, rate, complete, extra], tw, y);
                        if (y > 270) { pdf.addPage(); y = M; }
                    }
                }
            }

            // ===== 声明 =====
            y += 12;
            if (y > 255) { pdf.addPage(); y = M; }
            pdf.setDrawColor(207, 162, 118); pdf.setLineWidth(0.3);
            pdf.line(M, y, PW - M, y); y += 6;
            pdf.setFontSize(8);
            pdf.setTextColor(160, 140, 120);
            const disclaimer = '声明：本报告由星伴平台自动生成，所有数据来源于孩子在平台上的游戏训练记录。AI 分析基于循证 ASD（孤独症谱系障碍）专业知识库生成，旨在为家长提供参考和建议，不构成医疗诊断。如对孩子的发展有任何担忧，请咨询专业儿科医生或儿童发育行为专家。';
            writeText(pdf, disclaimer, M, y, PW - 2 * M, 3.5, 8, [160, 140, 120]);

            panel.classList.remove('show');
            document.getElementById('overlay').classList.remove('show');
            pdf.save(`星伴数据报告_${childName}_${today}.pdf`);
            showToast('报告导出成功！');
        } catch (error) {
            console.error('PDF导出失败:', error);
            showToast('导出失败，请重试');
        }
    }

    // 启动
    init();
})();

