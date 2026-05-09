from flask import Blueprint, request, jsonify
from models import db, VoiceGameRecord, Child, AITokenUsage
from datetime import datetime
import requests
from config import Config
from rag import retrieve, build_system_prompt, build_query_for_retrieval

voice_game_ai_bp = Blueprint('voice_game_ai', __name__)


def calculate_month_age(birth_date):
    if not birth_date:
        return 0
    today = datetime.now().date()
    months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
    return max(0, months)


def get_recent_records(child_id, limit=5):
    records = VoiceGameRecord.query.filter_by(child_id=child_id) \
        .order_by(VoiceGameRecord.session_date.desc()) \
        .limit(limit).all()
    return records


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


def call_ai(prompt, extra_knowledge='', analysis_type='voice', max_tokens=500):
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
            "max_tokens": max_tokens
        }
        print(f"🤖 声音小话筒AI调用: {Config.BAILIAN_MODEL}")
        response = requests.post(url, json=payload, headers=headers)
        result = response.json()
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            print(f"✅ 声音小话筒AI完成 | tokens: {usage.get('total_tokens', 'N/A')}")
            return content, usage
        else:
            print(f"❌ AI失败: {result}")
            return None, {}
    except Exception as e:
        print(f"❌ AI异常: {e}")
        return None, {}


def build_single_analysis_prompt(child_name, age_months, record):
    completion_rate = (record.completed_rounds / record.round_total * 100) if record.round_total > 0 else 0
    success_rate = (record.success_count / record.completed_rounds * 100) if record.completed_rounds > 0 else 0
    round_details = record.round_details or []
    early_success = sum(1 for r in round_details[:4] if r.get('success')) if len(round_details) >= 4 else 0
    late_success = sum(1 for r in round_details[-4:] if r.get('success')) if len(round_details) >= 4 else 0
    fatigue_note = ""
    if early_success > late_success:
        fatigue_note = "后半段成功率有所下降，可能存在注意力波动"
    elif late_success > early_success and early_success > 0:
        fatigue_note = "后半段表现更好，孩子可能需要时间进入状态"

    prompt = f"""你是一位儿童发育行为顾问，请根据以下"声音小话筒"（跟读/发音模仿）游戏数据给家长一段温暖的分析（200字以内）。

【孩子信息】{child_name}，{age_months}个月

【本次训练数据】
总轮数：{record.round_total}轮
完成轮数：{record.completed_rounds}轮（完成率{completion_rate:.1f}%）
成功（发音准确）轮数：{record.success_count}轮
成功率（占完成轮数）：{success_rate:.1f}%
前4轮成功：{early_success}次
后4轮成功：{late_success}次
{f'注意：{fatigue_note}' if fatigue_note else ''}

请用1-2句比喻评价整体表现，点出1个数据亮点，给出1条温柔建议（比如如何鼓励发音、降低难度）。语言亲切，避免专业术语。"""
    return prompt


def build_trend_analysis_prompt(child_name, age_months, records):
    if len(records) < 2:
        r = records[0]
        completion_rate = (r.completed_rounds / r.round_total * 100) if r.round_total > 0 else 0
        success_rate = (r.success_count / r.completed_rounds * 100) if r.completed_rounds > 0 else 0
        return f"""请根据以下声音小话筒数据给出简单评价（100字以内）。

【孩子】{child_name}，{age_months}个月
【首次训练】完成率{completion_rate:.1f}%，成功率{success_rate:.1f}%，成功{r.success_count}/{r.completed_rounds}轮

请鼓励家长继续训练，语言温暖，不用比喻。"""

    latest = records[0]
    previous = records[1:]
    prev_count = len(previous)

    latest_completion = (latest.completed_rounds / latest.round_total * 100) if latest.round_total > 0 else 0
    latest_success = (latest.success_count / latest.completed_rounds * 100) if latest.completed_rounds > 0 else 0

    prev_avg_completion = sum(
        (r.completed_rounds / r.round_total * 100) for r in previous if r.round_total > 0) / max(prev_count, 1)
    prev_avg_success = sum(
        (r.success_count / r.completed_rounds * 100) for r in previous if r.completed_rounds > 0) / max(prev_count, 1)

    completion_diff = latest_completion - prev_avg_completion
    success_diff = latest_success - prev_avg_success

    prompt = f"""你是一位儿童发育行为顾问，请根据以下声音小话筒数据给出一份详细的分析报告。

请按以下结构输出（语言温暖亲切，像朋友聊天）：

一、整体趋势评估
- 用通俗语言解读孩子的整体表现变化方向
- 说明声音模仿能力的变化在语言发展中的意义
- 温暖地肯定孩子和家长的努力

二、数据详细解读
- 分析完成率和发音准确率的变化各自说明什么
- 如果完成率低但准确率高，说明孩子有模仿能力但动机需增强
- 如果两者均低，说明需要从更简单的声音和更高的趣味性入手
- 从沟通动机和口部运动规划角度深入解读

三、家庭练习建议
- 给出3-4条具体可操作的练习建议
- 每条说明"为什么这样做"和"具体怎么做"
- 建议融入日常互动场景（洗澡、唱歌、讲故事等）

四、下一阶段目标
- 设定1-2个具体可达成的阶段性小目标
- 鼓励家长，强调每一次声音尝试都是宝贵的"""
    return prompt


# ========== API 路由 ==========

@voice_game_ai_bp.route('/single-analysis', methods=['POST'])
def single_analysis():
    data = request.json
    child_id = data.get('child_id')
    record_id = data.get('record_id')
    if not child_id or not record_id:
        return jsonify({'success': False, 'message': '参数错误'}), 400

    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404

    record = VoiceGameRecord.query.get(record_id)
    if not record:
        return jsonify({'success': False, 'message': '记录不存在'}), 404

    if record.ai_analysis:
        return jsonify({
            'success': True,
            'data': {
                'record_id': record_id,
                'ai_analysis': record.ai_analysis,
                'from_cache': True,
                'completion_rate': (
                    record.completed_rounds / record.round_total * 100) if record.round_total > 0 else 0,
                'success_rate': (
                    record.success_count / record.completed_rounds * 100) if record.completed_rounds > 0 else 0
            }
        }), 200

    age_months = calculate_month_age(child.birth_date)

    # RAG 检索专业知识
    completion_rate = (record.completed_rounds / record.round_total * 100) if record.round_total > 0 else 0
    retrieval_query = build_query_for_retrieval(
        'voice', age_months,
        f"声音模仿 完成率{completion_rate:.0f}% 共{record.round_total}轮 成功{record.success_count}次"
    )
    extra_knowledge = retrieve(retrieval_query)

    prompt = build_single_analysis_prompt(child.name, age_months, record)
    ai_analysis, usage = call_ai(prompt, extra_knowledge, 'voice', max_tokens=1000)

    if ai_analysis:
        record.ai_analysis = ai_analysis
        db.session.commit()

    save_token_usage('voice_single', record_id, child_id, Config.BAILIAN_MODEL, usage)

    return jsonify({
        'success': True,
        'data': {
            'record_id': record_id,
            'ai_analysis': ai_analysis,
            'from_cache': False,
            'tokens': usage.get('total_tokens', 0),
            'completion_rate': (record.completed_rounds / record.round_total * 100) if record.round_total > 0 else 0,
            'success_rate': (record.success_count / record.completed_rounds * 100) if record.completed_rounds > 0 else 0
        }
    }), 200


@voice_game_ai_bp.route('/trend-analysis/<int:child_id>', methods=['GET'])
def trend_analysis(child_id):
    limit = request.args.get('limit', 5, type=int)
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404

    records = get_recent_records(child_id, limit)
    if not records:
        return jsonify({'success': True, 'data': {'records': [], 'ai_analysis': None, 'child_name': child.name}}), 200

    age_months = calculate_month_age(child.birth_date)

    records_data = [{
        'id': r.id,
        'session_date': r.session_date.isoformat(),
        'round_total': r.round_total,
        'completed_rounds': r.completed_rounds,
        'success_count': r.success_count,
        'ai_analysis': r.ai_analysis,
        'round_details': r.round_details,
        # 新增字段，前端数据看板需要
        'accuracy': round(
            (r.success_count / r.completed_rounds * 100), 2) if r.completed_rounds > 0 else 0,
        'completion_rate': round(
            (r.completed_rounds / r.round_total * 100), 2) if r.round_total > 0 else 0
    } for r in records]

    # RAG 检索专业知识
    latest_success_rate = (records[0].success_count / records[0].completed_rounds * 100) if records[0].completed_rounds > 0 else 0
    retrieval_query = build_query_for_retrieval(
        'voice', age_months,
        f"声音模仿趋势分析 最新成功率{latest_success_rate:.0f}% 共{len(records)}次记录"
    )
    extra_knowledge = retrieve(retrieval_query)

    prompt = build_trend_analysis_prompt(child.name, age_months, records)
    ai_analysis, usage = call_ai(prompt, extra_knowledge, 'voice', max_tokens=1000)
    save_token_usage('voice_trend', None, child_id, Config.BAILIAN_MODEL, usage)

    return jsonify({
        'success': True,
        'data': {
            'records': records_data,
            'ai_analysis': ai_analysis,
            'child_name': child.name,
            'age_months': age_months,
            'total_records': len(records),
            'tokens': usage.get('total_tokens', 0)
        }
    }), 200


@voice_game_ai_bp.route('/records/<int:child_id>', methods=['GET'])
def get_records(child_id):
    limit = request.args.get('limit', 7, type=int)
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404

    records = get_recent_records(child_id, limit)
    records_data = [{
        'id': r.id,
        'session_date': r.session_date.isoformat(),
        'round_total': r.round_total,
        'completed_rounds': r.completed_rounds,
        'success_count': r.success_count,
        'round_details': r.round_details,
        'ai_analysis': r.ai_analysis,
        # 新增字段，前端数据看板需要
        'accuracy': round(
            (r.success_count / r.completed_rounds * 100), 2) if r.completed_rounds > 0 else 0,
        'completion_rate': round(
            (r.completed_rounds / r.round_total * 100), 2) if r.round_total > 0 else 0
    } for r in records] if records else []

    return jsonify({
        'success': True,
        'data': {
            'records': records_data,
            'child_name': child.name,
            'age_months': calculate_month_age(child.birth_date),
            'total_records': len(records_data)
        }
    }), 200