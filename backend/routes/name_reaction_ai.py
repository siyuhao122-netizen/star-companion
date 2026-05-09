from flask import Blueprint, request, jsonify
from models import db, NameReactionRecord, Child, AITokenUsage
from datetime import datetime
import requests
from config import Config
from rag import retrieve, build_system_prompt, build_query_for_retrieval
from routes.auth import create_notification

name_reaction_ai_bp = Blueprint('name_reaction_ai', __name__)


def calculate_month_age(birth_date):
    if not birth_date:
        return 0
    today = datetime.now().date()
    months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
    return max(0, months)


def get_recent_records(child_id, limit=5):
    return NameReactionRecord.query.filter_by(child_id=child_id) \
        .order_by(NameReactionRecord.session_date.desc()) \
        .limit(limit).all()


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
    except Exception as e:
        print(f"⚠️ Token记录保存失败: {e}")


def call_ai(prompt, extra_knowledge='', analysis_type='name', max_tokens=500):
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
        print(f"🤖 叫名反应AI调用: {Config.BAILIAN_MODEL}")
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        result = response.json()
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            print(f"✅ 叫名反应AI完成 | tokens: {usage.get('total_tokens', 'N/A')}")
            return content, usage
        else:
            print(f"❌ AI失败: {result}")
            return None, {}
    except Exception as e:
        print(f"❌ AI异常: {e}")
        return None, {}


def build_single_analysis_prompt(child_name, age_months, record):
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


def build_trend_analysis_prompt(child_name, age_months, records):
    if len(records) < 2:
        r = records[0]
        success_rate = (r.success_count / r.round_total * 100) if r.round_total > 0 else 0
        return f"""请根据以下叫名反应数据给出简单评价（100字以内）。

【孩子】{child_name}，{age_months}个月
【首次训练】成功率{success_rate:.1f}%，成功{r.success_count}/{r.round_total}轮

请鼓励家长继续训练，语言温暖，不用比喻。"""

    latest = records[0]
    previous = records[1:]
    prev_count = len(previous)

    latest_rate = (latest.success_count / latest.round_total * 100) if latest.round_total > 0 else 0
    prev_avg_rate = sum((r.success_count / r.round_total * 100) for r in previous if r.round_total > 0) / prev_count
    latest_time = float(latest.avg_reaction_time) if latest.avg_reaction_time else 0
    prev_avg_time = sum(float(r.avg_reaction_time or 0) for r in previous) / prev_count

    rate_diff = latest_rate - prev_avg_rate
    time_diff = prev_avg_time - latest_time

    prompt = f"""你是一位儿童发育行为顾问，请根据以下叫名反应训练数据给出一份详细的分析报告。

【孩子】{child_name}，{age_months}个月

【最新一次训练（{latest.session_date}）】
成功率：{latest_rate:.1f}%（{latest.success_count}/{latest.round_total}轮）
平均反应时间：{latest_time:.2f}秒

【前{prev_count}次训练平均】
成功率：{prev_avg_rate:.1f}%
平均反应时间：{prev_avg_time:.2f}秒

【对比变化】
成功率{'提高' if rate_diff > 0 else '下降' if rate_diff < 0 else '持平'}了{abs(rate_diff):.1f}个百分点
反应速度{'变快' if time_diff > 0 else '变慢' if time_diff < 0 else '稳定'}

请按以下结构输出分析报告（语言温暖亲切，像朋友聊天）：

一、整体趋势评估
- 用通俗易懂的语言解读孩子的整体表现变化
- 说明这种变化在ASD早期干预中的意义
- 对进步或不稳定给予温暖的解读，强调"坚持就有收获"

二、数据详细解读
- 具体分析成功率和反应时间的变化意味着什么
- 从叫名反应的核心能力（社会定向、听觉处理、自我意识）角度解读
- 如果存在前后段差异或疲劳效应，给出针对性建议

三、家庭练习建议
- 给出3-4条具体可操作的家庭游戏建议
- 每条建议说明"为什么这样做"和"怎么做"
- 建议要融入日常生活场景（吃饭、洗澡、玩耍等）

四、下一阶段目标
- 设定1-2个具体可达成的阶段性小目标
- 鼓励家长，肯定他们已经付出的努力"""
    return prompt


# ========== API 路由 ==========

@name_reaction_ai_bp.route('/single-analysis', methods=['POST'])
def single_analysis():
    data = request.json
    child_id = data.get('child_id')
    record_id = data.get('record_id')
    if not child_id or not record_id:
        return jsonify({'success': False, 'message': '参数错误'}), 400

    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404

    record = NameReactionRecord.query.get(record_id)
    if not record:
        return jsonify({'success': False, 'message': '记录不存在'}), 404

    if record.ai_analysis:
        return jsonify({
            'success': True,
            'data': {
                'record_id': record_id,
                'ai_analysis': record.ai_analysis,
                'from_cache': True,
                'success_rate': (record.success_count / record.round_total * 100) if record.round_total > 0 else 0,
                'avg_reaction_time': float(record.avg_reaction_time) if record.avg_reaction_time else 0
            }
        }), 200

    age_months = calculate_month_age(child.birth_date)

    # RAG 检索专业知识
    success_rate = (record.success_count / record.round_total * 100) if record.round_total > 0 else 0
    retrieval_query = build_query_for_retrieval(
        'name', age_months,
        f"叫名反应 成功率{success_rate:.0f}% 共{record.round_total}轮 成功{record.success_count}次"
    )
    extra_knowledge = retrieve(retrieval_query)

    prompt = build_single_analysis_prompt(child.name, age_months, record)
    ai_analysis, usage = call_ai(prompt, extra_knowledge, 'name')

    if ai_analysis:
        record.ai_analysis = ai_analysis
        db.session.commit()

    save_token_usage('name_single', record_id, child_id, Config.BAILIAN_MODEL, usage)

    # 通知用户
    from models import User
    user = User.query.get(child.user_id)
    if user:
        create_notification(user.id, 'system_report',
            f'{child.name}的叫名反应分析已生成',
            f'本次成功率：{success_rate:.0f}%，点击查看详情',
            related_id=record_id)

    return jsonify({
        'success': True,
        'data': {
            'record_id': record_id,
            'ai_analysis': ai_analysis,
            'from_cache': False,
            'tokens': usage.get('total_tokens', 0),
            'success_rate': (record.success_count / record.round_total * 100) if record.round_total > 0 else 0,
            'avg_reaction_time': float(record.avg_reaction_time) if record.avg_reaction_time else 0
        }
    }), 200


@name_reaction_ai_bp.route('/trend-analysis/<int:child_id>', methods=['GET'])
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
        'success_count': r.success_count,
        'avg_reaction_time': float(r.avg_reaction_time) if r.avg_reaction_time else 0,
        'ai_analysis': r.ai_analysis,
        'round_details': r.round_details,
        # 新增字段，前端数据看板需要
        'accuracy': round((r.success_count / r.round_total * 100), 2) if r.round_total > 0 else 0,
        'completed_rounds': r.round_total
    } for r in records]

    # RAG 检索专业知识
    latest_rate = (records[0].success_count / records[0].round_total * 100) if records[0].round_total > 0 else 0
    retrieval_query = build_query_for_retrieval(
        'name', age_months,
        f"叫名反应趋势分析 最新成功率{latest_rate:.0f}% 共{len(records)}次记录"
    )
    extra_knowledge = retrieve(retrieval_query)

    prompt = build_trend_analysis_prompt(child.name, age_months, records)
    ai_analysis, usage = call_ai(prompt, extra_knowledge, 'name', max_tokens=1000)
    save_token_usage('name_trend', None, child_id, Config.BAILIAN_MODEL, usage)

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


@name_reaction_ai_bp.route('/records/<int:child_id>', methods=['GET'])
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
        'success_count': r.success_count,
        'avg_reaction_time': float(r.avg_reaction_time) if r.avg_reaction_time else 0,
        'round_details': r.round_details,
        'ai_analysis': r.ai_analysis,
        # 新增字段，前端数据看板需要
        'accuracy': round((r.success_count / r.round_total * 100), 2) if r.round_total > 0 else 0,
        'completed_rounds': r.round_total
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