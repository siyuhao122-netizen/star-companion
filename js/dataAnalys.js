// dataAnalys.js
(function () {
    const API_BASE = 'http://localhost:5000/api';
    
    const urlParams = new URLSearchParams(window.location.search);
    const childId = urlParams.get('childId') || localStorage.getItem('starCompanionActiveChild');
    const count = urlParams.get('count') || 10;
    
    // 孩子信息（从localStorage或URL获取）
    let childName = '宝贝';
    let childAge = '';
    
    let rateChart, timeChart;
    
    // ========== 初始化 ==========
    async function init() {
        if (!childId) {
            showToast('参数错误');
            setTimeout(() => { location.href = 'dataLook.html'; }, 1500);
            return;
        }
        
        // 获取孩子信息
        await fetchChildInfo();
        
        // 加载AI分析数据
        showLoading();
        await fetchTrendAnalysis(count);
        
        setupEvents();
    }
    
    async function fetchChildInfo() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const response = await fetch(`${API_BASE}/child/list/${user.id}`);
            const result = await response.json();
            if (result.success) {
                const child = result.data.find(c => c.id === parseInt(childId));
                if (child) {
                    childName = child.name;
                    childAge = calculateAge(child.birth_date);
                    document.getElementById('childDisplayInfo').textContent = 
                        `${childName} · ${childAge} · ${child.gender === '男' ? '男孩' : '女孩'}`;
                }
            }
        } catch (e) {
            console.error('获取孩子信息失败:', e);
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
    
    function showLoading() {
        document.getElementById('trendList').innerHTML = `
            <div style="text-align:center; padding:40px;">
                <i class="fas fa-spinner fa-spin" style="font-size:32px; color:#D9A066;"></i>
                <p style="margin-top:12px; color:#B89A78;">🤖 AI正在分析训练数据...</p>
            </div>
        `;
    }
    
    // ========== 核心：获取趋势分析 ==========
    async function fetchTrendAnalysis(limit) {
        try {
            const response = await fetch(`${API_BASE}/point-game-ai/trend-analysis/${childId}?limit=${limit}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const data = result.data;
                
                // 更新KPI指标
                updateKPIs(data.records);
                
                // 更新图表
                renderCharts(data.records);
                
                // 更新AI分析报告
                updateReport(data);
                
                // 更新标题
                document.getElementById('reportRangeLabel').textContent = `最近${data.total_records}次`;
                document.getElementById('chart1Label').textContent = `近${data.total_records}次`;
                document.getElementById('chart2Label').textContent = `近${data.total_records}次`;
                
                // 显示token
                if (data.tokens) {
                    console.log(`📊 本次分析消耗token: ${data.tokens}`);
                }
            } else {
                showEmpty();
            }
        } catch (error) {
            console.error('获取分析失败:', error);
            document.getElementById('trendList').innerHTML = `
                <div style="text-align:center; padding:40px; color:#C06060;">
                    <i class="fas fa-exclamation-circle" style="font-size:32px;"></i>
                    <p>加载失败，请检查网络</p>
                </div>
            `;
        }
    }
    
    // ========== 更新KPI ==========
    function updateKPIs(records) {
        if (!records || records.length === 0) {
            ['kpiCorrectRate', 'kpiClickRate', 'kpiAvgTime', 'kpiTimeout'].forEach(id => {
                document.getElementById(id).textContent = '—';
            });
            return;
        }
        
        const latest = records[0];
        const first = records[records.length - 1];
        
        document.getElementById('kpiCorrectRate').textContent = (latest.accuracy || 0) + '%';
        document.getElementById('kpiClickRate').textContent = (latest.click_accuracy || 0) + '%';
        document.getElementById('kpiAvgTime').textContent = (latest.avg_time_sec || 0).toFixed(1) + 's';
        document.getElementById('kpiTimeout').textContent = ((latest.timeout_count || 0) + (latest.skip_count || 0)) + '次';
        
        // 趋势
        const correctDiff = (latest.accuracy || 0) - (first.accuracy || 0);
        document.getElementById('kpiCorrectTrend').innerHTML = 
            `<i class="fas fa-arrow-${correctDiff >= 0 ? 'up' : 'down'}"></i> ${correctDiff >= 0 ? '+' : ''}${correctDiff.toFixed(1)}%`;
        
        const clickDiff = (latest.click_accuracy || 0) - (first.click_accuracy || 0);
        document.getElementById('kpiClickTrend').innerHTML = 
            `<i class="fas fa-arrow-${clickDiff >= 0 ? 'up' : 'down'}"></i> ${clickDiff >= 0 ? '+' : ''}${clickDiff.toFixed(1)}%`;
        
        if (first.avg_time_sec > 0 && latest.avg_time_sec > 0) {
            const timeDiff = Math.round(((first.avg_time_sec - latest.avg_time_sec) / first.avg_time_sec) * 100);
            document.getElementById('kpiTimeTrend').innerHTML = 
                `<i class="fas fa-arrow-down"></i> 缩短${Math.abs(timeDiff)}%`;
        }
    }
    
    // ========== 绘制图表 ==========
    function renderCharts(records) {
        if (!records || records.length === 0) return;
        
        const reversed = [...records].reverse();
        const labels = reversed.map((r, i) => `第${i + 1}次`);
        const correctRates = reversed.map(r => r.accuracy || 0);
        const avgTimes = reversed.map(r => r.avg_time_sec || 0);
        
        const ctx1 = document.getElementById('rateChart').getContext('2d');
        const ctx2 = document.getElementById('timeChart').getContext('2d');
        
        if (rateChart) rateChart.destroy();
        if (timeChart) timeChart.destroy();
        
        rateChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '正确率 (%)',
                    data: correctRates,
                    borderColor: '#9BBF7A',
                    backgroundColor: '#9BBF7A20',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#9BBF7A',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 100, grid: { color: '#F0E6DC' } },
                    x: { grid: { display: false } }
                }
            }
        });
        
        timeChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '平均用时 (秒)',
                    data: avgTimes,
                    borderColor: '#C68B54',
                    backgroundColor: '#C68B5420',
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#C68B54',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, grid: { color: '#F0E6DC' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
    
    // ========== 更新分析报告 ==========
    function updateReport(data) {
        const records = data.records || [];
        
        if (records.length === 0) {
            showEmpty();
            return;
        }
        
        // AI分析报告
        if (data.ai_analysis) {
            document.getElementById('trendList').innerHTML = `
                <div class="ai-report-content" style="white-space: pre-wrap; line-height: 1.8; color: #5E422C;">
                    ${formatAIResponse(data.ai_analysis)}
                </div>
            `;
        } else {
            // 简单本地分析
            const latest = records[0];
            document.getElementById('trendList').innerHTML = `
                <div class="trend-item">
                    <i class="fas fa-arrow-trend-up"></i>
                    <span class="trend-text"><strong>最新正确率</strong>：${latest.accuracy || 0}%（${latest.correct_rounds}/${latest.round_total}轮）</span>
                </div>
                <div class="trend-item">
                    <i class="fas fa-mouse-pointer"></i>
                    <span class="trend-text"><strong>点击准确率</strong>：${latest.click_accuracy || 0}%</span>
                </div>
                <div class="trend-item">
                    <i class="fas fa-clock"></i>
                    <span class="trend-text"><strong>平均用时</strong>：${latest.avg_time_sec || 0}秒/轮</span>
                </div>
            `;
        }
        
        // 进步与困难（用最新vs最早）
        if (records.length >= 2) {
            updateProgressCompare(records);
        }
        
        // 建议
        updateSuggestions(records, data.ai_analysis);
    }
    
    function formatAIResponse(text) {
        return text
            .replace(/## (.+)/g, '<h3 style="color:#6C4F32; margin:16px 0 8px; font-size:15px;">$1</h3>')
            .replace(/### (.+)/g, '<h4 style="color:#6C4F32; margin:12px 0 6px;">$1</h4>')
            .replace(/- (.+)/g, '<div style="padding-left:16px; margin:4px 0;">• $1</div>')
            .replace(/✅/g, '<span style="color:#9BBF7A;">✅</span>')
            .replace(/🌱/g, '<span>🌱</span>')
            .replace(/🌟/g, '<span>🌟</span>')
            .replace(/💡/g, '<span>💡</span>');
    }
    
    function updateProgressCompare(records) {
        const latest = records[0];
        const first = records[records.length - 1];
        
        const progressHtml = `
            <div class="progress-box green">
                <div class="box-title"><i class="fas fa-check-circle"></i> ✅ 进步之处</div>
                <ul class="box-list">
                    <li><i class="fas fa-trophy"></i> <span><strong>正确率提升</strong>：从${first.accuracy || 0}%→${latest.accuracy || 0}%</span></li>
                    <li><i class="fas fa-bolt"></i> <span><strong>反应加速</strong>：平均${(latest.avg_time_sec || 0).toFixed(1)}秒/轮</span></li>
                </ul>
            </div>
            <div class="progress-box orange">
                <div class="box-title"><i class="fas fa-exclamation-triangle"></i> ⚠️ 关注方面</div>
                <ul class="box-list">
                    <li><i class="fas fa-mouse"></i> <span><strong>点击精准度</strong>：${latest.click_accuracy || 0}%，${latest.click_accuracy >= 80 ? '表现良好' : '可继续练习'}</span></li>
                </ul>
            </div>
        `;
        document.getElementById('progressCompareBox').innerHTML = progressHtml;
    }
    
    function updateSuggestions(records, aiAnalysis) {
        if (aiAnalysis) {
            // 从AI分析中抽取建议部分
            const suggestionMatch = aiAnalysis.match(/💡[^#]*/);
            if (suggestionMatch) {
                document.getElementById('suggestionList').innerHTML = 
                    `<div style="white-space: pre-wrap; line-height: 1.8; color: #5E422C;">${formatAIResponse(suggestionMatch[0])}</div>`;
                return;
            }
        }
        
        // 默认建议
        document.getElementById('suggestionList').innerHTML = `
            <div class="suggestion-item">
                <div class="suggestion-num">1</div>
                <div class="suggestion-content"><strong>保持每日练习</strong> — 短时间高频次的练习效果更好</div>
            </div>
            <div class="suggestion-item">
                <div class="suggestion-num">2</div>
                <div class="suggestion-content"><strong>增加趣味性</strong> — 用游戏化的方式吸引宝贝注意力</div>
            </div>
            <div class="suggestion-item">
                <div class="suggestion-num">3</div>
                <div class="suggestion-content"><strong>及时鼓励</strong> — 每次正确点击都给宝贝大大的赞</div>
            </div>
        `;
    }
    
    function showEmpty() {
        document.getElementById('trendList').innerHTML = `
            <div style="text-align:center; padding:40px; color:#B89A78;">
                <i class="fas fa-clipboard-list" style="font-size:48px; margin-bottom:16px;"></i>
                <p>还没有训练记录</p>
                <p style="font-size:12px;">完成第一次指物练习后查看分析报告</p>
            </div>
        `;
    }
    
    // ========== 事件 ==========
    function setupEvents() {
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', function() {
                const count = parseInt(this.dataset.count);
                const label = this.querySelector('span').textContent;
                selectFilter(count, label);
            });
        });
    }
    
    function selectFilter(count, label) {
        document.getElementById('selectedFilterText').textContent = label;
        document.getElementById('reportRangeLabel').textContent = `最近${count}次`;
        document.getElementById('chart1Label').textContent = label;
        document.getElementById('chart2Label').textContent = label;
        
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.count) === count);
        });
        
        showLoading();
        fetchTrendAnalysis(count);
        closeDropdown();
    }
    
    function toggleDropdown() {
        document.getElementById('dropdownMenu').classList.toggle('show');
        document.getElementById('overlay').classList.toggle('show');
    }
    
    function closeDropdown() {
        document.getElementById('dropdownMenu').classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
    }
    
    function goBack() {
        location.href = 'dataLook.html';
    }
    
    function goToTraining() {
        location.href = `touchGame.html?childId=${childId}`;
    }
    
    function showToast(msg) {
        let t = document.querySelector('.toast-msg');
        if (t) t.remove();
        t = document.createElement('div');
        t.className = 'toast-msg';
        t.innerHTML = `<i class="fas fa-star"></i> ${msg}`;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000);
    }
    
    // 暴露全局函数
    window.toggleDropdown = toggleDropdown;
    window.closeDropdown = closeDropdown;
    window.selectFilter = selectFilter;
    window.goBack = goBack;
    window.goToTraining = goToTraining;
    
    init();
})();