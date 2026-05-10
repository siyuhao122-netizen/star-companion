// ========== 表单校验公共模块 ==========

const Validator = {
    // 邮箱格式
    isEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
    },

    // 密码强度：>= 8 位，至少 1 个字母 + 1 个数字
    isPassword(v) {
        return (v || '').length >= 8 && /[a-zA-Z]/.test(v) && /[0-9]/.test(v);
    },

    // 验证码：6 位数字
    isCode(v) {
        return /^\d{6}$/.test(v || '');
    },

    // 昵称：2-20 字符
    isNickname(v) {
        const len = (v || '').trim().length;
        return len >= 2 && len <= 20;
    },

    // 宝贝昵称：2-10 字符
    isChildName(v) {
        const len = (v || '').trim().length;
        return len >= 2 && len <= 10;
    },

    // 手机号：11 位，1 开头
    isPhone(v) {
        return /^1\d{10}$/.test(v || '');
    },

    // 非空
    isNotEmpty(v) {
        return (v || '').trim().length > 0;
    },

    // 内容长度：min-max 字
    isLength(v, min, max) {
        const len = (v || '').trim().length;
        return len >= min && len <= max;
    },

    // 出生日期：非空且不晚于今天
    isBirthDate(v) {
        if (!v) return false;
        return new Date(v) <= new Date();
    },
};

// 校验结果展示：校验不通过时调用 showToast 并返回 false
function validateForm(rules, values) {
    for (const { field, label, check, message } of rules) {
        if (!check(values[field])) {
            if (typeof showToast === 'function') {
                showToast(message || `请输入正确的${label}`, false);
            }
            return false;
        }
    }
    return true;
}
