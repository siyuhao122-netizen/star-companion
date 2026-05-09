from flask import Blueprint, request, jsonify
from models import db, User, Child
from datetime import datetime

child_bp = Blueprint('child', __name__)


@child_bp.route('/add', methods=['POST'])
def add_child():
    """添加孩子"""
    data = request.json
    user_id = data.get('user_id')
    name = data.get('name')
    
    if not user_id or not name:
        return jsonify({'success': False, 'message': '缺少必要参数'}), 400
    
    child = Child(
        user_id=user_id,
        name=name,
        gender=data.get('gender', '男'),
        relation=data.get('relation', '妈妈'),  # 新增
        birth_date=datetime.strptime(data.get('birth_date'), '%Y-%m-%d').date() if data.get('birth_date') else None,
        avatar_type=data.get('avatar_type', 'icon'),
        avatar=data.get('avatar', 'fa-face-smile'),
        focus_tags=data.get('focus_tags', []),
        note=data.get('note', ''),
        is_active=False
    )
    
    db.session.add(child)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': '添加成功',
        'data': {'id': child.id}
    })


@child_bp.route('/update/<int:child_id>', methods=['PUT'])
def update_child(child_id):
    """更新孩子信息"""
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404
    
    data = request.json
    
    if 'name' in data:
        child.name = data['name']
    if 'gender' in data:
        child.gender = data['gender']
    if 'relation' in data:                    # 新增
        child.relation = data['relation']      # 新增
    if 'birth_date' in data and data['birth_date']:
        child.birth_date = datetime.strptime(data['birth_date'], '%Y-%m-%d').date()
    if 'avatar_type' in data:
        child.avatar_type = data['avatar_type']
    if 'avatar' in data:
        child.avatar = data['avatar']
    if 'focus_tags' in data:
        child.focus_tags = data['focus_tags']
    if 'note' in data:
        child.note = data['note']
    
    db.session.commit()
    
    return jsonify({'success': True, 'message': '更新成功'})


@child_bp.route('/list/<int:user_id>', methods=['GET'])
def get_children(user_id):
    """获取用户的所有孩子"""
    children = Child.query.filter_by(user_id=user_id).order_by(Child.is_active.desc(), Child.created_at.desc()).all()
    return jsonify({
        'success': True,
        'data': [{
            'id': c.id,
            'name': c.name,
            'gender': c.gender,
            'relation': c.relation,           # 新增
            'birth_date': c.birth_date.isoformat() if c.birth_date else None,
            'avatar_type': c.avatar_type,
            'avatar': c.avatar,
            'focus_tags': c.focus_tags,
            'note': c.note,
            'is_active': c.is_active,
            'created_at': c.created_at.isoformat() if c.created_at else None
        } for c in children]
    })

@child_bp.route('/switch/<int:child_id>', methods=['POST'])
def switch_active_child(child_id):
    """切换当前选中的孩子"""
    data = request.json
    user_id = data.get('user_id')
    
    # 将该用户所有孩子设为非活跃
    Child.query.filter_by(user_id=user_id).update({'is_active': False})
    
    # 设置选中的孩子为活跃
    child = Child.query.get(child_id)
    if child and child.user_id == user_id:
        child.is_active = True
        db.session.commit()
        return jsonify({'success': True, 'message': '切换成功'})
    
    return jsonify({'success': False, 'message': '孩子不存在'}), 404


@child_bp.route('/delete/<int:child_id>', methods=['DELETE'])
def delete_child(child_id):
    """删除孩子"""
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404
    
    db.session.delete(child)
    db.session.commit()
    
    return jsonify({'success': True, 'message': '删除成功'})