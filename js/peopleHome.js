(function() {
    // ========== API 配置 ==========
    const API_BASE = 'http://localhost:5000/api';
    
    // 获取当前登录用户
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = currentUser.id;
    
    // ========== 数据存储 ==========
    let childrenData = [];
    let parentData = {
        name: '家长',
        phone: '',
        relation: '妈妈',
        email: currentUser.email || ''
    };
    
    let editingChildId = null;
    
    // ========== 工具函数 ==========
    function showToast(msg, isSuccess = true) {
        let t = document.querySelector('.toast-msg');
        if (t) t.remove();
        t = document.createElement('div');
        t.className = 'toast-msg';
        t.innerHTML = `<i class="fas fa-${isSuccess ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
        t.style.background = isSuccess ? '#E8F0D8' : '#FCE8E8';
        t.style.color = isSuccess ? '#6B8C4A' : '#C06060';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000);
    }
    
    function calculateAge(birthDate) {
        if (!birthDate) return '';
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        if (age < 1) {
            const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
            return months + '个月';
        }
        return age + '岁';
    }
    
    // ========== API 请求 ==========
    async function fetchChildren() {
        try {
            const response = await fetch(`${API_BASE}/child/list/${userId}`);
            const result = await response.json();
            if (result.success) {
                childrenData = result.data.map(c => ({
                    ...c,
                    birth: c.birth_date,
                    relation: c.relation || '妈妈',
                    trainingCount: 0,
                    weekCount: 0
                }));
                renderChildrenList();
            }
        } catch (error) {
            console.error('获取孩子列表失败:', error);
        }
    }
    
    async function fetchUserInfo() {
        try {
            const response = await fetch(`${API_BASE}/auth/user/${userId}`);
            const result = await response.json();
            if (result.success && result.data) {
                parentData = {
                    name: result.data.nickname || '家长',
                    phone: result.data.phone || '',
                    relation: result.data.relation || '妈妈',
                    email: result.data.email || ''
                };
                updateParentDisplay();
            } else {
                const localUser = JSON.parse(localStorage.getItem('user') || '{}');
                parentData = {
                    name: localUser.nickname || '家长',
                    phone: localUser.phone || '',
                    relation: localUser.relation || '妈妈',
                    email: localUser.email || ''
                };
                updateParentDisplay();
            }
        } catch (error) {
            console.error('获取用户信息失败:', error);
            const localUser = JSON.parse(localStorage.getItem('user') || '{}');
            parentData = {
                name: localUser.nickname || '家长',
                phone: localUser.phone || '',
                relation: localUser.relation || '妈妈',
                email: localUser.email || ''
            };
            updateParentDisplay();
        }
    }
    
    async function saveChildToServer(childData, isEdit = false) {
        const url = isEdit 
            ? `${API_BASE}/child/update/${childData.id}`
            : `${API_BASE}/child/add`;
        const method = isEdit ? 'PUT' : 'POST';
        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...childData,
                    user_id: userId
                })
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('保存孩子失败:', error);
            return { success: false, message: '网络错误' };
        }
    }
    
    async function switchChildOnServer(childId) {
        try {
            await fetch(`${API_BASE}/child/switch/${childId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
        } catch (error) {
            console.error('切换孩子失败:', error);
        }
    }
    
    async function saveUserInfo() {
        if (!userId) {
            showToast('用户未登录', false);
            return { success: false, message: '用户未登录' };
        }
        try {
            const response = await fetch(`${API_BASE}/auth/user/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: parentData.name,
                    phone: parentData.phone
                })
            });
            const result = await response.json();
            if (result.success) {
                currentUser.nickname = parentData.name;
                currentUser.phone = parentData.phone;
                localStorage.setItem('user', JSON.stringify(currentUser));
            }
            return result;
        } catch (error) {
            console.error('保存用户信息失败:', error);
            return { success: false, message: '网络错误' };
        }
    }
    
    // ========== 更新UI ==========
    function updateParentDisplay() {
        const parentNameEl = document.getElementById('parentDisplayName');
        const parentPhoneEl = document.getElementById('parentDisplayPhone');
        if (parentNameEl) parentNameEl.textContent = parentData.name;
        if (parentPhoneEl) {
            const phoneDisplay = parentData.phone ? 
                parentData.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : 
                '未设置';
            parentPhoneEl.innerHTML = `<i class="fas fa-phone"></i><span>${phoneDisplay}</span>`;
        }
    }
    
    function renderChildrenList() {
        const container = document.getElementById('childrenList');
        if (childrenData.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: #B89A78;">
                    <i class="fas fa-child" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>还没有添加宝贝</p>
                    <p style="font-size: 12px; margin-top: 8px;">点击上方"添加宝贝"开始</p>
                </div>
            `;
            return;
        }
        container.innerHTML = '';
        childrenData.forEach(child => {
            const age = calculateAge(child.birth);
            const childItem = document.createElement('div');
            childItem.className = `child-item ${child.is_active ? 'active' : ''}`;
            childItem.setAttribute('data-child-id', child.id);
            let avatarHtml = '';
            if (child.avatar_type === 'custom' && child.avatar) {
                avatarHtml = `<img src="${child.avatar}" alt="${child.name}">`;
            } else {
                avatarHtml = `<i class="fas ${child.avatar || 'fa-face-smile'}"></i>`;
            }
            childItem.innerHTML = `
                <div class="child-avatar-medium">${avatarHtml}</div>
                <div class="child-detail">
                    <div class="child-name-row">
                        <span class="child-name">${child.name}</span>
                        ${child.is_active ? '<span class="child-badge">当前选中</span>' : ''}
                    </div>
                    <div class="child-info-row">
                        <span><i class="fas fa-cake-candles"></i> ${age}</span>
                        <span><i class="fas fa-${child.gender === '男' ? 'mars' : 'venus'}"></i> ${child.gender}</span>
                    </div>
                </div>
                <div class="child-actions">
                    <div class="child-action-btn" onclick="event.stopPropagation(); switchChild(${child.id})">
                        <i class="fas fa-check"></i>
                    </div>
                    <div class="child-action-btn" onclick="event.stopPropagation(); showEditChildModal(${child.id})">
                        <i class="fas fa-pen"></i>
                    </div>
                </div>
            `;
            childItem.addEventListener('click', function(e) {
                if (e.target.closest('.child-action-btn')) return;
                switchChild(child.id);
            });
            container.appendChild(childItem);
        });
    }
    
    // ========== 切换孩子 ==========
    async function switchChild(childId) {
        const child = childrenData.find(c => c.id === childId);
        if (!child) return;
        childrenData.forEach(c => c.is_active = (c.id === childId));
        renderChildrenList();
        await switchChildOnServer(childId);
        localStorage.setItem('starCompanionActiveChild', childId);
        showToast(`已切换到「${child.name}」`);
    }
    
    // ========== 返回 ==========
    function goBack() {
        location.href = 'mainPart.html';
    }
    
    // ========== 退出登录 ==========
    function handleLogout() {
        localStorage.removeItem('user');
        localStorage.removeItem('starCompanionActiveChild');
        showToast('正在退出登录...');
        setTimeout(() => {
            location.href = 'sign-inANDsign-up.html';
        }, 800);
    }
    
    // ========== 修改密码 ==========
    function showChangePasswordModal() {
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
        document.querySelectorAll('.toggle-password').forEach(icon => {
            icon.className = 'fas fa-eye-slash toggle-password';
            const input = document.getElementById(icon.dataset.target);
            if (input) input.type = 'password';
        });
        document.getElementById('changePasswordModal').classList.add('show');
    }
    
    function closeChangePasswordModal() {
        document.getElementById('changePasswordModal').classList.remove('show');
    }
    
    async function changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        if (!currentPassword) {
            showToast('请输入当前密码', false);
            return;
        }
        if (!newPassword) {
            showToast('请输入新密码', false);
            return;
        }
        if (newPassword.length < 6) {
            showToast('新密码长度至少6位', false);
            return;
        }
        if (newPassword !== confirmNewPassword) {
            showToast('两次输入的新密码不一致', false);
            return;
        }
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = currentUser.id;
        try {
            const response = await fetch(`${API_BASE}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
            const result = await response.json();
            if (result.success) {
                showToast('密码修改成功，请重新登录');
                closeChangePasswordModal();
                setTimeout(() => {
                    localStorage.removeItem('user');
                    window.location.href = 'sign-inANDsign-up.html';
                }, 1500);
            } else {
                showToast(result.message || '修改失败', false);
            }
        } catch (error) {
            showToast('网络错误，请稍后重试', false);
        }
    }
    
    // ========== 修改手机号 ==========
    let phoneCodeTimer = null;
    let phoneCodeCountdown = 0;
    
    function showChangePhoneModal() {
        document.getElementById('newPhoneNumber').value = '';
        document.getElementById('phoneSmsCode').value = '';
        document.getElementById('changePhoneModal').classList.add('show');
    }
    
    function closeChangePhoneModal() {
        document.getElementById('changePhoneModal').classList.remove('show');
        if (phoneCodeTimer) {
            clearInterval(phoneCodeTimer);
            phoneCodeTimer = null;
        }
    }
    
    async function sendPhoneCode() {
        const phone = document.getElementById('newPhoneNumber').value;
        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
            showToast('请输入正确的手机号', false);
            return;
        }
        showToast('验证码已发送（模拟）');
        const btn = document.getElementById('getPhoneCodeBtn');
        btn.disabled = true;
        phoneCodeCountdown = 60;
        phoneCodeTimer = setInterval(() => {
            phoneCodeCountdown--;
            btn.innerText = `${phoneCodeCountdown}秒后重试`;
            if (phoneCodeCountdown <= 0) {
                clearInterval(phoneCodeTimer);
                phoneCodeTimer = null;
                btn.disabled = false;
                btn.innerText = '获取验证码';
            }
        }, 1000);
    }
    
    async function changePhone() {
        const phone = document.getElementById('newPhoneNumber').value;
        const code = document.getElementById('phoneSmsCode').value;
        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
            showToast('请输入正确的手机号', false);
            return;
        }
        if (!code || code.length !== 6) {
            showToast('请输入6位验证码', false);
            return;
        }
        if (code !== '123456') {
            showToast('验证码错误', false);
            return;
        }
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = currentUser.id;
        try {
            const response = await fetch(`${API_BASE}/auth/update-phone`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, phone: phone })
            });
            const result = await response.json();
            if (result.success) {
                currentUser.phone = phone;
                localStorage.setItem('user', JSON.stringify(currentUser));
                parentData.phone = phone;
                updateParentDisplay();
                showToast('手机号修改成功');
                closeChangePhoneModal();
            } else {
                showToast(result.message || '修改失败', false);
            }
        } catch (error) {
            showToast('网络错误', false);
        }
    }
    
    // ========== 账号与安全弹窗 ==========
    function showAccountSecurityModal() {
        document.getElementById('accountSecurityModal').classList.add('show');
    }
    function closeAccountSecurityModal() {
        document.getElementById('accountSecurityModal').classList.remove('show');
    }
    function showChangePasswordFromSecurity() {
        closeAccountSecurityModal();
        showChangePasswordModal();
    }
    function showChangePhoneFromSecurity() {
        closeAccountSecurityModal();
        showChangePhoneModal();
    }
    
    // ========== 编辑个人资料 ==========
    function showEditProfileModal() {
        document.getElementById('editParentName').value = parentData.name;
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const savedAvatar = user.avatar;
        const editIcon = document.getElementById('editProfileAvatarIcon');
        const editImg = document.getElementById('editProfileAvatarImg');
        if (savedAvatar) {
            editIcon.style.display = 'none';
            editImg.style.display = 'block';
            editImg.src = savedAvatar;
        } else {
            editIcon.style.display = 'block';
            editImg.style.display = 'none';
        }
        document.getElementById('editProfileModal').classList.add('show');
    }
    
    function closeEditProfileModal() {
        document.getElementById('editProfileModal').classList.remove('show');
    }
    
    async function saveProfile() {
        const nameInput = document.getElementById('editParentName');
        const phoneInput = document.getElementById('editParentPhone');
        if (!nameInput.value.trim()) {
            showToast('请输入家长称呼', false);
            return;
        }
        parentData.name = nameInput.value.trim();
        parentData.phone = phoneInput.value.trim();
        const result = await saveUserInfo();
        if (result.success) {
            updateParentDisplay();
            closeEditProfileModal();
            showToast('✨ 个人资料已保存');
        } else {
            showToast(result.message || '保存失败', false);
        }
    }
    
    // ========== 添加/编辑孩子 ==========
    function showAddChildModal() {
        document.getElementById('newChildName').value = '';
        document.getElementById('newChildBirth').value = '';
        document.getElementById('newChildGender').value = '男';
        document.getElementById('newChildCustomAvatarData').value = '';
        document.querySelectorAll('#newChildAvatarSelector .avatar-option').forEach((opt, i) => {
            opt.classList.toggle('selected', i === 0);
        });
        document.querySelectorAll('#newChildFocusTags .tag-option').forEach((tag, i) => {
            tag.classList.toggle('selected', i === 0);
        });
        document.getElementById('newChildCustomAvatarPreview').style.display = 'none';
        document.getElementById('newChildAvatarUpload').style.display = 'flex';
        document.getElementById('addChildModal').classList.add('show');
    }
    
    function closeAddChildModal() {
        document.getElementById('addChildModal').classList.remove('show');
    }
    
    async function addChild() {
        const name = document.getElementById('newChildName').value.trim();
        if (!name) {
            showToast('请输入宝贝昵称', false);
            return;
        }
        const birthDate = document.getElementById('newChildBirth').value;
        const relation = document.getElementById('newChildRelation').value;
        const customAvatarData = document.getElementById('newChildCustomAvatarData').value;
        let avatarType = 'icon';
        let avatar = 'fa-face-smile';
        if (customAvatarData) {
            avatarType = 'custom';
            avatar = customAvatarData;
        } else {
            const selectedAvatar = document.querySelector('#newChildAvatarSelector .avatar-option.selected');
            avatar = selectedAvatar ? selectedAvatar.dataset.avatar : 'fa-face-smile';
        }
        const selectedTags = [];
        document.querySelectorAll('#newChildFocusTags .tag-option.selected').forEach(tag => {
            selectedTags.push(tag.dataset.tag);
        });
        const result = await saveChildToServer({
            name: name,
            gender: document.getElementById('newChildGender').value,
            birth_date: birthDate || null,
            relation: relation,
            avatar_type: avatarType,
            avatar: avatar,
            focus_tags: selectedTags,
            note: document.getElementById('newChildNote').value.trim()
        });
        if (result.success) {
            closeAddChildModal();
            await fetchChildren();
            showToast(`宝贝「${name}」已添加`);
        } else {
            showToast(result.message || '添加失败', false);
        }
    }
    
    function showEditChildModal(childId) {
        editingChildId = childId;
        const child = childrenData.find(c => c.id === childId);
        if (!child) return;
        document.getElementById('editChildId').value = childId;
        document.getElementById('editChildName').value = child.name;
        document.getElementById('editChildBirth').value = child.birth || '';
        document.getElementById('editChildGender').value = child.gender;
        document.getElementById('editChildRelation').value = child.relation || '妈妈';
        document.getElementById('editChildCustomAvatarData').value = child.avatar_type === 'custom' ? child.avatar : '';
        if (child.avatar_type === 'custom' && child.avatar) {
            document.getElementById('editChildCustomAvatarImg').src = child.avatar;
            document.getElementById('editChildCustomAvatarPreview').style.display = 'flex';
            document.getElementById('editChildAvatarUpload').style.display = 'none';
            document.querySelectorAll('#editChildAvatarSelector .avatar-option').forEach(opt => {
                opt.classList.remove('selected');
            });
        } else {
            document.getElementById('editChildCustomAvatarPreview').style.display = 'none';
            document.getElementById('editChildAvatarUpload').style.display = 'flex';
            document.querySelectorAll('#editChildAvatarSelector .avatar-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.avatar === child.avatar);
            });
        }
        document.querySelectorAll('#editChildFocusTags .tag-option').forEach(tag => {
            const focusTags = child.focus_tags || [];
            tag.classList.toggle('selected', focusTags.includes(tag.dataset.tag));
        });
        document.getElementById('editChildModal').classList.add('show');
    }
    
    function closeEditChildModal() {
        document.getElementById('editChildModal').classList.remove('show');
        editingChildId = null;
    }
    
    async function saveChildEdit() {
        const childId = parseInt(document.getElementById('editChildId').value);
        const name = document.getElementById('editChildName').value.trim();
        if (!name) {
            showToast('请输入宝贝昵称', false);
            return;
        }
        const relation = document.getElementById('editChildRelation').value;
        const customAvatarData = document.getElementById('editChildCustomAvatarData').value;
        let avatarType = 'icon';
        let avatar = 'fa-face-smile';
        if (customAvatarData) {
            avatarType = 'custom';
            avatar = customAvatarData;
        } else {
            const selectedAvatar = document.querySelector('#editChildAvatarSelector .avatar-option.selected');
            avatar = selectedAvatar ? selectedAvatar.dataset.avatar : 'fa-face-smile';
        }
        const selectedTags = [];
        document.querySelectorAll('#editChildFocusTags .tag-option.selected').forEach(tag => {
            selectedTags.push(tag.dataset.tag);
        });
        const result = await saveChildToServer({
            id: childId,
            name: name,
            gender: document.getElementById('editChildGender').value,
            birth_date: document.getElementById('editChildBirth').value || null,
            relation: relation,
            avatar_type: avatarType,
            avatar: avatar,
            focus_tags: selectedTags
        }, true);
        if (result.success) {
            closeEditChildModal();
            await fetchChildren();
            showToast(`宝贝「${name}」信息已更新`);
        } else {
            showToast(result.message || '更新失败', false);
        }
    }
    
    // ========== 头像上传 ==========
    function triggerAvatarUpload() {
        closeAvatarModal();
        document.getElementById('avatarUploadInput').click();
    }
    
    async function handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showToast('图片大小不能超过2MB', false);
            return;
        }
        if (!file.type.startsWith('image/')) {
            showToast('请选择图片文件', false);
            return;
        }
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64Avatar = e.target.result;
            updateAvatarDisplay(base64Avatar);
            const result = await saveAvatarToServer(base64Avatar);
            if (result.success) {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.avatar = base64Avatar;
                localStorage.setItem('user', JSON.stringify(user));
                showToast('✨ 头像已更新');
            } else {
                showToast(result.message || '保存失败', false);
            }
        };
        reader.readAsDataURL(file);
    }
    
    function updateAvatarDisplay(base64Avatar) {
        const avatarIcon = document.getElementById('parentAvatarIcon');
        const avatarImg = document.getElementById('parentAvatarImg');
        if (avatarIcon) avatarIcon.style.display = 'none';
        if (avatarImg) {
            avatarImg.src = base64Avatar;
            avatarImg.style.display = 'block';
        }
        const modalIcon = document.getElementById('modalAvatarIcon');
        const modalImg = document.getElementById('modalAvatarImg');
        if (modalIcon) modalIcon.style.display = 'none';
        if (modalImg) {
            modalImg.src = base64Avatar;
            modalImg.style.display = 'block';
        }
    }
    
    async function saveAvatarToServer(avatarData) {
        if (!userId) return { success: false, message: '用户未登录' };
        try {
            const response = await fetch(`${API_BASE}/auth/update-avatar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, avatar: avatarData })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: '网络错误' };
        }
    }
    
    function loadSavedAvatar() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const savedAvatar = user.avatar;
        if (savedAvatar) {
            const avatarIcon = document.getElementById('parentAvatarIcon');
            const avatarImg = document.getElementById('parentAvatarImg');
            if (avatarIcon) avatarIcon.style.display = 'none';
            if (avatarImg) {
                avatarImg.src = savedAvatar;
                avatarImg.style.display = 'block';
            }
            const modalIcon = document.getElementById('modalAvatarIcon');
            const modalImg = document.getElementById('modalAvatarImg');
            if (modalIcon) modalIcon.style.display = 'none';
            if (modalImg) {
                modalImg.src = savedAvatar;
                modalImg.style.display = 'block';
            }
        }
    }
    
    // 头像弹窗
    function showAvatarModal() {
        const avatarIcon = document.getElementById('parentAvatarIcon');
        const avatarImg = document.getElementById('parentAvatarImg');
        const parentName = document.getElementById('parentDisplayName').textContent;
        const modalIcon = document.getElementById('modalAvatarIcon');
        const modalImg = document.getElementById('modalAvatarImg');
        const modalName = document.getElementById('modalParentName');
        if (modalName) modalName.textContent = parentName;
        if (avatarImg && avatarImg.style.display === 'block' && avatarImg.src) {
            modalIcon.style.display = 'none';
            modalImg.style.display = 'block';
            modalImg.src = avatarImg.src;
        } else {
            modalIcon.style.display = 'block';
            modalImg.style.display = 'none';
        }
        document.getElementById('avatarActionModal').classList.add('show');
    }
    
    function closeAvatarModal() {
        document.getElementById('avatarActionModal').classList.remove('show');
    }
    
    function viewFullAvatar() {
        const avatarImg = document.getElementById('parentAvatarImg');
        const fullImg = document.getElementById('fullAvatarImg');
        if (avatarImg && avatarImg.style.display === 'block' && avatarImg.src) {
            fullImg.src = avatarImg.src;
            document.getElementById('fullAvatarModal').classList.add('show');
            closeAvatarModal();
        } else {
            showToast('还没有设置头像', false);
        }
    }
    
    function closeFullAvatarModal() {
        document.getElementById('fullAvatarModal').classList.remove('show');
    }
    
    // ========== 注销账户（核心修改） ==========
    function showDeleteModal() {
        document.getElementById('deleteModal').classList.add('show');
        // 清空输入框
        const confirmInput = document.getElementById('deleteConfirmInput');
        if (confirmInput) confirmInput.value = '';
    }
    
    function closeDeleteModal() {
        document.getElementById('deleteModal').classList.remove('show');
    }
    
    async function confirmDeleteAccount() {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = currentUser.id;

    if (!userId) {
        showToast('用户信息错误，请重新登录', false);
        return;
    }

    // 直接执行注销，无需输入确认文字
    const confirmBtn = document.querySelector('#deleteModal .delete-confirm');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = '注销中...';
    confirmBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/auth/delete-account`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });

        let result;
        try {
            result = await response.json();
        } catch (e) {
            result = { success: false, message: '服务器响应异常' };
        }

        if (response.ok && result.success) {
            showToast('账户已注销，感谢曾经的陪伴');
            closeDeleteModal();
            localStorage.removeItem('user');
            localStorage.removeItem('starCompanionActiveChild');
            setTimeout(() => {
                window.location.href = 'sign-inANDsign-up.html';
            }, 1500);
        } else {
            showToast(result.message || '注销失败，请稍后重试', false);
            confirmBtn.textContent = originalText;
            confirmBtn.disabled = false;
        }
    } catch (error) {
        console.error('注销请求失败:', error);
        showToast('网络错误，请检查网络连接后重试', false);
        confirmBtn.textContent = originalText;
        confirmBtn.disabled = false;
    }
}
    
    // ========== 菜单事件绑定 ==========
    function bindMenuEvents() {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach((item) => {
            item.addEventListener('click', function() {
                const title = this.querySelector('.menu-title')?.textContent || '';
                if (title === '账号与安全') {
                    showAccountSecurityModal();
                } else if (title === '隐私政策') {
                    showPrivacyPolicy();
                } else if (title === '关于星伴') {
                    showAboutModal();
                }
            });
        });
    }
    
    function showPrivacyPolicy() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay show';
        modal.id = 'privacyModal';
        modal.onclick = function(e) { if (e.target === this) this.remove(); };
        modal.innerHTML = `
            <div class="form-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fas fa-lock" style="color: #D9A066; margin-right: 8px;"></i>隐私政策</h3>
                    <div class="close-modal-btn" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
                <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
                    <p style="margin-bottom: 12px; color: #5E422C;"><strong>星伴 · 暖愈成长空间</strong></p>
                    <p style="margin-bottom: 12px; color: #6C4F32; line-height: 1.6;">我们重视您的隐私。所有数据仅存储在您的本地设备中，我们不会上传或分享您的个人信息。</p>
                    <p style="margin-bottom: 12px; color: #6C4F32; line-height: 1.6;"><strong>数据存储：</strong>宝贝档案、训练记录等数据均保存在本地，您可以随时清除。</p>
                    <p style="margin-bottom: 12px; color: #6C4F32; line-height: 1.6;"><strong>邮箱验证：</strong>仅用于账号安全和密码找回，不会用于其他用途。</p>
                    <p style="color: #6C4F32; line-height: 1.6;">如有疑问，请联系我们：2503581489@qq.com</p>
                </div>
                <div class="modal-actions" style="margin-top: 20px;">
                    <button class="modal-btn confirm" onclick="this.closest('.modal-overlay').remove()">我知道了</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    function showAboutModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay show';
        modal.onclick = function(e) { if (e.target === this) this.remove(); };
        modal.innerHTML = `
            <div class="form-modal" onclick="event.stopPropagation()" style="text-align: center;">
                <div class="modal-header">
                    <h3><i class="fas fa-star" style="color: #D9A066; margin-right: 8px;"></i>关于星伴</h3>
                    <div class="close-modal-btn" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
                <div style="padding: 20px 0;">
                    <div style="font-size: 48px; color: #D9A066; margin-bottom: 16px;">
                        <i class="fas fa-star"></i>
                    </div>
                    <p style="font-size: 24px; font-weight: 700; color: #5E422C; margin-bottom: 8px;">星伴</p>
                    <p style="font-size: 14px; color: #9B846C; margin-bottom: 20px;">Stellar Companion</p>
                    <p style="color: #6C4F32; margin-bottom: 8px;">版本 2.1.0</p>
                    <p style="color: #B89A78; font-size: 13px;">暖愈成长空间 · 陪伴每一刻</p>
                </div>
                <div class="modal-actions">
                    <button class="modal-btn confirm" onclick="this.closest('.modal-overlay').remove()">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    function initPasswordToggle() {
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('toggle-password')) {
                const targetId = e.target.dataset.target;
                const input = document.getElementById(targetId);
                if (input) {
                    const isPassword = input.type === 'password';
                    input.type = isPassword ? 'text' : 'password';
                    e.target.className = isPassword ? 'fas fa-eye toggle-password' : 'fas fa-eye-slash toggle-password';
                }
            }
        });
    }
    
    // 自定义头像上传（新孩子/编辑孩子）
    window.handleNewChildAvatarUpload = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showToast('图片大小不能超过2MB', false);
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Avatar = e.target.result;
            document.getElementById('newChildCustomAvatarData').value = base64Avatar;
            document.getElementById('newChildCustomAvatarImg').src = base64Avatar;
            document.getElementById('newChildCustomAvatarPreview').style.display = 'flex';
            document.getElementById('newChildAvatarUpload').style.display = 'none';
            document.querySelectorAll('#newChildAvatarSelector .avatar-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            showToast('图片已选择');
        };
        reader.readAsDataURL(file);
    };
    
    window.handleEditChildAvatarUpload = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showToast('图片大小不能超过2MB', false);
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Avatar = e.target.result;
            document.getElementById('editChildCustomAvatarData').value = base64Avatar;
            document.getElementById('editChildCustomAvatarImg').src = base64Avatar;
            document.getElementById('editChildCustomAvatarPreview').style.display = 'flex';
            document.getElementById('editChildAvatarUpload').style.display = 'none';
            document.querySelectorAll('#editChildAvatarSelector .avatar-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            showToast('图片已选择');
        };
        reader.readAsDataURL(file);
    };
    
    window.removeNewChildCustomAvatar = function() {
        document.getElementById('newChildCustomAvatarPreview').style.display = 'none';
        document.getElementById('newChildAvatarUpload').style.display = 'flex';
        document.getElementById('newChildCustomAvatarData').value = '';
        document.getElementById('newChildCustomAvatarInput').value = '';
        document.querySelectorAll('#newChildAvatarSelector .avatar-option').forEach((opt, i) => {
            opt.classList.toggle('selected', i === 0);
        });
    };
    
    window.removeEditChildCustomAvatar = function() {
        document.getElementById('editChildCustomAvatarPreview').style.display = 'none';
        document.getElementById('editChildAvatarUpload').style.display = 'flex';
        document.getElementById('editChildCustomAvatarData').value = '';
        document.getElementById('editChildCustomAvatarInput').value = '';
        const child = childrenData.find(c => c.id === editingChildId);
        if (child) {
            document.querySelectorAll('#editChildAvatarSelector .avatar-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.avatar === child.avatar);
            });
        }
    };
    
    // 暴露全局函数
    window.goBack = goBack;
    window.handleLogout = handleLogout;
    window.showEditProfileModal = showEditProfileModal;
    window.closeEditProfileModal = closeEditProfileModal;
    window.saveProfile = saveProfile;
    window.showAddChildModal = showAddChildModal;
    window.closeAddChildModal = closeAddChildModal;
    window.addChild = addChild;
    window.showEditChildModal = showEditChildModal;
    window.closeEditChildModal = closeEditChildModal;
    window.saveChildEdit = saveChildEdit;
    window.switchChild = switchChild;
    window.showChangePasswordModal = showChangePasswordModal;
    window.closeChangePasswordModal = closeChangePasswordModal;
    window.changePassword = changePassword;
    window.showChangePhoneModal = showChangePhoneModal;
    window.closeChangePhoneModal = closeChangePhoneModal;
    window.sendPhoneCode = sendPhoneCode;
    window.changePhone = changePhone;
    window.showAccountSecurityModal = showAccountSecurityModal;
    window.closeAccountSecurityModal = closeAccountSecurityModal;
    window.showChangePasswordFromSecurity = showChangePasswordFromSecurity;
    window.showChangePhoneFromSecurity = showChangePhoneFromSecurity;
    window.showAvatarModal = showAvatarModal;
    window.closeAvatarModal = closeAvatarModal;
    window.triggerAvatarUpload = triggerAvatarUpload;
    window.handleAvatarUpload = handleAvatarUpload;
    window.viewFullAvatar = viewFullAvatar;
    window.closeFullAvatarModal = closeFullAvatarModal;
    window.showDeleteModal = showDeleteModal;
    window.closeDeleteModal = closeDeleteModal;
    window.confirmDeleteAccount = confirmDeleteAccount;
    
    // ========== 头像和标签点击事件委托 ==========
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('avatar-option') || e.target.closest('.avatar-option')) {
            const opt = e.target.classList.contains('avatar-option') ? e.target : e.target.closest('.avatar-option');
            const selector = opt.closest('.avatar-selector');
            selector.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        }
        if (e.target.classList.contains('tag-option') || e.target.closest('.tag-option')) {
            const tag = e.target.classList.contains('tag-option') ? e.target : e.target.closest('.tag-option');
            tag.classList.toggle('selected');
        }
        // 点击通知弹窗外部关闭
        const popup = document.getElementById('notifPopup');
        const bell = document.getElementById('notifBell');
        if (popup && popup.classList.contains('show') && !popup.contains(e.target) && !bell.contains(e.target)) {
            popup.classList.remove('show');
        }
    });

    // ========== 通知功能 ==========
    async function fetchNotifications() {
        try {
            const resp = await fetch(`${API_BASE}/auth/notifications/${userId}`);
            const d = await resp.json();
            if (d.success && d.data) {
                const badge = document.getElementById('notifBadge');
                if (d.data.unread_count > 0) {
                    badge.textContent = d.data.unread_count > 99 ? '99+' : d.data.unread_count;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
                renderNotifList(d.data.list);
            }
        } catch (e) { console.warn('获取通知失败', e); }
    }

    function renderNotifList(list) {
        const container = document.getElementById('notifList');
        if (!list || list.length === 0) {
            container.innerHTML = '<div class="notif-empty">暂无通知</div>';
            return;
        }
        container.innerHTML = list.map(n => {
            const time = new Date(n.created_at).toLocaleDateString('zh-CN');
            return `<div class="notif-item ${n.is_read ? 'read' : 'unread'}" onclick="markOneRead(${n.id})">
                <div class="notif-title"><span class="notif-dot"></span>${n.title}</div>
                <div class="notif-content">${n.content || ''}</div>
                <div class="notif-time">${time}</div>
            </div>`;
        }).join('');
    }

    function showNotifPopup() {
        const popup = document.getElementById('notifPopup');
        popup.classList.toggle('show');
        if (popup.classList.contains('show')) {
            fetchNotifications();
        }
    }

    async function markOneRead(id) {
        await fetch(`${API_BASE}/auth/notifications/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        fetchNotifications();
    }

    async function markAllRead() {
        await fetch(`${API_BASE}/auth/notifications/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, mark_all: true })
        });
        fetchNotifications();
    }

    // ========== 通知设置 ==========
    function showNotifSettingsModal() {
        const settings = JSON.parse(localStorage.getItem('notifSettings') || '{}');
        document.getElementById('toggleTraining').checked = settings.training !== false;
        document.getElementById('toggleWeekly').checked = settings.weekly !== false;
        document.getElementById('toggleTreehole').checked = settings.treehole !== false;
        document.getElementById('toggleSystem').checked = settings.system !== false;
        document.getElementById('notifSettingsModal').classList.add('show');
    }

    function closeNotifSettingsModal() {
        document.getElementById('notifSettingsModal').classList.remove('show');
    }

    function saveNotifSettings() {
        const settings = {
            training: document.getElementById('toggleTraining').checked,
            weekly: document.getElementById('toggleWeekly').checked,
            treehole: document.getElementById('toggleTreehole').checked,
            system: document.getElementById('toggleSystem').checked
        };
        localStorage.setItem('notifSettings', JSON.stringify(settings));
    }

    // ========== 帮助与反馈 ==========
    function showHelpModal() {
        document.getElementById('helpModal').classList.add('show');
    }

    function closeHelpModal() {
        document.getElementById('helpModal').classList.remove('show');
    }

    function toggleFAQ(el) {
        el.classList.toggle('open');
    }

    function submitFeedback() {
        const content = document.getElementById('feedbackContent').value.trim();
        if (!content) { showToast('请输入反馈内容', false); return; }
        // 发送到后端反馈接口
        fetch(`${API_BASE}/auth/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, content: content })
        }).then(r => r.json()).then(d => {
            if (d.success) {
                showToast('感谢你的反馈！');
                document.getElementById('feedbackContent').value = '';
            } else {
                showToast('提交失败，请重试', false);
            }
        }).catch(() => showToast('网络错误', false));
    }

    // 暴露全局函数
    window.showNotifPopup = showNotifPopup;
    window.markOneRead = markOneRead;
    window.markAllRead = markAllRead;
    window.showNotifSettingsModal = showNotifSettingsModal;
    window.closeNotifSettingsModal = closeNotifSettingsModal;
    window.saveNotifSettings = saveNotifSettings;
    window.showHelpModal = showHelpModal;
    window.closeHelpModal = closeHelpModal;
    window.toggleFAQ = toggleFAQ;
    window.submitFeedback = submitFeedback;

    // ========== 初始化 ==========
    async function init() {
        if (!userId) {
            showToast('请先登录', false);
            setTimeout(() => {
                location.href = 'sign-inANDsign-up.html';
            }, 1000);
            return;
        }
        await fetchUserInfo();
        await fetchChildren();
        loadSavedAvatar();
        bindMenuEvents();
        initPasswordToggle();
        fetchNotifications();
    }
    
    init();
})();