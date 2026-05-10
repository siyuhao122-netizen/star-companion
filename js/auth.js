(function() {
    // ========== API 配置 ==========
    const API_BASE = 'http://localhost:5000/api';

    // ========== 工具函数 ==========
    function validateEmail(email) { return Validator.isEmail(email); }
    function validatePassword(password) { return Validator.isPassword(password); }
    function validateSmsCode(code) { return Validator.isCode(code); }
    function validateNickname(nickname) { return Validator.isNickname(nickname); }

    function showFieldError(inputId, errorId, message) {
        const input = document.getElementById(inputId);
        const error = document.getElementById(errorId);
        if (input) input.classList.add('error');
        if (error) {
            error.textContent = message;
            error.classList.add('show');
        }
    }

    function clearFieldError(inputId, errorId) {
        const input = document.getElementById(inputId);
        const error = document.getElementById(errorId);
        if (input) input.classList.remove('error');
        if (error) error.classList.remove('show');
    }

    function showToast(msg, bg = '#FEF3E2') {
        let existing = document.querySelector('.toast-message');
        if (existing) existing.remove();
        let toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.innerHTML = `<i class="fas fa-star"></i> ${msg}`;
        toast.style.background = bg;
        document.querySelector('.auth-container').appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    // ========== API 请求 ==========
    async function sendVerificationCode(email, type) {
        try {
            const response = await fetch(`${API_BASE}/auth/send-verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, type })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: '网络错误，请稍后重试' };
        }
    }

  async function registerUser(userData) {
    try {
        console.log('📤 发送注册请求:', userData);
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        console.log('📥 注册响应:', data);
        return data;
    } catch (error) {
        console.error('注册错误:', error);
        return { success: false, message: '网络错误，请稍后重试' };
    }
}

    async function loginUser(loginData) {
        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });
            const data = await response.json();
            if (data.success) {
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            return data;
        } catch (error) {
            return { success: false, message: '网络错误，请稍后重试' };
        }
    }

    // ========== 状态变量 ==========
    let currentTab = 'login';
    let loginMethod = 'password';
    let regStep = 1;
    let selectedGender = 'boy';
    let selectedAvatar = 'bear';
    let customAvatarUrl = '';
    let codeCountdown = 0;
    let codeTimer = null;

    // DOM 元素
    const authTabs = document.getElementById('authTabs');
    const loginStep = document.getElementById('loginStep');
    const registerStep = document.getElementById('registerStep');
    const formTitle = document.getElementById('formTitle');
    const formSubtitle = document.getElementById('formSubtitle');
    const passwordLogin = document.getElementById('passwordLogin');
    const codeLogin = document.getElementById('codeLogin');
    const passwordMethodBtn = document.getElementById('passwordMethodBtn');
    const codeMethodBtn = document.getElementById('codeMethodBtn');

    // 记住账号
    const rememberCheckbox = document.getElementById('rememberMe');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');

    const savedEmail = localStorage.getItem('savedEmail');
    const savedPassword = localStorage.getItem('savedPassword');
    if (savedEmail && loginEmailInput) {
        loginEmailInput.value = savedEmail;
        if (loginPasswordInput) loginPasswordInput.value = savedPassword || '';
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }

    // 出生年月下拉初始化
    const yearSelect = document.getElementById('birthYear');
    const monthSelect = document.getElementById('birthMonth');
    if (yearSelect && monthSelect) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y >= currentYear - 10; y--) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y + '年';
            if (y === currentYear - 2) option.selected = true;
            yearSelect.appendChild(option);
        }
        for (let m = 1; m <= 12; m++) {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m + '月';
            if (m === 6) option.selected = true;
            monthSelect.appendChild(option);
        }
    }

    // ========== 切换登录方式 ==========
    function setActiveMethod(method) {
        loginMethod = method;
        if (method === 'password') {
            passwordMethodBtn?.classList.add('active');
            codeMethodBtn?.classList.remove('active');
            if (passwordLogin) passwordLogin.style.display = 'block';
            if (codeLogin) codeLogin.style.display = 'none';
        } else {
            codeMethodBtn?.classList.add('active');
            passwordMethodBtn?.classList.remove('active');
            if (passwordLogin) passwordLogin.style.display = 'none';
            if (codeLogin) codeLogin.style.display = 'block';
        }
    }
    if (passwordMethodBtn) passwordMethodBtn.addEventListener('click', () => setActiveMethod('password'));
    if (codeMethodBtn) codeMethodBtn.addEventListener('click', () => setActiveMethod('code'));

    // ========== 切换标签页 ==========
    function switchTab(tab) {
        currentTab = tab;
        authTabs?.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        authTabs?.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
        if (tab === 'login') {
            loginStep?.classList.add('active');
            registerStep?.classList.remove('active');
            if (formTitle) formTitle.innerText = '家长登录';
            if (formSubtitle) formSubtitle.innerText = '登录后查看宝贝的成长数据';
        } else {
            loginStep?.classList.remove('active');
            registerStep?.classList.add('active');
            if (formTitle) formTitle.innerText = '注册账号';
            if (formSubtitle) formSubtitle.innerText = '创建账号，开始陪伴之旅';
            showRegStep(1);
        }
    }
    authTabs?.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab-btn');
        if (!tab) return;
        switchTab(tab.dataset.tab);
    });

    // ========== 密码显示切换 ==========
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const input = document.getElementById(targetId);
            if (input) {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                this.className = isPassword ? 'fas fa-eye toggle-password' : 'fas fa-eye-slash toggle-password';
            }
        });
    });

    // ========== 性别选择 ==========
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedGender = this.dataset.gender;
        });
    });

    // ========== 预设头像选择 ==========
    document.querySelectorAll('.preset-avatar').forEach(opt => {
        opt.addEventListener('click', function() {
            document.querySelectorAll('.preset-avatar').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            selectedAvatar = this.dataset.avatar;
            customAvatarUrl = '';

            const preview = document.getElementById('avatarPreview');
            if (preview) {
                const icon = this.querySelector('i');
                preview.innerHTML = '';
                if (icon) {
                    const cloneIcon = icon.cloneNode(true);
                    cloneIcon.style.fontSize = '30px';
                    preview.appendChild(cloneIcon);
                }
            }
        });
    });

    // ========== 自定义头像上传 ==========
    const avatarUpload = document.getElementById('avatarUploadInput');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    customAvatarUrl = ev.target.result;
                    selectedAvatar = 'custom';
                    document.querySelectorAll('.preset-avatar').forEach(o => o.classList.remove('active'));
                    const preview = document.getElementById('avatarPreview');
                    if (preview) {
                        preview.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // ========== 兴趣标签 ==========
    document.querySelectorAll('.interest-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    });

    // ========== 倒计时 ==========
    function startCodeCountdown(btn) {
        if (codeTimer) clearInterval(codeTimer);
        codeCountdown = 60;
        btn.disabled = true;
        const originalText = btn.innerText;
        codeTimer = setInterval(() => {
            codeCountdown--;
            btn.innerText = `${codeCountdown}秒后重试`;
            if (codeCountdown <= 0) {
                clearInterval(codeTimer);
                codeTimer = null;
                btn.disabled = false;
                btn.innerText = originalText;
            }
        }, 1000);
    }

    // ========== 注册步骤控制 ==========
    function showRegStep(step) {
        regStep = step;
        ['regStep1', 'regStep2', 'regStep3', 'regStep4'].forEach((id, i) => {
            const el = document.getElementById(id);
            if (el) el.style.display = i + 1 === step ? 'block' : 'none';
        });
    }

    // ========== 清除输入错误 ==========
    const inputErrorPairs = [
        ['loginEmail', 'loginEmailError'],
        ['loginPassword', 'loginPasswordError'],
        ['codeEmail', 'codeEmailError'],
        ['smsCode', 'smsCodeError'],
        ['parentNickname', 'parentNicknameError'],
        ['regEmail', 'regEmailError'],
        ['regEmailCode', 'regEmailCodeError'],
        ['regPassword', 'regPasswordError'],
        ['regConfirmPassword', 'regConfirmPasswordError'],
        ['regChildName', 'regChildNameError']
    ];
    inputErrorPairs.forEach(([inputId, errorId]) => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', () => clearFieldError(inputId, errorId));
        }
    });

    // ========== 密码登录 ==========
    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail')?.value.trim();
        const password = document.getElementById('loginPassword')?.value;

        let isValid = true;
        if (!validateEmail(email)) {
            showFieldError('loginEmail', 'loginEmailError', '请输入正确的QQ邮箱');
            isValid = false;
        }
        if (!validatePassword(password)) {
            showFieldError('loginPassword', 'loginPasswordError', '密码长度至少6位');
            isValid = false;
        }
        if (!isValid) return;

        if (rememberCheckbox?.checked) {
            localStorage.setItem('savedEmail', email);
            localStorage.setItem('savedPassword', password);
        } else {
            localStorage.removeItem('savedEmail');
            localStorage.removeItem('savedPassword');
        }

        const result = await loginUser({ email, password, loginType: 'password' });
        
         if (result.success) {
        // ========== 在这里修改 ==========
        localStorage.setItem('user', JSON.stringify({
            id: result.user.id,
            email: result.user.email,
            nickname: result.user.nickname,
            avatar: result.user.avatar,
            phone: result.user.phone || '',
            relation: result.user.relation || ''
        }));
            showToast('✨ 登录成功！正在进入星伴世界...', '#E8F0D8');
            setTimeout(() => { window.location.href = 'mainPart.html'; }, 800);
        } else {
            showToast(result.message, '#FCE8E8');
        }
    });

    // ========== 获取验证码（登录用） ==========
    document.getElementById('getSmsCodeBtn')?.addEventListener('click', async function() {
        const email = document.getElementById('codeEmail')?.value.trim();
        if (!validateEmail(email)) {
            showFieldError('codeEmail', 'codeEmailError', '请输入正确的QQ邮箱');
            return;
        }
        clearFieldError('codeEmail', 'codeEmailError');
        
        const result = await sendVerificationCode(email, 'login');
        if (result.success) {
            startCodeCountdown(this);
            showToast('📧 验证码已发送至您的QQ邮箱');
        } else {
            showToast(result.message, '#FCE8E8');
        }
    });

    // ========== 验证码登录 ==========
    document.getElementById('smsCodeLoginBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('codeEmail')?.value.trim();
        const code = document.getElementById('smsCode')?.value.trim();

        let isValid = true;
        if (!validateEmail(email)) {
            showFieldError('codeEmail', 'codeEmailError', '请输入正确的QQ邮箱');
            isValid = false;
        }
        if (!validateSmsCode(code)) {
            showFieldError('smsCode', 'smsCodeError', '验证码为6位数字');
            isValid = false;
        }
        if (!isValid) return;

        const result = await loginUser({ email, code, loginType: 'code' });
        
         if (result.success) {
        // ========== 在这里修改 ==========
        localStorage.setItem('user', JSON.stringify({
            id: result.user.id,
            email: result.user.email,
            nickname: result.user.nickname,
            avatar: result.user.avatar,
            phone: result.user.phone || '',
            relation: result.user.relation || ''
        }));
            showToast('✨ 登录成功！正在进入星伴世界...', '#E8F0D8');
            setTimeout(() => { window.location.href = 'mainPart.html'; }, 800);
        } else {
            showToast(result.message, '#FCE8E8');
        }
    });

    // ========== 获取邮箱验证码（注册用） ==========
    document.getElementById('regGetEmailCodeBtn')?.addEventListener('click', async function() {
        const email = document.getElementById('regEmail')?.value.trim();
        if (!validateEmail(email)) {
            showFieldError('regEmail', 'regEmailError', '请输入正确的QQ邮箱');
            return;
        }
        clearFieldError('regEmail', 'regEmailError');
        
        const result = await sendVerificationCode(email, 'register');
        if (result.success) {
            startCodeCountdown(this);
            showToast('📧 验证码已发送至您的QQ邮箱');
        } else {
            showToast(result.message, '#FCE8E8');
        }
    });

    // ========== 注册步骤1验证 ==========
    document.getElementById('regNextStep1')?.addEventListener('click', () => {
        const nickname = document.getElementById('parentNickname')?.value.trim();
        const email = document.getElementById('regEmail')?.value.trim();
        const code = document.getElementById('regEmailCode')?.value.trim();
        const pwd = document.getElementById('regPassword')?.value;
        const confirmPwd = document.getElementById('regConfirmPassword')?.value;

        let isValid = true;

        if (!validateNickname(nickname)) {
            showFieldError('parentNickname', 'parentNicknameError', '昵称为2-10个中文汉字');
            isValid = false;
        }
        if (!validateEmail(email)) {
            showFieldError('regEmail', 'regEmailError', '请输入正确的QQ邮箱');
            isValid = false;
        }
        if (!validateSmsCode(code)) {
            showFieldError('regEmailCode', 'regEmailCodeError', '验证码为6位数字');
            isValid = false;
        }
        if (!validatePassword(pwd)) {
            showFieldError('regPassword', 'regPasswordError', '密码长度至少6位');
            isValid = false;
        }
        if (pwd !== confirmPwd) {
            showFieldError('regConfirmPassword', 'regConfirmPasswordError', '两次密码输入不一致');
            isValid = false;
        }

        if (!isValid) return;

        showRegStep(2);
    });

    document.getElementById('regPrevStep2')?.addEventListener('click', () => showRegStep(1));

    document.getElementById('regNextStep2')?.addEventListener('click', () => {
        const childName = document.getElementById('regChildName')?.value.trim();

        if (!validateNickname(childName)) {
            showFieldError('regChildName', 'regChildNameError', '宝贝昵称为2-10个中文汉字');
            return;
        }

        showRegStep(3);
    });

    document.getElementById('regPrevStep3')?.addEventListener('click', () => showRegStep(2));

   document.getElementById('regNextStep3')?.addEventListener('click', async () => {
    const nickname = document.getElementById('parentNickname')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const code = document.getElementById('regEmailCode')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const childName = document.getElementById('regChildName')?.value.trim();
    
    // 获取孩子生日
    const birthYear = document.getElementById('birthYear')?.value;
    const birthMonth = document.getElementById('birthMonth')?.value;
    let childBirth = '';
    if (birthYear && birthMonth) {
        childBirth = `${birthYear}-${birthMonth.padStart(2, '0')}-01`;
    }
    
    // 获取选中的头像
    let avatarType = 'icon';
    let avatar = selectedAvatar;
    let customAvatar = '';
    
    const activePreset = document.querySelector('.preset-avatar.active');
    if (activePreset) {
        avatar = activePreset.dataset.avatar;
    }
    
    if (customAvatarUrl) {
        avatarType = 'custom';
        customAvatar = customAvatarUrl;
    }
    
    console.log('发送注册数据:', {
        email, code, nickname, password,
        childName, gender: selectedGender, birth: childBirth,
        avatar, avatarType, customAvatar
    });
    
    const result = await registerUser({
        email,
        code,
        nickname,
        password,
        childName,
        gender: selectedGender,
        birth: childBirth,
        avatar: avatar,
        avatarType: avatarType,
        customAvatar: customAvatar
    });

    if (result.success) {
        const welcomeMsg = document.getElementById('welcomeMessage');
        if (welcomeMsg) welcomeMsg.innerHTML = `${nickname} · ${childName}宝贝，开始成长陪伴之旅吧！`;
        showRegStep(4);
    } else {
        showToast(result.message, '#FCE8E8');
    }
});

    document.getElementById('goToLoginBtn')?.addEventListener('click', () => {
        // 清空表单
        const fields = ['parentNickname', 'regEmail', 'regEmailCode', 'regPassword', 'regConfirmPassword', 'regChildName'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        switchTab('login');
        showToast('🎉 注册成功！请登录您的账号', '#E8F0D8');
    });

    document.getElementById('forgotPassword')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'forgetPassword.html';
    });

    // 默认头像预览
    const defaultPreview = document.getElementById('avatarPreview');
    if (defaultPreview) {
        defaultPreview.innerHTML = '<i class="fas fa-face-smile" style="font-size:30px;"></i>';
    }
})();