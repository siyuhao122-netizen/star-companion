(function () {
    // ========== API 配置 ==========
    const API_BASE = 'http://localhost:5000/api';
    
    // 游戏映射
    const gameMap = {
        name: { title: '叫名反应', page: 'askName.html', icon: 'fa-ear-deaf' },
        point: { title: '指物练习', page: 'touchGame.html', icon: 'fa-hand-peace' },
        mic: { title: '声音小话筒', page: 'voice.html', icon: 'fa-microphone-alt' }
    };

    // 全局变量
    let childrenData = [];        // 从后端加载的真实孩子列表
    let currentChildId = null;   // 当前选中的孩子ID

    // DOM 元素
    const childInfoCard = document.getElementById('childInfoCard');
    const childDropdown = document.getElementById('childDropdown');
    const overlay = document.getElementById('overlay');
    const currentChildName = document.getElementById('currentChildName');
    const currentChildAge = document.getElementById('currentChildAge');
    const currentChildAvatar = document.getElementById('currentChildAvatar');
    const childList = document.getElementById('childList');
    const quoteText = document.getElementById('quoteText');
    const tipText = document.getElementById('tipText');
    const recCardsContainer = document.getElementById('recCardsContainer');

    // ========== 辅助函数 ==========
    function showToast(msg) {
        const existingToast = document.querySelector('.toast-message');
        if (existingToast) existingToast.remove();
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.style.cssText = `
            position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: #FEF3E2; padding: 12px 28px; border-radius: 56px;
            font-weight: 600; color: #B4753E; font-size: 15px; z-index: 1000;
            box-shadow: 0 10px 24px rgba(100, 70, 30, 0.15);
            border: 1.5px solid #FFE4CA; white-space: nowrap;
        `;
        toast.innerHTML = `<i class="fas fa-star"></i> ${msg}`;
        document.querySelector('.dashboard').appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    function calculateAge(birthDateStr) {
        if (!birthDateStr) return '未知';
        const birth = new Date(birthDateStr);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
        if (age < 1) {
            const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
            return months + '个月';
        }
        return age + '岁';
    }

    // ========== 从后端加载孩子列表 ==========
    async function fetchChildrenFromServer() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user.id;
        if (!userId) {
            console.warn('用户未登录，跳转登录页');
            location.href = 'sign-inANDsign-up.html';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/child/list/${userId}`);
            const result = await response.json();
            if (result.success && result.data.length > 0) {
                childrenData = result.data;
                // 找出当前活跃的孩子（is_active === true）
                let activeChild = childrenData.find(c => c.is_active === true);
                if (!activeChild && childrenData.length > 0) activeChild = childrenData[0];
                currentChildId = activeChild ? activeChild.id : null;
                if (currentChildId) {
                    localStorage.setItem('starCompanionActiveChild', currentChildId);
                }
                // 更新界面
                renderChildList();
                updateCurrentChildDisplay();
                await renderRecommendationCards();
            } else {
                // 没有孩子，显示空状态
                childrenData = [];
                currentChildId = null;
                renderChildList();
                showEmptyState();
            }
        } catch (error) {
            console.error('获取孩子列表失败', error);
            showToast('加载孩子信息失败，请检查网络');
        }
    }

    // 显示空状态（暂无孩子）
    function showEmptyState() {
        recCardsContainer.innerHTML = `
            <div style="width:100%; text-align:center; padding:40px; color:#B89A78;">
                <i class="fas fa-child" style="font-size:48px; margin-bottom:16px;"></i>
                <p>还没有添加宝贝</p>
                <p style="font-size:12px;">请前往「个人中心」添加宝贝</p>
            </div>
        `;
        quoteText.textContent = '添加宝贝后，星伴会为您推荐专属训练～';
        tipText.textContent = '✨ 点击右上角头像添加宝贝';
    }

    // ========== 更新顶部孩子信息 ==========
    function updateCurrentChildDisplay() {
        const child = childrenData.find(c => c.id === currentChildId);
        if (!child) return;
        currentChildName.textContent = child.name;
        currentChildAge.textContent = calculateAge(child.birth_date);
        // 更新头像
        const avatarContainer = currentChildAvatar;
        avatarContainer.innerHTML = ''; // 清空
        if (child.avatar_type === 'custom' && child.avatar) {
            const img = document.createElement('img');
            img.src = child.avatar;
            img.style.width = '48px';
            img.style.height = '48px';
            img.style.borderRadius = '32px';
            img.style.objectFit = 'cover';
            avatarContainer.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className = `fas ${child.avatar || 'fa-face-smile'}`;
            avatarContainer.appendChild(icon);
        }
        // 金句（根据孩子特点，可以后续从后端获取）
        quoteText.textContent = `${child.name}宝贝，今天也要加油哦！`;
    }

    // ========== 渲染孩子下拉列表 ==========
    function renderChildList() {
        childList.innerHTML = '';
        if (childrenData.length === 0) {
            const emptyLi = document.createElement('li');
            emptyLi.className = 'child-list-item';
            emptyLi.innerHTML = '<div style="text-align:center; width:100%;">暂无宝贝，请添加</div>';
            childList.appendChild(emptyLi);
            return;
        }
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

    // ========== 切换孩子（同步后端） ==========
    async function switchChild(childId) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user.id;
        if (!userId) return;
        try {
            await fetch(`${API_BASE}/child/switch/${childId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            currentChildId = childId;
            localStorage.setItem('starCompanionActiveChild', childId);
            await fetchChildrenFromServer(); // 重新加载（会刷新列表和显示）
            const child = childrenData.find(c => c.id === childId);
            if (child) showToast(`✨ 已切换到${child.name}宝贝`);
        } catch (error) {
            console.error('切换失败', error);
            showToast('切换失败，请稍后重试');
        }
    }

    // ========== 渲染推荐卡片（暂时使用模拟成功率，后续可替换为真实数据） ==========
async function renderRecommendationCards() {
    if (childrenData.length === 0) {
        showEmptyState();
        return;
    }

    const child = childrenData.find(c => c.id === currentChildId);
    if (!child) return;

    tipText.textContent = `🎯 ${child.name}宝贝，今日推荐`;

    // 先显示加载状态
    recCardsContainer.innerHTML = `
        <div style="width:100%; text-align:center; padding:28px; color:#B89A78;">
            <i class="fas fa-spinner fa-spin" style="font-size:28px; margin-bottom:10px;"></i>
            <p>正在读取训练数据...</p>
        </div>
    `;

    let recommendationData = null;
    let recOrder = ['name', 'point', 'mic'];

    try {
        const response = await fetch(`${API_BASE}/games/recommendations/${currentChildId}`);
        const result = await response.json();

        if (result.success && result.data) {
            recommendationData = result.data;
            recOrder = result.order || recOrder;
        }
    } catch (error) {
        console.error('加载首页推荐数据失败:', error);
    }

    // 如果接口失败，给出兜底结构，但不再用假百分比
    if (!recommendationData) {
        recommendationData = {
            name: { last_rate: null, has_data: false, summary: '还没有训练记录' },
            point: { last_rate: null, has_data: false, summary: '还没有训练记录' },
            mic: { last_rate: null, has_data: false, summary: '还没有训练记录' }
        };
    }

    let cardsHtml = '';

    recOrder.forEach(gameKey => {
        const game = gameMap[gameKey];
        const item = recommendationData[gameKey] || {};
        const hasData = item.has_data === true;
        const rateText = hasData ? `${item.last_rate}%` : '暂无数据';
        const summaryText = item.summary || '还没有训练记录';
        const dateText = item.last_date ? ` · ${item.last_date}` : '';

        cardsHtml += `
            <div class="rec-card" data-game="${gameKey}">
                <div class="rec-top">
                    <div class="rec-icon-lg"><i class="fas ${game.icon}"></i></div>
                    <div class="rec-title">${game.title}</div>
                </div>

                <div class="success-chip">
                    <i class="fas fa-database"></i>
                    <span>
                        上次成功率：
                        <span class="rate-number">${rateText}</span>
                    </span>
                </div>

                <div style="
                    font-size:12px;
                    color:#9B846C;
                    margin:8px 0 12px;
                    line-height:1.5;
                    min-height:34px;
                ">
                    ${summaryText}${dateText}
                </div>

                <button class="train-btn" data-game="${gameKey}">
                    <i class="fas fa-play-circle"></i> 开始训练
                </button>
            </div>
        `;
    });

    recCardsContainer.innerHTML = cardsHtml;
    bindCardEvents();
}

    // 跳转到游戏
    function goToGame(gameKey) {
        const child = childrenData.find(c => c.id === currentChildId);
        if (!child) {
            showToast('请先添加宝贝');
            return;
        }
        const game = gameMap[gameKey];
       if (game) {
    localStorage.setItem('starCompanionActiveChild', currentChildId);
    localStorage.setItem('currentChildName', child.name);

    showToast(`🎮 ${child.name}宝贝 · 进入${game.title}训练`);
    setTimeout(() => {
        location.href = `${game.page}?childId=${currentChildId}&game=${gameKey}`;
    }, 500);
}
    }

    function bindCardEvents() {
        document.querySelectorAll('.rec-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.train-btn')) return;
                const gameKey = card.getAttribute('data-game');
                if (gameKey) goToGame(gameKey);
            });
        });
        document.querySelectorAll('.train-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameKey = btn.getAttribute('data-game');
                if (gameKey) goToGame(gameKey);
            });
        });
    }

    // 顶部孩子卡片点击，切换下拉菜单
    function toggleDropdown(e) {
        e.stopPropagation();
        childDropdown.classList.toggle('show');
        overlay.classList.toggle('show');
    }
    function closeDropdown() {
        childDropdown.classList.remove('show');
        overlay.classList.remove('show');
    }

    // ========== 底部导航栏 ==========
    function bindNavEvents() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const navValue = item.getAttribute('data-nav');
                if (navValue === '首页') location.href = 'mainPart.html';
                else if (navValue === '数据看板') location.href = 'dataLook.html';
                else if (navValue === '家长树洞') location.href = 'seniorHole.html';
                else if (navValue === '问卷筛查') location.href = 'survey-select.html';
            });
        });
    }

    // ========== 三大技能卡片 ==========
    function bindSkillCards() {
        document.querySelectorAll('.skill-item').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameKey = card.getAttribute('data-game');
                if (gameKey) goToGame(gameKey);
            });
        });
    }

    // ========== 个人中心头像跳转 ==========
    const parentAvatarBtn = document.getElementById('parentAvatarBtn');
    if (parentAvatarBtn) {
        parentAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            location.href = 'peopleHome.html';
        });
    }

    // ========== 初始化 ==========
    async function init() {
        // 检查登录状态
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) {
            showToast('请先登录');
            setTimeout(() => { location.href = 'sign-inANDsign-up.html'; }, 1500);
            return;
        }
        await fetchChildrenFromServer();
        bindNavEvents();
        bindSkillCards();
        childInfoCard.addEventListener('click', toggleDropdown);
        overlay.addEventListener('click', closeDropdown);
        document.addEventListener('click', (e) => {
            if (!childInfoCard.contains(e.target) && !childDropdown.contains(e.target)) closeDropdown();
        });
    }

    init();
    console.log('✅ 主界面 - 已连接后端数据库');
})();