(function() {
    // ========== API 配置 ==========
    const API_BASE = 'http://localhost:5000/api';

    // ========== 工具函数 ==========
    function validateEmail(email) {
        return /^[1-9]\d{4,10}@qq\.com$/.test(email);
    }

    function validateSmsCode(code) {
        return /^\d{6}$/.test(code);
    }

    function showToast(msg, bg = '#FEF3E2') {
        let t = document.querySelector('.toast-message');
        if (t) t.remove();
        t = document.createElement('div');
        t.className = 'toast-message';
        t.innerHTML = `<i class="fas fa-star"></i> ${msg}`;
        t.style.background = bg;
        document.querySelector('.auth-container').appendChild(t);
        setTimeout(() => t.remove(), 2000);
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

    async function verifyCode(email, code, type) {
        try {
            const response = await fetch(`${API_BASE}/auth/verify-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, type })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: '网络错误，请稍后重试' };
        }
    }

    async function resetPassword(email, code, newPassword) {
        try {
            const response = await fetch(`${API_BASE}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });
            return await response.json();
        } catch (error) {
            return { success: false, message: '网络错误，请稍后重试' };
        }
    }

    // ========== 状态变量 ==========
    let forgotStep = 1;
    let countdown = 0;
    let timer = null;
    let userEmail = '';

    // ========== 面板切换 ==========
    const authPanel = document.getElementById('authPanel');
    const forgotPanel = document.getElementById('forgotPanel');

    function showAuthPanel() {
        if (authPanel) authPanel.style.display = 'block';
        if (forgotPanel) forgotPanel.style.display = 'none';
    }

    function showForgotPanel() {
        if (authPanel) authPanel.style.display = 'none';
        if (forgotPanel) forgotPanel.style.display = 'block';
        showForgotStep(1);
    }

    document.getElementById('forgotPassword')?.addEventListener('click', showForgotPanel);
    document.getElementById('backToLoginLink')?.addEventListener('click', showAuthPanel);

    // ========== 忘记密码步骤控制 ==========
    function showForgotStep(step) {
        forgotStep = step;
        document.getElementById('forgotStep1').style.display = step === 1 ? 'block' : 'none';
        document.getElementById('forgotStep2').style.display = step === 2 ? 'block' : 'none';
        document.getElementById('forgotStep3').style.display = step === 3 ? 'block' : 'none';
        document.getElementById('forgotStep4').style.display = step === 4 ? 'block' : 'none';

        const c1 = document.getElementById('stepCapsule1');
        const c2 = document.getElementById('stepCapsule2');
        const c3 = document.getElementById('stepCapsule3');
        if (c1 && c2 && c3) {
            c1.classList.remove('active', 'completed');
            c2.classList.remove('active', 'completed');
            c3.classList.remove('active', 'completed');

            if (step === 1) c1.classList.add('active');
            else if (step === 2) { c1.classList.add('completed'); c2.classList.add('active'); }
            else if (step === 3) { c1.classList.add('completed'); c2.classList.add('completed'); c3.classList.add('active'); }
            else if (step === 4) { c1.classList.add('completed'); c2.classList.add('completed'); c3.classList.add('completed'); }
        }
    }

   let codeCountdown = 0;      // ✅ 和 auth.js 保持一致的变量名
let codeTimer = null;

function startCountdown(btn) {
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

    // ========== 密码强度 ==========
    document.getElementById('newPassword')?.addEventListener('input', function() {
        const pwd = this.value;
        const fill = document.getElementById('strengthFill');
        const text = document.getElementById('strengthText');
        if (!fill || !text) return;
        
        let strength = 0;
        if (pwd.length >= 8) strength++;
        if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
        if (/[0-9]/.test(pwd)) strength++;
        if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
        
        const percent = Math.min((strength / 4) * 100, 100);
        fill.style.width = percent + '%';
        fill.classList.remove('weak', 'medium', 'strong');
        
        if (pwd.length === 0) { 
            fill.style.width = '0%'; 
            text.textContent = '请输入新密码'; 
        } else if (strength <= 1) { 
            fill.classList.add('weak'); 
            text.textContent = '密码强度：弱'; 
        } else if (strength === 2) { 
            fill.classList.add('medium'); 
            text.textContent = '密码强度：中'; 
        } else { 
            fill.classList.add('strong'); 
            text.textContent = '密码强度：强'; 
        }
    });

    // ========== 密码确认 ==========
    document.getElementById('confirmNewPassword')?.addEventListener('input', function() {
        const pwd = document.getElementById('newPassword')?.value;
        const confirm = this.value;
        const hint = document.getElementById('passwordMatchHint');
        if (!hint) return;
        
        if (confirm.length === 0) { 
            hint.innerHTML = '<i class="fas fa-info-circle"></i> 请再次输入密码确认'; 
            hint.className = 'hint-text'; 
        } else if (pwd === confirm) { 
            hint.innerHTML = '<i class="fas fa-check-circle"></i> 密码一致'; 
            hint.className = 'hint-text success'; 
        } else { 
            hint.innerHTML = '<i class="fas fa-times-circle"></i> 两次密码不一致'; 
            hint.className = 'hint-text error'; 
        }
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

  // ========== 发送验证码 ==========
document.getElementById('sendCodeBtn')?.addEventListener('click', async function() {
    const email = document.getElementById('resetEmail')?.value;
    if (!email || !email.includes('@')) { 
        showToast('请输入有效的邮箱地址', '#FCE8E8'); 
        return; 
    }
    if (!validateEmail(email)) {
        showToast('请输入正确的QQ邮箱', '#FCE8E8');
        return;
    }
    
    userEmail = email;
    const displayEmail = document.getElementById('displayEmail');
    if (displayEmail) displayEmail.textContent = email;
    
    const result = await sendVerificationCode(email, 'reset_password');
    if (result.success) {
        showToast('📧 验证码已发送至您的邮箱', '#E8F0D8');
        startCountdown(this);
        showForgotStep(2);
    } else {
        showToast(result.message, '#FCE8E8');
    }
});

// ========== 重新发送验证码 ==========
document.getElementById('resendCodeBtn')?.addEventListener('click', async function() {
    if (codeCountdown > 0) return;  // ✅ 倒计时中不允许点击
    
    const result = await sendVerificationCode(userEmail, 'reset_password');
    if (result.success) {
        showToast('📧 验证码已重新发送', '#E8F0D8');
        startCountdown(this);
    } else {
        showToast(result.message, '#FCE8E8');
    }
});
// ========== 验证验证码 ==========
document.getElementById('verifyCodeBtn')?.addEventListener('click', async function() {
    const code = document.getElementById('verifyCode')?.value;
    if (!code || code.length !== 6) { 
        showToast('请输入6位验证码', '#FCE8E8'); 
        return; 
    }
    
    // ✅ 这里调用后端验证
    const result = await verifyCode(userEmail, code, 'reset_password');
    if (result.success) {
        showToast('✅ 验证成功！请设置新密码', '#E8F0D8');
        showForgotStep(3);
    } else {
        showToast(result.message || '验证码错误', '#FCE8E8');  // ✅ 加上默认错误提示
    }
});


    // ========== 返回上一步 ==========
    document.getElementById('backToStep1Btn')?.addEventListener('click', () => {
        if (timer) { clearInterval(timer); timer = null; }
        const sendBtn = document.getElementById('sendCodeBtn');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerText = '获取验证码';
        }
        showForgotStep(1);
    });

    document.getElementById('backToStep2Btn')?.addEventListener('click', () => showForgotStep(2));

    // ========== 重置密码 ==========
    document.getElementById('resetPasswordBtn')?.addEventListener('click', async function() {
        const pwd = document.getElementById('newPassword')?.value;
        const confirm = document.getElementById('confirmNewPassword')?.value;
        
        if (!pwd || pwd.length < 8) { 
            showToast('密码长度至少8位', '#FCE8E8'); 
            return; 
        }
        if (pwd !== confirm) { 
            showToast('两次密码不一致', '#FCE8E8'); 
            return; 
        }
        
        const code = document.getElementById('verifyCode')?.value;
        const result = await resetPassword(userEmail, code, pwd);
        
        if (result.success) {
            showToast('🎉 密码重置成功！', '#E8F0D8');
            showForgotStep(4);
        } else {
            showToast(result.message, '#FCE8E8');
        }
    });

    // ========== 去登录 ==========
    document.getElementById('goToLoginFromForgotBtn')?.addEventListener('click', () => {
        window.location.href = 'sign-inANDsign-up.html';
    });

    // ========== 标签页切换（从auth.js复用） ==========
    const authTabs = document.getElementById('authTabs');
    const loginStep = document.getElementById('loginStep');
    const registerStep = document.getElementById('registerStep');
    const formTitle = document.getElementById('formTitle');
    const formSubtitle = document.getElementById('formSubtitle');
    const passwordLogin = document.getElementById('passwordLogin');
    const codeLogin = document.getElementById('codeLogin');
    const passwordMethodBtn = document.getElementById('passwordMethodBtn');
    const codeMethodBtn = document.getElementById('codeMethodBtn');

    function setActiveMethod(method) {
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

    function switchTab(tab) {
        authTabs?.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        authTabs?.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
        if (tab === 'login') {
            loginStep?.classList.add('active');
            registerStep?.classList.remove('active');
            if (formTitle) formTitle.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> 家长登录';
            if (formSubtitle) formSubtitle.textContent = '登录后查看宝贝的成长数据';
        } else {
            loginStep?.classList.remove('active');
            registerStep?.classList.add('active');
            if (formTitle) formTitle.innerHTML = '<i class="fas fa-user-plus"></i> 注册账号';
            if (formSubtitle) formSubtitle.textContent = '创建账号，开始陪伴之旅';
        }
    }
    authTabs?.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab-btn');
        if (!tab) return;
        switchTab(tab.dataset.tab);
    });
})();