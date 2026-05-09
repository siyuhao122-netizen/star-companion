(function () {
    // ========== API 配置 ==========
    const API_BASE = 'http://localhost:5000/api';

    // ========== AI回复模板（保持不变） ==========
    const aiReplies = {
        default: [
            "亲爱的家长，我能感受到你此刻的心情。养育孩子的路上，有这样的感受太正常了。你已经做得很好了，给自己一点时间和空间，一切都会慢慢好起来的。",
            "听到你的心声，想给你一个温暖的拥抱。每个家长都会有疲惫和困惑的时候，这不是你的问题。记得照顾好自己，你值得被温柔以待。",
            "感谢你愿意在这里分享。教育孩子确实不容易，但请相信，你的每一份付出都在孩子心里种下了爱的种子。"
        ],
        '育儿困惑': [
            "关于育儿的困惑，其实每个家长都会遇到。没有标准答案，但你对孩子的关注和思考，已经是最好的教育了。慢慢来，和孩子一起成长。",
            "能感受到你对孩子深深的爱。育儿问题往往没有唯一解，相信你的直觉，也给孩子一些探索的空间。你做得很好！"
        ],
        '情绪压力': [
            "压力大的时候，记得先照顾好自己的情绪。你不需要做完美的家长，只需要做真实的自己。深呼吸，慢慢来，一切都会过去的。",
            "能感受到你肩上的重担。请记住，适当的休息不是偷懒，而是为了更好地陪伴。"
        ],
        '家庭关系': [
            "家庭关系确实需要用心经营。沟通是桥梁，但也要记得保护好自己的边界。你已经很努力在平衡了，给自己一些肯定吧。",
            "每个家庭都有自己的节奏和模式，找到适合你们的方式最重要。"
        ]
    };

    // ========== 全局变量 ==========
    let messages = [];           // 所有留言（从后端加载）
    let selectedTag = '日常倾诉';
    let currentFilter = 'all';

    // DOM 元素
    const messagesList = document.getElementById('messagesList');
    const messageInput = document.getElementById('messageInput');
    const publishBtn = document.getElementById('publishBtn');
    const tagItems = document.querySelectorAll('.tag-item');
    const filterTabs = document.querySelectorAll('.filter-tab');
    const historyBtn = document.getElementById('historyBtn');
    const historyModal = document.getElementById('historyModal');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historyList = document.getElementById('historyList');

    // ========== 辅助函数 ==========
    function getCurrentUserId() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.id || null;
    }

    function formatTime(isoString) {
        if (!isoString) return '刚刚';
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        if (diff < 60 * 1000) return '刚刚';
        if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + '小时前';
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }

    function getAIReply(tag, content) {
        const repliesForTag = aiReplies[tag] || aiReplies.default;
        const randomIndex = Math.floor(Math.random() * repliesForTag.length);
        return repliesForTag[randomIndex];
    }

    function showToast(msg, bg = '#FEF3E2') {
        let existing = document.querySelector('.toast-message');
        if (existing) existing.remove();
        let toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.innerHTML = `<i class="fas fa-star"></i> ${msg}`;
        toast.style.background = bg;
        document.querySelector('.treehole-container').appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    // ========== 从后端加载留言 ==========
    async function loadMessagesFromServer() {
        try {
            const response = await fetch(`${API_BASE}/treehole/messages`);
            const data = await response.json();
            messages = data.map(msg => ({
                id: msg.id,
                user: msg.anonymous_name,
                avatar: msg.anonymous_avatar,
                time: formatTime(msg.created_at),
                tag: msg.tag,
                content: msg.content,
                aiReply: msg.ai_reply,
                likes: msg.likes,
                comments: msg.comments || 0,
                isMine: (msg.user_id === getCurrentUserId())
            }));
            renderMessages(currentFilter);
            renderHistory();
        } catch (error) {
            console.error('加载留言失败:', error);
            showToast('加载留言失败，请检查网络', '#FCE8E8');
        }
    }

    // ========== 发布留言到后端 ==========
    async function publishMessage() {
        const content = messageInput.value.trim();
        if (!content) {
            showToast('💭 写下你想说的话吧', '#FCE8E8');
            return;
        }
        if (content.length < 5) {
            showToast('💭 再多说一点吧，至少5个字~', '#FCE8E8');
            return;
        }

        const isAnonymous = document.getElementById('anonymousCheck').checked;
        const userId = getCurrentUserId();
        if (!userId) {
            showToast('请先登录', '#FCE8E8');
            return;
        }

        const aiReply = getAIReply(selectedTag, content);
        const requestBody = {
            user_id: userId,
            anonymous_name: isAnonymous ? '树洞小星' : '我',
            anonymous_avatar: isAnonymous ? '🌟' : '👤',
            content: content,
            tag: selectedTag,
            ai_reply: aiReply
        };

        try {
            const response = await fetch(`${API_BASE}/treehole/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            if (response.ok) {
                messageInput.value = '';
                showToast('🌳 你的心事已放入树洞，AI正在暖心回复中...', '#E8F0D8');
                await loadMessagesFromServer();   // 重新加载列表
                messagesList.scrollTop = 0;
            } else {
                showToast('发布失败，请稍后重试', '#FCE8E8');
            }
        } catch (error) {
            console.error('发布失败:', error);
            showToast('网络错误，发布失败', '#FCE8E8');
        }
    }

    // ========== 删除留言（可选） ==========
    async function deleteMessageFromServer(msgId) {
        try {
            const response = await fetch(`${API_BASE}/treehole/delete/${msgId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast('🗑️ 留言已删除');
                await loadMessagesFromServer();
            } else {
                showToast('删除失败', '#FCE8E8');
            }
        } catch (error) {
            console.error('删除失败:', error);
            showToast('网络错误', '#FCE8E8');
        }
    }

    // ========== 点赞 ==========
    async function likeMessageOnServer(msgId) {
        try {
            const response = await fetch(`${API_BASE}/treehole/like/${msgId}`, {
                method: 'POST'
            });
            if (response.ok) {
                const data = await response.json();
                return data.likes;
            }
        } catch (error) {
            console.error('点赞失败:', error);
        }
        return null;
    }

    // ========== 渲染留言列表 ==========
    function renderMessages(filter = 'all') {
        let filteredMessages = [...messages];
        if (filter === 'latest') {
            filteredMessages.sort((a, b) => b.id - a.id);
        } else if (filter === 'hot') {
            filteredMessages.sort((a, b) => b.likes - a.likes);
        }

        if (filteredMessages.length === 0) {
            messagesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tree"></i>
                    <p>还没有留言，来做第一个倾诉的人吧~</p>
                </div>
            `;
        } else {
            messagesList.innerHTML = filteredMessages.map(msg => `
                <div class="message-card">
                    <div class="message-header">
                        <div class="user-avatar">${msg.avatar}</div>
                        <div class="user-info">
                            <div class="user-name">
                                ${msg.user}
                                ${msg.isMine ? '<span class="my-message-badge">我的留言</span>' : ''}
                            </div>
                            <div class="message-time">${msg.time}</div>
                        </div>
                        <span class="message-tag">${msg.tag}</span>
                    </div>
                    <div class="message-content">${escapeHtml(msg.content)}</div>
                    <div class="ai-reply">
                        <div class="ai-reply-header">
                            <i class="fas fa-robot"></i>
                            <span>星伴AI</span>
                            <span class="ai-badge">暖心回复</span>
                        </div>
                        <div class="ai-reply-content">${escapeHtml(msg.aiReply)}</div>
                    </div>
                    <div class="message-footer">
                        <span class="message-action like-action" data-id="${msg.id}">
                            <i class="far fa-heart"></i> ${msg.likes} 暖心
                        </span>
                        <span class="message-action comment-action" data-id="${msg.id}">
                            <i class="far fa-comment"></i> ${msg.comments} 回复
                        </span>
                        ${msg.isMine ? `
                            <span class="message-action delete-action" data-id="${msg.id}">
                                <i class="far fa-trash-alt"></i> 删除
                            </span>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }

        // 绑定点赞事件
        document.querySelectorAll('.like-action').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const newLikes = await likeMessageOnServer(id);
                if (newLikes !== null) {
                    const msg = messages.find(m => m.id === id);
                    if (msg) msg.likes = newLikes;
                    renderMessages(currentFilter);
                    showToast('❤️ 感谢你的暖心支持');
                }
            });
        });

      // 绑定删除事件
document.querySelectorAll('.delete-action').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        // 使用自定义弹窗而不是 confirm
        if (confirm('确定要删除这条留言吗？删除后无法恢复。')) {
            await deleteMessageFromServer(id);
        }
    });
});
    }

    // 简单的防XSS
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // ========== 渲染历史记录（仅自己的留言） ==========
    function renderHistory() {
        const myMessages = messages.filter(msg => msg.isMine);
        if (myMessages.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-inbox"></i>
                    <p>暂无历史记录</p>
                    <p style="font-size:12px; margin-top:6px;">发布留言后会在这里显示</p>
                </div>
            `;
        } else {
            historyList.innerHTML = myMessages.map(item => `
                <div class="history-item">
                    <div class="history-item-header">
                        <span class="history-tag">${item.tag}</span>
                        <span class="history-time">${item.time}</span>
                    </div>
                    <div class="history-content">${escapeHtml(item.content)}</div>
                    <div class="history-ai-reply">
                        <i class="fas fa-robot" style="margin-right: 6px; color: #9BBF7A;"></i>
                        ${escapeHtml(item.aiReply)}
                    </div>
                </div>
            `).join('');
        }
    }

    // ========== 标签切换 ==========
    tagItems.forEach(tag => {
        tag.addEventListener('click', function () {
            tagItems.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            selectedTag = this.dataset.tag;
        });
    });

    // ========== 筛选切换 ==========
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderMessages(currentFilter);
        });
    });

    // ========== 发布按钮 ==========
    publishBtn.addEventListener('click', publishMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            publishMessage();
        }
    });

    // ========== 历史记录弹窗 ==========
    historyBtn.addEventListener('click', () => {
        renderHistory();
        historyModal.classList.add('show');
    });
    closeHistoryBtn.addEventListener('click', () => historyModal.classList.remove('show'));
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) historyModal.classList.remove('show');
    });

    // ========== 底部导航栏（保持不变） ==========
    const navItems = document.querySelectorAll('.nav-item');
    function setActiveNav(activeNavName) {
        navItems.forEach(item => {
            const itemName = item.getAttribute('data-nav');
            if (itemName === activeNavName) item.classList.add('active');
            else item.classList.remove('active');
        });
    }
    function highlightCurrentNav() {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'mainPart.html') setActiveNav('home');
        else if (currentPage === 'dataLook.html') setActiveNav('dashboard');
        else if (currentPage === 'seniorHole.html') setActiveNav('treehole');
        else if (currentPage === 'askQuestions.html') setActiveNav('survey');
    }
    function initBottomNav() {
        navItems.forEach(item => {
            item.removeEventListener('click', handleNavClick);
            item.addEventListener('click', handleNavClick);
        });
    }
    function handleNavClick(e) {
        e.stopPropagation();
        const navValue = this.getAttribute('data-nav');
        switch (navValue) {
            case 'home': location.href = 'mainPart.html'; break;
            case 'dashboard': location.href = 'dataLook.html'; break;
            case 'treehole': location.href = 'seniorHole.html'; break;
            case 'survey': location.href = 'askQuestions.html'; break;
        }
    }
    initBottomNav();
    highlightCurrentNav();

    // ========== 初始化加载数据 ==========
    loadMessagesFromServer();
})();