from flask import Blueprint, request, jsonify
from models import db, EmotionGameRecord, Child, AITokenUsage
from datetime import datetime
from config import Config
from rag import retrieve, build_query_for_retrieval
from routes.auth import create_notification
from utils import calculate_month_age, save_token_usage, call_bailian_ai

emotion_game_ai_bp = Blueprint('emotion_game_ai', __name__)


def get_recent_records(child_id, limit=5):
    return EmotionGameRecord.query.filter_by(child_id=child_id)\
        .order_by(EmotionGameRecord.id.desc()).limit(limit).all()


def build_single_analysis_prompt(child_name, age_months, record):
    accuracy = (record.correct_count / record.round_total * 100) if record.round_total > 0 else 0
    round_details = record.round_details or []
    early_rounds = round_details[:4] if len(round_details) >= 4 else round_details
    late_rounds = round_details[-4:] if len(round_details) >= 4 else round_details
    early_correct = sum(1 for r in early_rounds if r.get('correct'))
    late_correct = sum(1 for r in late_rounds if r.get('correct'))

    fatigue_note = ""
    if early_correct > late_correct:
        fatigue_note = "后半段正确率有所下降，可能存在注意力疲劳"
    elif late_correct > early_correct:
        fatigue_note = "后半段表现更好，说明孩子进入状态需要一些时间"

    prompt = f"""你是一位儿童发育行为顾问，请根据以下情绪识别游戏数据给家长一段温暖的分析（200字以内）。

【孩子信息】{child_name}，{age_months}个月

【本次情绪识别数据】
总轮数：{record.round_total}轮
正确次数：{record.correct_count}次
正确率：{accuracy:.1f}%
前4轮正确：{early_correct}/4 | 后4轮正确：{late_correct}/4
{f'注意力分析：{fatigue_note}' if fatigue_note else ''}

请用1-2句比喻评价情绪识别能力，点出1个数据亮点，给出1条温柔建议。语言亲切，避免专业术语。"""

    return prompt


def build_trend_analysis_prompt(child_name, age_months, records):
    if len(records) < 2:
        r = records[0]
        accuracy = (r.correct_count / r.round_total * 100) if r.round_total > 0 else 0
        return f"""{child_name}，{age_months}个月，首次情绪识别正确率{accuracy:.0f}%。请鼓励家长继续训练。"""

    latest = records[0]
    prev = records[1:]
    latest_acc = (latest.correct_count / latest.round_total * 100) if latest.round_total > 0 else 0
    prev_avg = sum((r.correct_count / r.round_total * 100) if r.round_total > 0 else 0 for r in prev) / len(prev)
    diff = latest_acc - prev_avg
    change = f"提高了{diff:.1f}%" if diff > 0 else (f"下降了{abs(diff):.1f}%" if diff < 0 else "基本持平")

    prompt = f"""你是一位儿童发育行为顾问，请分析情绪识别游戏趋势。

【孩子】{child_name}，{age_months}个月
【最新】正确率{latest_acc:.0f}%（{latest.correct_count}/{latest.round_total}）
【前{len(prev)}次平均】正确率{prev_avg:.0f}%
【变化】{change}

请用温暖的语言分析趋势，指出情绪识别能力在ASD共情发展中的意义，给出2-3条家庭练习建议。"""

    return prompt


# ========== API ==========

@emotion_game_ai_bp.route('/single-analysis', methods=['POST'])
def single_analysis():
    data = request.json
    child_id = data.get('child_id')
    record_id = data.get('record_id')

    if not child_id or not record_id:
        return jsonify({'success': False, 'message': '参数错误'}), 400

    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404

    record = EmotionGameRecord.query.get(record_id)
    if not record:
        return jsonify({'success': False, 'message': '记录不存在'}), 404

    if record.ai_analysis:
        return jsonify({'success': True, 'data': {'ai_analysis': record.ai_analysis, 'from_cache': True}}), 200

    age_months = calculate_month_age(child.birth_date)
    accuracy = (record.correct_count / record.round_total * 100) if record.round_total > 0 else 0
    retrieval_query = build_query_for_retrieval('survey', age_months, f"情绪识别 正确率{accuracy:.0f}%")
    extra_knowledge = retrieve(retrieval_query)

    prompt = build_single_analysis_prompt(child.name, age_months, record)
    ai_analysis, usage = call_bailian_ai(prompt, extra_knowledge, 'survey', max_tokens=500)

    if ai_analysis:
        record.ai_analysis = ai_analysis
        db.session.commit()

    save_token_usage('emotion_single', record_id, child_id, Config.BAILIAN_MODEL, usage)
    return jsonify({'success': True, 'data': {'ai_analysis': ai_analysis, 'from_cache': False}}), 200


@emotion_game_ai_bp.route('/trend-analysis/<int:child_id>', methods=['GET'])
def trend_analysis(child_id):
    limit = request.args.get('limit', 5, type=int)
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404

    records = get_recent_records(child_id, limit)
    if not records:
        return jsonify({'success': True, 'data': {'records': [], 'ai_analysis': None}}), 200

    age_months = calculate_month_age(child.birth_date)
    latest_acc = (records[0].correct_count / records[0].round_total * 100) if records[0].round_total > 0 else 0
    retrieval_query = build_query_for_retrieval('survey', age_months, f"情绪识别趋势 正确率{latest_acc:.0f}%")
    extra_knowledge = retrieve(retrieval_query)

    prompt = build_trend_analysis_prompt(child.name, age_months, records)
    ai_analysis, usage = call_bailian_ai(prompt, extra_knowledge, 'survey', max_tokens=1000)
    save_token_usage('emotion_trend', None, child_id, Config.BAILIAN_MODEL, usage)

    records_data = [{
        'id': r.id, 'session_date': r.session_date.isoformat(),
        'correct_count': r.correct_count, 'round_total': r.round_total,
        'accuracy': round((r.correct_count / r.round_total * 100), 2) if r.round_total > 0 else 0,
        'round_details': r.round_details
    } for r in records]

    return jsonify({'success': True, 'data': {'records': records_data, 'ai_analysis': ai_analysis}}), 200


@emotion_game_ai_bp.route('/records/<int:child_id>', methods=['GET'])
def get_records(child_id):
    limit = request.args.get('limit', 7, type=int)
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404

    records = get_recent_records(child_id, limit)
    records_data = [{
        'id': r.id, 'session_date': r.session_date.isoformat(),
        'correct_count': r.correct_count, 'round_total': r.round_total,
        'accuracy': round((r.correct_count / r.round_total * 100), 2) if r.round_total > 0 else 0,
        'round_details': r.round_details, 'ai_analysis': r.ai_analysis
    } for r in records]

    return jsonify({'success': True, 'data': {'records': records_data}}), 200
