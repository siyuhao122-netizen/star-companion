from flask import Blueprint, request, jsonify
from models import db, NameReactionRecord, PointGameRecord, VoiceGameRecord, Child, AITokenUsage
from datetime import date, datetime
import requests
from config import Config
from rag import retrieve, build_system_prompt, build_query_for_retrieval
from routes.auth import create_notification

games_bp = Blueprint('games', __name__)


# ---------- 通用 AI 调用函数（集成RAG） ----------
def call_ai_for_game_analysis(prompt, extra_knowledge='', analysis_type='name'):
    """调用AI模型（集成RAG）"""
    try:
        url = f"{Config.BAILIAN_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {Config.BAILIAN_API_KEY}",
            "Content-Type": "application/json"
        }

        system_content = build_system_prompt(analysis_type, extra_knowledge)

        payload = {
            "model": Config.BAILIAN_MODEL,
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 500
        }

        response = requests.post(url, json=payload, headers=headers, timeout=15)
        result = response.json()
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            print(f"✅ 游戏AI完成 | tokens: {usage.get('total_tokens', 'N/A')}")
            return content, usage
        else:
            print(f"❌ AI失败: {result}")
            return None, {}
    except Exception as e:
        print(f"❌ AI异常: {e}")
        return None, {}


def calculate_month_age(birth_date):
    if not birth_date:
        return 0
    today = datetime.now().date()
    months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
    return max(0, months)


def build_name_reaction_prompt(child_name, age_months, record):
    success_rate = (record.success_count / record.round_total * 100) if record.round_total > 0 else 0
    avg_time = float(record.avg_reaction_time) if record.avg_reaction_time else 0
    round_details = record.round_details or []
    early_success = sum(1 for r in round_details[:4] if r.get('success')) if len(round_details) >= 4 else 0
    late_success = sum(1 for r in round_details[-4:] if r.get('success')) if len(round_details) >= 4 else 0
    fatigue_note = ""
    if early_success > late_success:
        fatigue_note = "后半段成功率有所下降，可能存在注意力波动"
    elif late_success > early_success and early_success > 0:
        fatigue_note = "后半段表现更好，孩子可能需要时间进入状态"

    prompt = f"""你是一位儿童发育行为顾问，请根据以下叫名反应游戏数据给家长一段温暖的分析（200字以内）。

【孩子信息】{child_name}，{age_months}个月

【本次训练数据】
总轮数：{record.round_total}轮
成功次数：{record.success_count}次
成功率：{success_rate:.1f}%
平均反应时间：{avg_time:.2f}秒
前4轮成功：{early_success}次
后4轮成功：{late_success}次
{f'注意：{fatigue_note}' if fatigue_note else ''}

请用1-2句比喻评价整体表现，点出1个数据亮点，给出1条温柔建议。语言亲切，避免专业术语。"""
    return prompt


def save_token_usage(record_type, record_id, child_id, model_name, usage_data):
    try:
        token_record = AITokenUsage(
            record_type=record_type,
            record_id=record_id,
            child_id=child_id,
            model_name=model_name,
            prompt_tokens=usage_data.get('prompt_tokens', 0),
            completion_tokens=usage_data.get('completion_tokens', 0),
            total_tokens=usage_data.get('total_tokens', 0)
        )
        db.session.add(token_record)
        db.session.commit()
        print(f"✅ Token记录已保存: {usage_data.get('total_tokens', 0)} tokens")
    except Exception as e:
        print(f"⚠️ Token记录保存失败: {e}")


# ---------- 叫名反应（自动AI分析 - 使用问卷AI模型） ----------
@games_bp.route('/name-reaction', methods=['POST'])
def save_name_reaction():
    data = request.json

    round_details = data.get('round_details', [])

    print("\n================ 叫名反应训练记录 ================", flush=True)
    print(f"child_id: {data.get('child_id')}", flush=True)
    print(f"总轮数: {data.get('round_total', 8)}", flush=True)
    print(f"成功次数: {data.get('success_count', 0)}", flush=True)
    print("--------------- 每轮判定详情 ---------------", flush=True)

    for r in round_details:
        round_no = r.get('round', '?')
        success = r.get('success', False)

        if success:
            reasons = r.get('successReasons') or []

            if not reasons:
                if r.get('headTurned'):
                    reasons.append('头部')
                if r.get('expressionTriggered'):
                    reasons.append('面部')
                if r.get('voiceTriggered'):
                    reasons.append('声音')
                if r.get('triggeredBy') and '重新看向镜头' in str(r.get('triggeredBy')):
                    reasons.append('重新看向镜头')

            reason_text = ' + '.join(reasons) if reasons else '未知维度'

            print(
                f"第{round_no}轮 成功 | "
                f"判定维度: {reason_text} | "
                f"triggeredBy: {r.get('triggeredBy', '')} | "
                f"反应时间: {r.get('reactionTime', '-')}秒 | "
                f"头部距离: {r.get('headDistance', 0)}px | "
                f"声音: {r.get('voiceDB', 0)}dB",
                flush=True
            )
        else:
            print(
                f"第{round_no}轮 失败 | "
                f"原因: {r.get('reason', 'unknown')} | "
                f"反应时间: {r.get('reactionTime', '-')}秒",
                flush=True
            )

    print("================================================\n", flush=True)

    # 下面保留你原来的保存数据库代码

    # 1. 保存记录
    record = NameReactionRecord(
        child_id=data['child_id'],
        session_date=date.today(),
        round_total=data.get('round_total', 8),
        success_count=data['success_count'],
        avg_reaction_time=data.get('avg_reaction_time'),
        round_details=data.get('round_details', [])
    )



    db.session.add(record)
    db.session.commit()
    record_id = record.id

    # 2. 自动调用 AI 分析（集成RAG）
    try:
        child = Child.query.get(data['child_id'])
        if child and child.birth_date:
            age_months = calculate_month_age(child.birth_date)
        else:
            age_months = 0

        # RAG 检索专业知识
        success_rate = (record.success_count / record.round_total * 100) if record.round_total > 0 else 0
        retrieval_query = build_query_for_retrieval(
            'name', age_months,
            f"叫名反应 成功率{success_rate:.0f}% 共{record.round_total}轮"
        )
        extra_knowledge = retrieve(retrieval_query)

        prompt = build_name_reaction_prompt(child.name, age_months, record)
        ai_analysis, usage = call_ai_for_game_analysis(prompt, extra_knowledge, 'name')
        if ai_analysis:
            record.ai_analysis = ai_analysis
            db.session.commit()
            # 记录token使用（问卷AI模型）
            save_token_usage('name_single', record_id, data['child_id'], Config.BAILIAN_MODEL, usage)
    except Exception as e:
        print(f"⚠️ 叫名反应AI自动分析失败: {e}")
        # 不影响主流程，继续返回成功

    return jsonify({
        'id': record_id,
        'ai_analysis': record.ai_analysis  # 返回AI分析结果（如果有）
    }), 201


@games_bp.route('/name-reaction/history/<int:child_id>', methods=['GET'])
def get_name_history(child_id):
    records = NameReactionRecord.query.filter_by(child_id=child_id).order_by(
        NameReactionRecord.session_date.desc()).limit(10).all()
    return jsonify([{
        'id': r.id,
        'session_date': r.session_date.isoformat(),
        'success_count': r.success_count,
        'round_total': r.round_total,
        'avg_reaction_time': r.avg_reaction_time,
        'round_details': r.round_details,
        'ai_analysis': r.ai_analysis,
        'accuracy': round((r.success_count / r.round_total * 100), 2) if r.round_total > 0 else 0
    } for r in records])


# ---------- 指物练习（保持不变） ----------
@games_bp.route('/point-game', methods=['POST'])
def save_point_game():
    data = request.json
    print("📥 收到指物练习数据:", data)

    total_rounds = data.get('round_total', 8)
    correct_rounds = data.get('correct_rounds', 0)
    wrong_rounds = data.get('wrong_rounds', 0)
    total_clicks = data.get('total_clicks', 0)
    correct_clicks = data.get('correct_clicks', 0)
    wrong_clicks = data.get('wrong_clicks', 0)

    accuracy = round((correct_rounds / total_rounds * 100), 2) if total_rounds > 0 else 0
    click_accuracy = round((correct_clicks / total_clicks * 100), 2) if total_clicks > 0 else 0

    round_details = data.get('round_details', [])
    total_time_sec = sum(r.get('time_sec', 0) for r in round_details) if round_details else 0
    avg_time_sec = round((total_time_sec / len(round_details)), 2) if round_details else 0
    avg_reaction_time = data.get('avg_reaction_time', avg_time_sec)

    record = PointGameRecord(
        child_id=data['child_id'],
        session_date=date.today(),
        round_total=total_rounds,
        correct_rounds=correct_rounds,
        wrong_rounds=wrong_rounds,
        total_clicks=total_clicks,
        correct_clicks=correct_clicks,
        wrong_clicks=wrong_clicks,
        timeout_count=data.get('timeout_count', 0),
        skip_count=data.get('skip_count', 0),
        total_time_sec=total_time_sec,
        avg_time_sec=avg_time_sec,
        avg_reaction_time=avg_reaction_time,
        accuracy=accuracy,
        click_accuracy=click_accuracy,
        round_details=round_details,
        created_at=datetime.utcnow()
    )
    db.session.add(record)
    db.session.commit()

    print(f"✅ 指物练习记录保存成功，ID: {record.id}")
    return jsonify({
        'success': True,
        'id': record.id,
        'data': {
            'accuracy': accuracy,
            'click_accuracy': click_accuracy,
            'total_time_sec': total_time_sec,
            'avg_time_sec': avg_time_sec
        }
    }), 201


# ---------- 声音小话筒（保持不变） ----------
@games_bp.route('/voice-game', methods=['POST'])
def save_voice_game():
    data = request.json
    record = VoiceGameRecord(
        child_id=data['child_id'],
        session_date=date.today(),
        round_total=data.get('round_total', 8),
        completed_rounds=data.get('completed_rounds', 0),
        success_count=data.get('success_count', 0),
        round_details=data.get('round_details', [])
    )
    db.session.add(record)
    db.session.commit()
    return jsonify({'id': record.id}), 201

    # ---------- 首页今日推荐数据 ----------
@games_bp.route('/recommendations/<int:child_id>', methods=['GET'])
def get_home_recommendations(child_id):
    """首页今日推荐：返回三类训练的最近一次数据库记录"""

    def calc_name_rate(record):
        if not record or not record.round_total:
            return None
        return round(record.success_count / record.round_total * 100, 1)

    def calc_point_rate(record):
        if not record:
            return None
        if record.accuracy is not None:
            return float(record.accuracy)
        if record.round_total:
            return round(record.correct_rounds / record.round_total * 100, 1)
        return None

    def calc_voice_rate(record):
        if not record:
            return None
        base = record.completed_rounds or record.round_total or 0
        if base <= 0:
            return None
        return round(record.success_count / base * 100, 1)

    name_record = NameReactionRecord.query.filter_by(child_id=child_id) \
        .order_by(NameReactionRecord.id.desc()) \
        .first()

    point_record = PointGameRecord.query.filter_by(child_id=child_id) \
        .order_by(PointGameRecord.id.desc()) \
        .first()

    voice_record = VoiceGameRecord.query.filter_by(child_id=child_id) \
        .order_by(VoiceGameRecord.id.desc()) \
        .first()

    name_rate = calc_name_rate(name_record)
    point_rate = calc_point_rate(point_record)
    voice_rate = calc_voice_rate(voice_record)

    data = {
        'name': {
            'game_key': 'name',
            'title': '叫名反应',
            'last_rate': name_rate,
            'has_data': name_rate is not None,
            'last_date': name_record.session_date.isoformat() if name_record else None,
            'summary': (
                f'上次 {name_record.success_count}/{name_record.round_total} 成功'
                if name_record else '还没有训练记录'
            )
        },
        'point': {
            'game_key': 'point',
            'title': '指物练习',
            'last_rate': point_rate,
            'has_data': point_rate is not None,
            'last_date': point_record.session_date.isoformat() if point_record else None,
            'summary': (
                f'上次正确 {point_record.correct_rounds}/{point_record.round_total}'
                if point_record else '还没有训练记录'
            )
        },
        'mic': {
            'game_key': 'mic',
            'title': '声音小话筒',
            'last_rate': voice_rate,
            'has_data': voice_rate is not None,
            'last_date': voice_record.session_date.isoformat() if voice_record else None,
            'summary': (
                f'上次成功 {voice_record.success_count}/{voice_record.completed_rounds or voice_record.round_total}'
                if voice_record else '还没有训练记录'
            )
        }
    }

    # 推荐排序：
    # 1. 没有训练过的优先推荐
    # 2. 有数据时，成功率低的优先推荐
    order = sorted(
        ['name', 'point', 'mic'],
        key=lambda k: (
            data[k]['has_data'],
            data[k]['last_rate'] if data[k]['last_rate'] is not None else -1
        )
    )

    return jsonify({
        'success': True,
        'data': data,
        'order': order
    })