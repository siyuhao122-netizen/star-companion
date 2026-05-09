from flask import Blueprint, request, jsonify
from flask_bcrypt import Bcrypt
from models import db, User, EmailVerification, Child, NameReactionRecord, PointGameRecord, VoiceGameRecord, SurveyResult, DailyRecommendation, TreeholeMessage, Notification
from datetime import datetime, timedelta
import smtplib
import random
import string
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config

auth_bp = Blueprint('auth', __name__)
bcrypt = Bcrypt()




def generate_verification_code(length=6):
    """生成6位数字验证码"""
    return ''.join(random.choices(string.digits, k=length))


def send_email(to_email, subject, body):
    """发送邮件的通用函数"""
    try:
        msg = MIMEMultipart()
        msg['From'] = f"StarCompanion <{Config.MAIL_USERNAME}>"
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'html', 'utf-8'))

        with smtplib.SMTP_SSL(Config.MAIL_SERVER, Config.MAIL_PORT) as server:
            server.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
            server.send_message(msg)
        return True, None
    except Exception as e:
        return False, str(e)


@auth_bp.route('/send-verify-code', methods=['POST'])
def send_verify_code():
    """发送邮箱验证码"""
    data = request.json
    email = data.get('email')
    code_type = data.get('type', 'register')

    if not email:
        return jsonify({'success': False, 'message': '邮箱不能为空'}), 400

    if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@qq\.com$', email):
        return jsonify({'success': False, 'message': '请输入正确的QQ邮箱'}), 400

    user = User.query.filter_by(email=email).first()

    if code_type == 'register' and user:
        return jsonify({'success': False, 'message': '该邮箱已被注册，请直接登录'}), 400
    
    if code_type == 'login' and not user:
        return jsonify({'success': False, 'message': '该邮箱尚未注册，请先注册'}), 400
    
    if code_type == 'reset_password' and not user:
        return jsonify({'success': False, 'message': '该邮箱尚未注册，请先注册'}), 400

    # ✅ 新增：注册时检查邮箱是否存在（通过发送邮件验证）
    # 这里 QQ邮箱的规则是：只要能发送成功就是存在的
    # 不需要额外检查，因为 send_email 会实际连接SMTP验证

    code = generate_verification_code()
    print(f"📧 收件邮箱: {email}")
    print(f"🔑 验证码: {code}")

    expires_at = datetime.utcnow() + timedelta(minutes=10)
    verification = EmailVerification(
        email=email,
        code=code,
        type=code_type,
        expires_at=expires_at
    )
    db.session.add(verification)
    db.session.commit()

    subject = "星伴 - 邮箱验证码"
    body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #D9A066;">🌟 星伴 · 暖愈成长空间</h2>
        <p>您的验证码是：</p>
        <h1 style="color: #B47C44; font-size: 32px; letter-spacing: 5px;">{code}</h1>
        <p>验证码10分钟内有效，请勿泄露给他人。</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">如果这不是您的操作，请忽略此邮件。</p>
    </body>
    </html>
    """

    success, error = send_email(email, subject, body)

    if success:
        return jsonify({'success': True, 'message': '验证码已发送'}), 200
    else:
        # ✅ 发送失败说明邮箱不存在
        db.session.delete(verification)
        db.session.commit()
        
        # 根据错误类型给出不同提示
        if '550' in str(error) or 'User unknown' in str(error) or 'Mailbox not found' in str(error):
            return jsonify({'success': False, 'message': '该邮箱地址不存在，请检查后重新输入'}), 500
        else:
            return jsonify({'success': False, 'message': f'邮件发送失败，请检查邮箱地址是否正确'}), 500

@auth_bp.route('/verify-code', methods=['POST'])
def verify_code():
    """验证验证码"""
    data = request.json
    email = data.get('email')
    code = data.get('code')
    code_type = data.get('type', 'register')

    if not email or not code:
        return jsonify({'success': False, 'message': '邮箱和验证码不能为空'}), 400

    verification = EmailVerification.query.filter_by(
        email=email,
        code=code,
        type=code_type,
        is_used=False
    ).order_by(EmailVerification.created_at.desc()).first()

    if not verification:
        return jsonify({'success': False, 'message': '验证码错误'}), 400

    if verification.expires_at < datetime.utcnow():
        return jsonify({'success': False, 'message': '验证码已过期'}), 400

    verification.is_used = True
    db.session.commit()

    return jsonify({'success': True, 'message': '验证成功'}), 200


@auth_bp.route('/register', methods=['POST'])
def register():
    """用户注册"""
    data = request.json
    email = data.get('email')
    code = data.get('code')
    nickname = data.get('nickname')
    password = data.get('password')

    child_name = data.get('childName')
    child_gender = data.get('gender', '男')
    child_birth = data.get('birth')
    child_avatar = data.get('avatar', 'fa-face-smile')
    child_avatar_type = data.get('avatarType', 'icon')
    child_custom_avatar = data.get('customAvatar')

    gender_map = {'boy': '男', 'girl': '女'}
    child_gender_cn = gender_map.get(child_gender, '男')

    if not all([email, code, nickname, password]):
        return jsonify({'success': False, 'message': '请填写完整信息'}), 400

    if not re.match(r'^[\u4e00-\u9fa5]{2,10}$', nickname):
        return jsonify({'success': False, 'message': '昵称应为2-10个中文汉字'}), 400

    if len(password) < 6:
        return jsonify({'success': False, 'message': '密码长度至少6位'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': '该邮箱已被注册'}), 400

    verification = EmailVerification.query.filter_by(
        email=email,
        code=code,
        type='register',
        is_used=False
    ).order_by(EmailVerification.created_at.desc()).first()

    if not verification:
        return jsonify({'success': False, 'message': '请先获取验证码'}), 400

    if verification.expires_at < datetime.utcnow():
        return jsonify({'success': False, 'message': '验证码已过期'}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(
        email=email,
        password_hash=hashed_password,
        nickname=nickname,
        is_verified=True
    )
    db.session.add(new_user)
    db.session.flush()

    if child_name:
        final_avatar = child_custom_avatar if child_avatar_type == 'custom' else child_avatar
        birth_date = None
        if child_birth:
            try:
                birth_date = datetime.strptime(child_birth, '%Y-%m-%d').date()
            except:
                pass
        new_child = Child(
            user_id=new_user.id,
            name=child_name,
            gender=child_gender_cn,
            birth_date=birth_date,
            avatar_type=child_avatar_type,
            avatar=final_avatar,
            is_active=True
        )
        db.session.add(new_child)

    verification.is_used = True
    db.session.commit()

    return jsonify({
        'success': True,
        'message': '注册成功',
        'user': {
            'id': new_user.id,
            'email': new_user.email,
            'nickname': new_user.nickname
        }
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    login_type = data.get('loginType', 'password')

    if not email:
        return jsonify({'success': False, 'message': '邮箱不能为空'}), 400

    user = User.query.filter_by(email=email).first()

    if login_type == 'password':
        if not password:
            return jsonify({'success': False, 'message': '密码不能为空'}), 400
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'}), 400
        if not bcrypt.check_password_hash(user.password_hash, password):
            return jsonify({'success': False, 'message': '密码错误'}), 400
    else:
        code = data.get('code')
        if not code:
            return jsonify({'success': False, 'message': '验证码不能为空'}), 400
        if not user:
            return jsonify({'success': False, 'message': '用户不存在'}), 400
        verification = EmailVerification.query.filter_by(
            email=email,
            code=code,
            type='login',
            is_used=False
        ).order_by(EmailVerification.created_at.desc()).first()
        if not verification:
            return jsonify({'success': False, 'message': '验证码错误'}), 400
        if verification.expires_at < datetime.utcnow():
            return jsonify({'success': False, 'message': '验证码已过期'}), 400
        verification.is_used = True

    db.session.commit()

    return jsonify({
        'success': True,
        'message': '登录成功',
        'user': {
            'id': user.id,
            'email': user.email,
            'nickname': user.nickname,
            'avatar': user.avatar,
            'phone': user.phone,
            'relation': user.relation
        }
    }), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """重置密码"""
    data = request.json
    email = data.get('email')
    new_password = data.get('newPassword')

    if not all([email, new_password]):
        return jsonify({'success': False, 'message': '请填写完整信息'}), 400
    if len(new_password) < 6:
        return jsonify({'success': False, 'message': '密码长度至少6位'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 400

    user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.session.commit()
    return jsonify({'success': True, 'message': '密码重置成功'}), 200


@auth_bp.route('/update-avatar', methods=['POST'])
def update_avatar():
    """更新用户头像"""
    data = request.json
    user_id = data.get('user_id')
    avatar = data.get('avatar')

    if not user_id or not avatar:
        return jsonify({'success': False, 'message': '参数错误'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404

    user.avatar = avatar
    db.session.commit()
    return jsonify({'success': True, 'message': '头像更新成功'}), 200


@auth_bp.route('/user/<int:user_id>', methods=['GET'])
def get_user_info(user_id):
    """获取用户信息"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    return jsonify({
        'success': True,
        'data': {
            'id': user.id,
            'email': user.email,
            'nickname': user.nickname,
            'phone': user.phone,
            'avatar': user.avatar,
            'relation': user.relation
        }
    })


@auth_bp.route('/user/<int:user_id>', methods=['PUT'])
def update_user_info(user_id):
    """更新用户信息"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404

    data = request.json
    if 'nickname' in data:
        user.nickname = data['nickname']
    if 'phone' in data:
        user.phone = data['phone']

    try:
        db.session.commit()
        return jsonify({'success': True, 'message': '更新成功'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'更新失败: {str(e)}'}), 500


@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    """修改密码（需要验证当前密码）"""
    data = request.json
    user_id = data.get('user_id')
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not all([user_id, current_password, new_password]):
        return jsonify({'success': False, 'message': '请填写完整信息'}), 400
    if len(new_password) < 6:
        return jsonify({'success': False, 'message': '新密码长度至少6位'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404

    if not bcrypt.check_password_hash(user.password_hash, current_password):
        return jsonify({'success': False, 'message': '当前密码错误'}), 400

    user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.session.commit()
    return jsonify({'success': True, 'message': '密码修改成功'}), 200


@auth_bp.route('/update-phone', methods=['POST'])
def update_phone():
    """更新手机号"""
    data = request.json
    user_id = data.get('user_id')
    phone = data.get('phone')

    if not user_id or not phone:
        return jsonify({'success': False, 'message': '参数错误'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404

    user.phone = phone
    db.session.commit()
    return jsonify({'success': True, 'message': '手机号更新成功'}), 200


@auth_bp.route('/delete-account', methods=['DELETE'])
def delete_account():
    """注销账户（永久删除用户及所有关联数据）"""
    data = request.json
    user_id = data.get('user_id')

    if not user_id:
        return jsonify({'success': False, 'message': '参数错误：缺少user_id'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': '用户不存在'}), 404

    try:
        # 1. 获取该用户的所有孩子ID
        children = Child.query.filter_by(user_id=user_id).all()
        for child in children:
            # 删除孩子相关的所有记录
            NameReactionRecord.query.filter_by(child_id=child.id).delete()
            PointGameRecord.query.filter_by(child_id=child.id).delete()
            VoiceGameRecord.query.filter_by(child_id=child.id).delete()
            SurveyResult.query.filter_by(child_id=child.id).delete()
            DailyRecommendation.query.filter_by(child_id=child.id).delete()

        # 2. 删除所有孩子
        Child.query.filter_by(user_id=user_id).delete()

        # 3. 删除邮箱验证码记录
        EmailVerification.query.filter_by(email=user.email).delete()

        # 4. 删除树洞留言
        TreeholeMessage.query.filter_by(user_id=user_id).delete()

        # 5. 最后删除用户
        db.session.delete(user)
        db.session.commit()

        print(f"用户 {user.email} (ID: {user.id}) 注销成功")
        return jsonify({'success': True, 'message': '账户已注销'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"注销失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'注销失败: {str(e)}'}), 500


# ========== 通知相关 ==========

@auth_bp.route('/notifications/<int:user_id>', methods=['GET'])
def get_notifications(user_id):
    """获取通知列表"""
    limit = request.args.get('limit', 20, type=int)
    unread_only = request.args.get('unread', '0') == '1'

    query = Notification.query.filter_by(user_id=user_id)
    if unread_only:
        query = query.filter_by(is_read=False)

    notifs = query.order_by(Notification.created_at.desc()).limit(limit).all()

    unread_count = Notification.query.filter_by(user_id=user_id, is_read=False).count()

    return jsonify({
        'success': True,
        'data': {
            'unread_count': unread_count,
            'list': [{
                'id': n.id,
                'type': n.type,
                'title': n.title,
                'content': n.content,
                'related_id': n.related_id,
                'is_read': n.is_read,
                'created_at': n.created_at.isoformat()
            } for n in notifs]
        }
    }), 200


@auth_bp.route('/notifications/mark-read', methods=['POST'])
def mark_notification_read():
    """标记通知为已读"""
    data = request.json
    notif_id = data.get('id')
    mark_all = data.get('mark_all', False)

    if mark_all:
        user_id = data.get('user_id')
        Notification.query.filter_by(user_id=user_id, is_read=False)\
            .update({'is_read': True})
    elif notif_id:
        notif = Notification.query.get(notif_id)
        if notif:
            notif.is_read = True
    else:
        return jsonify({'success': False, 'message': '参数错误'}), 400

    db.session.commit()
    return jsonify({'success': True}), 200


@auth_bp.route('/feedback', methods=['POST'])
def submit_feedback():
    """提交用户反馈（发送到管理员邮箱）"""
    data = request.json
    user_id = data.get('user_id')
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'success': False, 'message': '内容不能为空'}), 400

    user = User.query.get(user_id) if user_id else None
    user_info = f'{user.nickname or "用户"} ({user.email})' if user else '匿名用户'

    try:
        send_email(
            Config.MAIL_USERNAME,
            f'[星伴反馈] 来自 {user_info}',
            f'<p>用户：{user_info}</p><p>内容：</p><p>{content}</p>'
        )
    except Exception as e:
        print(f'反馈邮件发送失败: {e}')

    return jsonify({'success': True, 'message': '感谢你的反馈'}), 200


def create_notification(user_id, notif_type, title, content='', related_id=None):
    """内部函数：创建通知"""
    try:
        n = Notification(
            user_id=user_id,
            type=notif_type,
            title=title,
            content=content,
            related_id=related_id
        )
        db.session.add(n)
        db.session.commit()
        return True
    except Exception as e:
        print(f'创建通知失败: {e}')
        db.session.rollback()
        return False