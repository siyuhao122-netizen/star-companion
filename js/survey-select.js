(function () {
    const API_BASE = 'http://localhost:5000/api';
    
    // 获取当前用户ID和孩子ID
    let childId = localStorage.getItem('starCompanionActiveChild');
    const urlParams = new URLSearchParams(window.location.search);
    const urlChildId = urlParams.get('childId');
    if (!childId && urlChildId) childId = urlChildId;
    
    // 如果没有孩子ID，尝试从用户的孩子列表中获取活跃孩子
    if (!childId) {
        checkLoginAndGetChild();
    } else {
        childId = parseInt(childId);
        initPage();
    }
    
    let childInfo = null;
    let recommendedScale = 'mchat';
    
    // DOM 元素
    const childDisplayName = document.getElementById('childDisplayName');
    const mchatCard = document.getElementById('mchatCard');
    const castCard = document.getElementById('castCard');
    const recommendTitle = document.getElementById('recommendTitle');
    const recommendReason = document.getElementById('recommendReason');
    const recommendIcon = document.getElementById('recommendIcon');
    const historyBtn = document.getElementById('historyBtn');
    const historyModal = document.getElementById('historyModal');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyList = document.getElementById('historyList');
    const detailModal = document.getElementById('detailModal');
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    const detailContent = document.getElementById('detailContent');
    
    function showToast(msg, isSuccess = true) {
        let t = document.querySelector('.toast-msg');
        if (t) t.remove();
        t = document.createElement('div');
        t.className = 'toast-msg';
        t.innerHTML = `<i class="fas fa-${isSuccess ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
    
    // 检查登录状态并获取孩子
    async function checkLoginAndGetChild() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) {
            showToast('请先登录', false);
            setTimeout(() => {
                window.location.href = 'sign-inANDsign-up.html';
            }, 1500);
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/child/list/${user.id}`);
            const result = await response.json();
            if (result.success && result.data.length > 0) {
                // 找活跃的孩子
                const activeChild = result.data.find(c => c.is_active);
                if (activeChild) {
                    childId = activeChild.id;
                    localStorage.setItem('starCompanionActiveChild', childId);
                } else {
                    childId = result.data[0].id;
                    localStorage.setItem('starCompanionActiveChild', childId);
                }
                initPage();
            } else {
                showToast('请先添加宝贝', false);
                setTimeout(() => {
                    window.location.href = 'peopleHome.html';
                }, 1500);
            }
        } catch (error) {
            console.error('获取孩子列表失败:', error);
            childDisplayName.textContent = '加载失败';
        }
    }
    
    async function fetchChildInfo() {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const response = await fetch(`${API_BASE}/child/list/${user.id}`);
            const result = await response.json();
            if (result.success) {
                const child = result.data.find(c => c.id === childId);
                if (child) {
                    childInfo = child;
                    const ageText = calculateAge(child.birth_date);
                    childDisplayName.textContent = `${child.name} · ${ageText}`;
                    return true;
                }
            }
            childDisplayName.textContent = '未找到宝贝';
            return false;
        } catch (error) {
            console.error('获取孩子信息失败:', error);
            childDisplayName.textContent = '加载失败';
            return false;
        }
    }
    
    function calculateAge(birthDateStr) {
        if (!birthDateStr) return '';
        const birth = new Date(birthDateStr);
        const today = new Date();
        const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
        if (months < 12) return months + '个月';
        const years = Math.floor(months / 12);
        const remainMonths = months % 12;
        return remainMonths > 0 ? `${years}岁${remainMonths}个月` : `${years}岁`;
    }
    
    async function fetchRecommendation() {
        try {
            const response = await fetch(`${API_BASE}/ai/recommend-scale/${childId}`);
            const result = await response.json();
            if (result.success) {
                const data = result.data;
                recommendedScale = data.recommended;
                const ageMonths = data.age_months;
                
                // 更新推荐卡片
                if (data.recommended === 'mchat') {
                    mchatCard.classList.add('recommended');
                    castCard.classList.remove('recommended');
                    recommendIcon.className = 'fas fa-star';
                    recommendTitle.textContent = `🌟 推荐使用 M-CHAT-R`;
                    recommendReason.textContent = `${data.reason}`;
                } else {
                    castCard.classList.add('recommended');
                    mchatCard.classList.remove('recommended');
                    recommendIcon.className = 'fas fa-star';
                    recommendTitle.textContent = `🌟 推荐使用 CAST`;
                    recommendReason.textContent = `${data.reason}`;
                }
                
                // 如果月龄不在任何量表的适用范围内，给出提示
                if (ageMonths < 16) {
                    recommendTitle.textContent = `⏳ 宝贝月龄较小 (${ageMonths}个月)`;
                    recommendReason.textContent = `建议满16个月后再进行筛查。您也可以提前了解量表内容。`;
                } else if (ageMonths > 132) {
                    recommendTitle.textContent = `📋 宝贝已超过11岁`;
                    recommendReason.textContent = `本量表适用于11岁以下儿童，建议咨询专业医生获取更适合的评估工具。`;
                }
            } else {
                recommendTitle.textContent = '📋 请选择量表';
                recommendReason.textContent = '两种量表均为国际公认的筛查工具，您可以根据需要选择';
            }
        } catch (error) {
            console.error('获取推荐失败:', error);
            recommendTitle.textContent = '📋 请选择量表';
            recommendReason.textContent = 'M-CHAT-R适合16-30个月，CAST适合4-11岁';
        }
    }
    
    // ========== 新增：获取问卷历史记录 ==========
let currentFilter = 'all';        // 当前筛选条件
let allSurveyRecords = [];        // 存储所有记录

// ========== 修改：获取问卷历史记录 ==========
async function fetchSurveyHistory() {
    if (!childId) return;
    
    try {
        const response = await fetch(`${API_BASE}/ai/survey-history/${childId}`);
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            allSurveyRecords = result.data;
            applyFilter(currentFilter);
        } else {
            allSurveyRecords = [];
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-clipboard-list"></i>
                    <p>暂无筛查记录</p>
                    <p style="font-size: 12px; margin-top: 8px;">完成筛查后，结果会显示在这里</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('获取历史记录失败:', error);
        historyList.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-exclamation-circle"></i>
                <p>加载失败，请稍后重试</p>
            </div>
        `;
    }
}

// ========== 新增：应用筛选 ==========
function applyFilter(filter) {
    currentFilter = filter;
    
    // 更新标签激活状态
    document.querySelectorAll('#filterTabs .filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    
    // 根据筛选条件过滤记录
    const filteredRecords = filter === 'all' 
        ? allSurveyRecords 
        : allSurveyRecords.filter(r => r.scale_type === filter);
    
    if (filteredRecords.length === 0) {
        const filterName = filter === 'all' ? '' : 
                          (filter === 'mchat' ? 'M-CHAT-R' : 'CAST');
        historyList.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-filter"></i>
                <p>暂无${filterName ? filterName + ' ' : ''}筛查记录</p>
                <p style="font-size: 12px; margin-top: 8px;">完成${filterName ? filterName : ''}筛查后，结果会显示在这里</p>
            </div>
        `;
    } else {
        renderHistoryList(filteredRecords);
    }
}
    // ========== 新增：渲染历史记录列表 ==========
    function renderHistoryList(records) {
        historyList.innerHTML = records.map(record => {
            const levelClass = record.level === '低风险' ? 'level-low' :
                               (record.level === '中风险' ? 'level-medium' : 'level-high');
            
            const scaleIcon = record.scale_type === 'mchat' ? 'fa-clipboard-check' : 'fa-clipboard-list';
            
            return `
                <div class="history-item" data-record-id="${record.id}" onclick="showDetailRecord(${record.id})">
                    <div class="history-scale-badge">
                        <i class="fas ${scaleIcon}"></i>
                    </div>
                    <div class="history-info">
                        <div class="history-scale-name">${record.scale_name}</div>
                        <div class="history-date">
                            <i class="far fa-calendar-alt"></i>
                            ${formatDate(record.created_at)}
                        </div>
                    </div>
                    <div class="history-metrics">
                        <div class="history-score">${record.total_score}<span style="font-size: 14px; color: #9B846C;">/${record.max_score}</span></div>
                        <span class="history-level ${levelClass}">${record.level}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    function formatDate(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // ========== 新增：查看详情记录 ==========
    async function showDetailRecord(recordId) {
        // 从历史列表中获取对应记录的数据
        const historyItems = document.querySelectorAll('.history-item');
        let recordData = null;
        
        // 重新获取完整数据
        try {
            const response = await fetch(`${API_BASE}/ai/survey-history/${childId}`);
            const result = await response.json();
            if (result.success) {
                recordData = result.data.find(r => r.id === recordId);
            }
        } catch (error) {
            console.error('获取详情失败:', error);
            showToast('加载详情失败', false);
            return;
        }
        
        if (!recordData) {
            showToast('找不到该记录', false);
            return;
        }
        
        renderDetailModal(recordData);
        detailModal.classList.add('show');
    }
    
    // ========== 新增：渲染详情弹窗 ==========
    function renderDetailModal(record) {
        const levelClass = record.level === '低风险' ? 'level-low' :
                           (record.level === '中风险' ? 'level-medium' : 'level-high');
        
        // 维度得分
        let dimensionsHtml = '';
        if (record.dimension_scores && typeof record.dimension_scores === 'object') {
            Object.entries(record.dimension_scores).forEach(([key, dim]) => {
                const percentage = (dim.score / dim.max) * 100;
                const barColor = percentage >= 70 ? '#9BBF7A' : (percentage >= 40 ? '#D9A066' : '#D4A0A0');
                dimensionsHtml += `
                    <div class="dimension-card">
                        <div class="dimension-name">${dim.name}</div>
                        <div class="dimension-bar-bg">
                            <div class="dimension-bar-fill" style="width: ${percentage}%; background: ${barColor};"></div>
                        </div>
                        <div class="dimension-score-text">${dim.score}/${dim.max} 分</div>
                    </div>
                `;
            });
        }
        
        detailContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <span class="history-level ${levelClass}" style="font-size: 14px; padding: 6px 20px;">${record.level}</span>
                <div style="margin-top: 12px;">
                    <span style="font-size: 14px; color: #9B846C;">${record.scale_name}</span>
                </div>
            </div>
            
            <div class="detail-score-row">
                <div class="detail-score-card">
                    <div class="detail-score-label">总分</div>
                    <div class="detail-score-value">${record.total_score}</div>
                    <div class="detail-score-max">满分 ${record.max_score}</div>
                </div>
                <div class="detail-score-card">
                    <div class="detail-score-label">评估日期</div>
                    <div class="detail-score-value" style="font-size: 16px; color: #5E422C;">${formatDate(record.created_at)}</div>
                    <div class="detail-score-max">筛查完成</div>
                </div>
            </div>
            
            ${dimensionsHtml ? `
            <h3 style="font-size: 14px; font-weight: 700; color: #6C4F32; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-chart-bar" style="color: #D9A066;"></i> 各维度得分
            </h3>
            <div class="detail-dimensions">
                ${dimensionsHtml}
            </div>
            ` : ''}
            
            ${record.ai_analysis ? `
            <div class="detail-ai-analysis">
                <h3><i class="fas fa-robot"></i> AI 智能分析报告</h3>
                <div class="ai-content">${record.ai_analysis}</div>
            </div>
            ` : '<p style="text-align: center; color: #B89A78;">暂无分析报告</p>'}
            
            <div class="btns-row">
                <button class="btn-outline" onclick="closeDetailModal()">
                    <i class="fas fa-times"></i> 关闭
                </button>
            </div>
        `;
    }
    
    function closeDetailModal() {
        detailModal.classList.remove('show');
    }
    
    // ========== 历史记录弹窗开关 ==========
    function openHistoryModal() {
        fetchSurveyHistory();
        historyModal.classList.add('show');
    }
    
    function closeHistoryModal() {
        historyModal.classList.remove('show');
    }
    
    // 点击遮罩关闭
    historyModal.addEventListener('click', function(e) {
        if (e.target === this) closeHistoryModal();
    });
    
    detailModal.addEventListener('click', function(e) {
        if (e.target === this) closeDetailModal();
    });
    
// 切换孩子下拉
function toggleChildDropdown() {
    const menu = document.getElementById('childDropdownMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    if (menu.style.display === 'block') {
        renderChildDropdownList();
    }
}

async function renderChildDropdownList() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const response = await fetch(`${API_BASE}/child/list/${user.id}`);
    const result = await response.json();
    
    if (result.success) {
        const list = document.getElementById('childDropdownList');
        list.innerHTML = result.data.map(c => `
            <li onclick="switchSurveyChild(${c.id})" 
                style="padding:10px 14px;border-radius:16px;cursor:pointer;display:flex;align-items:center;gap:8px;${c.id === childId ? 'background:#FDF5EC;' : ''}">
                <span>${c.name}</span>
                <span style="font-size:11px;color:#9B846C;">${calculateAge(c.birth_date)}</span>
                ${c.id === childId ? '<i class="fas fa-check" style="color:#D9A066;margin-left:auto;"></i>' : ''}
            </li>
        `).join('');
    }
}

async function switchSurveyChild(newChildId) {
    childId = newChildId;
    localStorage.setItem('starCompanionActiveChild', childId);
    await fetchChildInfo();
    await fetchRecommendation();
    document.getElementById('childDropdownMenu').style.display = 'none';
    showToast('已切换宝贝');
}

// 点击其他地方关闭下拉
document.addEventListener('click', (e) => {
    const menu = document.getElementById('childDropdownMenu');
    const childInfo = document.getElementById('childInfo');
    if (menu && !menu.contains(e.target) && !childInfo.contains(e.target)) {
        menu.style.display = 'none';
    }
});

// 暴露给 HTML onclick


    // ========== 量表选择跳转 ==========
    function goToSurvey(scaleType) {
        if (!childId) {
            showToast('请先选择宝贝', false);
            return;
        }
        
        const scaleName = scaleType === 'mchat' ? 'M-CHAT-R' : 'CAST';
        showToast(`正在进入 ${scaleName} 筛查...`);
        
        setTimeout(() => {
            window.location.href = `askQuestions.html?childId=${childId}&scale=${scaleType}`;
        }, 500);
    }
    
    // 绑定事件
    function bindEvents() {
        document.querySelectorAll('[data-scale]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const scale = this.dataset.scale;
                goToSurvey(scale);
            });
        });
        
        mchatCard.addEventListener('click', (e) => {
            if (e.target.closest('.select-btn')) return;
            goToSurvey('mchat');
        });
        
        castCard.addEventListener('click', (e) => {
            if (e.target.closest('.select-btn')) return;
            goToSurvey('cast');
        });
        
        // 新增：历史记录按钮
        historyBtn.addEventListener('click', openHistoryModal);
        closeHistoryBtn.addEventListener('click', closeHistoryModal);
        closeDetailBtn.addEventListener('click', closeDetailModal);

         // 新增：筛选标签点击事件
    document.querySelectorAll('#filterTabs .filter-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const filter = this.dataset.filter;
            applyFilter(filter);
        });
    });
    
    // 新增：打开历史记录弹窗时重置筛选为"全部"
    historyBtn.addEventListener('click', () => {
        currentFilter = 'all';
        openHistoryModal();
    });
    }
    
    // 暴露全局函数给HTML onclick使用
    window.showDetailRecord = showDetailRecord;
    window.closeDetailModal = closeDetailModal;
    window.toggleChildDropdown = toggleChildDropdown;
window.switchSurveyChild = switchSurveyChild;
    // 初始化页面
    async function initPage() {
        const hasChild = await fetchChildInfo();
        if (hasChild) {
            await fetchRecommendation();
        } else {
            recommendTitle.textContent = '⚠️ 未找到宝贝信息';
            recommendReason.textContent = '请先在个人中心添加宝贝';
        }
        bindEvents();
    }
    
    // 如果已经有 childId，直接初始化
    if (childId) {
        childId = parseInt(childId);
        initPage();
    }
})();