from flask import Blueprint, request, jsonify
from models import db, ShareCode
from datetime import datetime, timedelta
import random
import string

share_bp = Blueprint('share', __name__)


def generate_code(length=6):
    """生成6位随机字母数字码"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


@share_bp.route('/generate', methods=['POST'])
def generate_share_code():
    data = request.json
    child_id = data.get('child_id')
    games = data.get('games', 'name,point,mic,emotion')

    if not child_id:
        return jsonify({'success': False, 'message': '缺少child_id'}), 400

    # 生成唯一码（最多重试5次）
    code = generate_code()
    for _ in range(5):
        if not ShareCode.query.filter_by(code=code).first():
            break
        code = generate_code()

    expires_at = datetime.utcnow() + timedelta(hours=48)

    share = ShareCode(
        code=code,
        child_id=child_id,
        games=games,
        expires_at=expires_at
    )
    db.session.add(share)
    db.session.commit()

    return jsonify({
        'success': True,
        'data': {
            'code': code,
            'child_id': child_id,
            'games': games,
            'expires_at': expires_at.isoformat(),
            'expires_in_hours': 48
        }
    }), 201


@share_bp.route('/verify', methods=['GET'])
def verify_share_code():
    code = request.args.get('code', '').strip().upper()
    if not code:
        return jsonify({'success': False, 'message': '缺少分享码'}), 400

    share = ShareCode.query.filter_by(code=code, is_revoked=False).first()
    if not share:
        return jsonify({'success': False, 'message': '分享码无效'}), 404

    if share.expires_at < datetime.utcnow():
        return jsonify({'success': False, 'message': '分享码已过期'}), 410

    return jsonify({
        'success': True,
        'data': {
            'child_id': share.child_id,
            'games': share.games,
            'expires_at': share.expires_at.isoformat()
        }
    }), 200


@share_bp.route('/revoke', methods=['POST'])
def revoke_share_code():
    data = request.json
    code = data.get('code', '').strip().upper()

    if not code:
        return jsonify({'success': False, 'message': '缺少分享码'}), 400

    share = ShareCode.query.filter_by(code=code).first()
    if not share:
        return jsonify({'success': False, 'message': '分享码不存在'}), 404

    share.is_revoked = True
    db.session.commit()

    return jsonify({'success': True, 'message': '分享码已撤销'}), 200
