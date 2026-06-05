from flask import Blueprint, request, jsonify
from models import db, TreeholeMessage, Notification
from config import Config
from datetime import datetime
from rag import retrieve, build_query_for_retrieval
from utils import call_bailian_ai

treehole_bp = Blueprint('treehole', __name__)


@treehole_bp.route('/messages', methods=['GET'])
def get_messages():
    """获取所有留言（按时间倒序）"""
    tag = request.args.get('tag')
    query = TreeholeMessage.query
    if tag:
        query = query.filter_by(tag=tag)
    messages = query.order_by(TreeholeMessage.created_at.desc()).limit(50).all()
    return jsonify([{
        'id': m.id,
        'user_id': m.user_id,
        'anonymous_name': m.anonymous_name,
        'anonymous_avatar': m.anonymous_avatar,
        'content': m.content,
        'tag': m.tag,
        'ai_reply': m.ai_reply,
        'likes': m.likes,
        'comments': getattr(m, 'comments', 0),
        'created_at': m.created_at.isoformat()
    } for m in messages])


@treehole_bp.route('/post', methods=['POST'])
def post_message():
    """发布新留言（自动调用AI生成回复）"""
    data = request.json
    user_id = data.get('user_id')
    content = data.get('content', '').strip()
    tag = data.get('tag', '日常倾诉')
    anonymous_name = data.get('anonymous_name', '匿名用户')
    anonymous_avatar = data.get('anonymous_avatar', 'fa-user-circle')

    if not content:
        return jsonify({'success': False, 'message': '内容不能为空'}), 400

    # RAG 检索相关知识（根据标签 + 内容）
    retrieval_query = build_query_for_retrieval(
        'treehole', 30,  # 默认30个月为通用检索
        f"{tag} {content[:100]}"
    )
    extra_knowledge = retrieve(retrieval_query)

    # 调用AI生成回复
    ai_reply, _ = call_bailian_ai(content, extra_knowledge, 'treehole', max_tokens=300, enable_thinking=False, system_suffix=f"\n\n消息标签：{tag}。请根据标签调整回复侧重。")
    if not ai_reply:
        ai_reply = "感谢你的分享～ 每一个小小的进步都值得被看见，星伴会一直陪着你。🌱"

    msg = TreeholeMessage(
        user_id=user_id,
        anonymous_name=anonymous_name,
        anonymous_avatar=anonymous_avatar,
        content=content,
        tag=tag,
        ai_reply=ai_reply
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify({
        'success': True,
        'id': msg.id,
        'ai_reply': ai_reply
    }), 201


@treehole_bp.route('/regenerate-ai-reply/<int:msg_id>', methods=['POST'])
def regenerate_ai_reply(msg_id):
    """重新生成某条留言的AI回复（用于手动刷新）"""
    msg = TreeholeMessage.query.get(msg_id)
    if not msg:
        return jsonify({'success': False, 'message': '留言不存在'}), 404

    retrieval_query = build_query_for_retrieval(
        'treehole', 30,
        f"{msg.tag} {msg.content[:100]}"
    )
    extra_knowledge = retrieve(retrieval_query)
    new_reply, _ = call_bailian_ai(msg.content, extra_knowledge, 'treehole', max_tokens=300, enable_thinking=False, system_suffix=f"\n\n消息标签：{msg.tag}。请根据标签调整回复侧重。")
    if new_reply:
        msg.ai_reply = new_reply
        db.session.commit()
        return jsonify({'success': True, 'ai_reply': new_reply}), 200
    else:
        return jsonify({'success': False, 'message': 'AI生成失败，请稍后重试'}), 500


@treehole_bp.route('/like/<int:msg_id>', methods=['POST'])
def like_message(msg_id):
    """点赞留言"""
    msg = TreeholeMessage.query.get(msg_id)
    if msg:
        msg.likes += 1
        # 通知消息作者
        if msg.user_id:
            notif = Notification(
                user_id=msg.user_id,
                type='treehole_like',
                title='有人给你的树洞留言点了赞',
                content=f'你的留言获得了 {msg.likes} 个赞',
                related_id=msg_id
            )
            db.session.add(notif)
        db.session.commit()
        return jsonify({'likes': msg.likes})
    return jsonify({'error': '消息不存在'}), 404


@treehole_bp.route('/delete/<int:msg_id>', methods=['DELETE'])
def delete_message(msg_id):
    """删除留言（仅限自己的留言）"""
    msg = TreeholeMessage.query.get(msg_id)
    if not msg:
        return jsonify({'error': '消息不存在'}), 404

    db.session.delete(msg)
    db.session.commit()
    return jsonify({'success': True, 'message': '删除成功'}), 200