from flask import Blueprint, request, jsonify
from models import db, PointGameRecord, Child, AITokenUsage
from datetime import datetime
import requests
import json
from config import Config
from rag import retrieve, build_system_prompt, build_query_for_retrieval
from routes.auth import create_notification

point_game_ai_bp = Blueprint('point_game_ai', __name__)


def calculate_month_age(birth_date):
    if not birth_date:
        return 0
    today = datetime.now().date()
    months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
    return max(0, months)


def get_recent_records(child_id, limit=5):
    records = PointGameRecord.query.filter_by(child_id=child_id)\
        .order_by(PointGameRecord.session_date.desc())\
        .limit(limit).all()
    return records


def save_token_usage(record_type, record_id, child_id, model_name, usage_data):
    """保存token使用记录"""
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


def build_single_analysis_prompt(child_name, age_months, record):
    total_rounds = record.round_total
    correct_rounds = record.correct_rounds
    wrong_rounds = record.wrong_rounds
    accuracy = float(record.accuracy) if record.accuracy else 0
    
    total_clicks = record.total_clicks
    correct_clicks = record.correct_clicks
    wrong_clicks = record.wrong_clicks
    click_accuracy = float(record.click_accuracy) if record.click_accuracy else 0
    
    timeout_count = record.timeout_count
    skip_count = record.skip_count
    total_time_sec = float(record.total_time_sec) if record.total_time_sec else 0
    avg_time_sec = float(record.avg_time_sec) if record.avg_time_sec else 0
    
    round_details = record.round_details or []
    early_rounds = round_details[:4] if len(round_details) >= 4 else round_details
    late_rounds = round_details[-4:] if len(round_details) >= 4 else round_details
    early_success = sum(1 for r in early_rounds if r.get('success'))
    late_success = sum(1 for r in late_rounds if r.get('success'))
    
    fatigue_note = ""
    if early_success > late_success:
        fatigue_note = "后半段正确率有所下降，可能存在注意力疲劳"
    elif late_success > early_success:
        fatigue_note = "后半段表现更好，说明孩子进入状态需要一些时间"
    
    prompt = f"""你是一位资深的儿童发育行为顾问，专门为2-6岁孤独症谱系障碍儿童的家庭提供温暖的支持。

【孩子信息】{child_name}，{age_months}个月

【本次指物练习数据】
总轮数：{total_rounds}轮 | 正确：{correct_rounds}轮 | 错误：{wrong_rounds}轮 | 正确率：{accuracy}%
总点击：{total_clicks}次（正确{correct_clicks}/错误{wrong_clicks}）| 点击准确率：{click_accuracy}%
总用时：{total_time_sec}秒 | 平均：{avg_time_sec}秒/轮
超时：{timeout_count}次 | 跳过：{skip_count}次
前4轮正确：{early_success}/4 | 后4轮正确：{late_success}/4
{f'注意力分析：{fatigue_note}' if fatigue_note else ''}

请用200字以内的温暖语气分析本次表现，包括：1个比喻评价、1-2个数据亮点、1个温柔建议。"""

    return prompt


def build_trend_analysis_prompt(child_name, age_months, records):
    """构建趋势分析的prompt - 最新一次 vs 前面几次综合平均"""
    
    if len(records) < 2:
        # 只有一次数据
        r = records[0]
        accuracy = float(r.accuracy) if r.accuracy else 0
        return f"""请根据以下指物练习数据给出简单评价（100字以内）。

【孩子】{child_name}，{age_months}个月
【首次训练】正确率{accuracy}%，{r.correct_rounds}/{r.round_total}轮正确

请鼓励家长，并建议继续训练以看到趋势。语言温暖，不用比喻。"""
    
    # 分离最新一次和前面几次
    latest = records[0]
    previous_records = records[1:]  # 前面几次（不包含最新）
    
    # 计算最新一次数据
    latest_accuracy = float(latest.accuracy) if latest.accuracy else 0
    latest_click_accuracy = float(latest.click_accuracy) if latest.click_accuracy else 0
    latest_avg_time = float(latest.avg_time_sec) if latest.avg_time_sec else 0
    latest_total_time = float(latest.total_time_sec) if latest.total_time_sec else 0
    
    # 计算前面几次的综合平均
    prev_count = len(previous_records)
    prev_avg_accuracy = sum(float(r.accuracy or 0) for r in previous_records) / prev_count
    prev_avg_click_accuracy = sum(float(r.click_accuracy or 0) for r in previous_records) / prev_count
    prev_avg_time = sum(float(r.avg_time_sec or 0) for r in previous_records) / prev_count
    prev_avg_total_time = sum(float(r.total_time_sec or 0) for r in previous_records) / prev_count
    prev_avg_timeout = sum(r.timeout_count or 0 for r in previous_records) / prev_count
    prev_avg_skip = sum(r.skip_count or 0 for r in previous_records) / prev_count
    
    # 计算变化
    accuracy_diff = latest_accuracy - prev_avg_accuracy
    click_diff = latest_click_accuracy - prev_avg_click_accuracy
    time_diff = prev_avg_time - latest_avg_time  # 正数表示变快了
    
    # 构建前几次的摘要
    prev_summary = f"前{prev_count}次平均：正确率{prev_avg_accuracy:.1f}%，点击准确率{prev_avg_click_accuracy:.1f}%，平均{prev_avg_time:.1f}秒/轮，总用时{prev_avg_total_time:.1f}秒，超时{prev_avg_timeout:.1f}次，跳过{prev_avg_skip:.1f}次"
    
    # 构建变化描述
    changes = []
    if accuracy_diff > 0:
        changes.append(f"正确率提高了{accuracy_diff:.1f}个百分点")
    elif accuracy_diff < 0:
        changes.append(f"正确率下降了{abs(accuracy_diff):.1f}个百分点")
    else:
        changes.append("正确率保持不变")
    
    if click_diff > 0:
        changes.append(f"点击准确率提高了{click_diff:.1f}个百分点")
    elif click_diff < 0:
        changes.append(f"点击准确率下降了{abs(click_diff):.1f}个百分点")
    else:
        changes.append("点击准确率保持不变")
    
    if time_diff > 0.5:
        changes.append(f"反应速度加快了{time_diff:.1f}秒")
    elif time_diff < -0.5:
        changes.append(f"反应速度慢了{abs(time_diff):.1f}秒")
    else:
        changes.append("反应速度基本稳定")
    
    change_text = "；".join(changes)
    
    prompt = f"""你是一位儿童发育行为顾问，请根据以下指物练习数据给出分析。用家长能看懂的语言，不要用比喻。

【孩子】{child_name}，{age_months}个月

【最新一次训练（{latest.session_date}）】
正确率：{latest_accuracy}%（{latest.correct_rounds}/{latest.round_total}轮）
点击准确率：{latest_click_accuracy}%（正确{latest.correct_clicks}次/总{latest.total_clicks}次）
平均用时：{latest_avg_time}秒/轮
总用时：{latest_total_time}秒
超时：{latest.timeout_count}次
跳过：{latest.skip_count}次

【前{prev_count}次训练综合平均】
{prev_summary}

【最新一次与前{prev_count}次平均的对比】
{change_text}

请按以下结构输出详细分析报告（语言温暖亲切，像朋友聊天）：

一、整体趋势评估
- 用通俗语言解读孩子的整体表现变化方向
- 说明"共同注意"能力变化在ASD发展中的意义
- 温暖地肯定孩子和家长的努力

二、数据详细解读
- 分析正确率和点击准确率的变化各自说明什么
- 如果正确率高但点击准确率低，提示注意力或冲动控制需关注
- 超时/跳过次数变化的原因分析和调整建议
- 从共同注意和社交动机角度深入解读

三、家庭练习建议
- 给出3-4条具体可操作的、融入日常生活的练习建议
- 每条说明"为什么这样做"和"具体怎么做"
- 建议要针对数据中反映的具体问题

四、下一阶段目标
- 设定1-2个具体可达成的阶段性小目标
- 鼓励家长继续坚持，强调指物分享对社交发展的核心作用"""

    return prompt

def call_ai(prompt, extra_knowledge='', analysis_type='point', max_tokens=500):
    """调用AI（集成RAG）并返回内容和token信息"""
    try:
        url = f"{Config.POINT_GAME_AI_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {Config.POINT_GAME_AI_API_KEY}",
            "Content-Type": "application/json"
        }

        system_content = build_system_prompt(analysis_type, extra_knowledge)

        payload = {
            "model": Config.POINT_GAME_AI_MODEL,
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": max_tokens,
            "enable_thinking": False
        }
        
        print(f"🤖 调用AI: {Config.POINT_GAME_AI_MODEL}")
        response = requests.post(url, json=payload, headers=headers)
        result = response.json()
        
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            print(f"✅ AI完成 | tokens: {usage.get('total_tokens', 'N/A')}")
            return content, usage
        else:
            print(f"❌ AI失败: {result}")
            return None, {}
            
    except Exception as e:
        print(f"❌ AI异常: {e}")
        return None, {}


# ========== API路由 ==========

@point_game_ai_bp.route('/single-analysis', methods=['POST'])
def single_analysis():
    """单次训练结束后，AI分析本次数据"""
    data = request.json
    child_id = data.get('child_id')
    record_id = data.get('record_id')
    
    if not child_id or not record_id:
        return jsonify({'success': False, 'message': '参数错误'}), 400
    
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404
    
    record = PointGameRecord.query.get(record_id)
    if not record:
        return jsonify({'success': False, 'message': '记录不存在'}), 404
    
    # 如果已经有AI分析，直接返回
    if record.ai_analysis:
        return jsonify({
            'success': True,
            'data': {
                'record_id': record_id,
                'ai_analysis': record.ai_analysis,
                'from_cache': True,
                'accuracy': float(record.accuracy) if record.accuracy else 0,
                'click_accuracy': float(record.click_accuracy) if record.click_accuracy else 0,
                'avg_time_sec': float(record.avg_time_sec) if record.avg_time_sec else 0,
                'round_details': record.round_details
            }
        }), 200
    
    # 否则调用AI分析
    age_months = calculate_month_age(child.birth_date)

    # RAG 检索专业知识
    accuracy = float(record.accuracy) if record.accuracy else 0
    retrieval_query = build_query_for_retrieval(
        'point', age_months,
        f"指物练习 正确率{accuracy:.0f}% 共{record.round_total}轮 正确{record.correct_rounds}轮"
    )
    extra_knowledge = retrieve(retrieval_query)

    prompt = build_single_analysis_prompt(child.name, age_months, record)
    ai_analysis, usage = call_ai(prompt, extra_knowledge, 'point', max_tokens=1000)
    
    # 保存AI结果
    if ai_analysis:
        record.ai_analysis = ai_analysis
        db.session.commit()
    
    # 记录token使用
    save_token_usage('point_single', record_id, child_id, Config.POINT_GAME_AI_MODEL, usage)
    
    
    # 通知用户
    from models import User as _User
    _u = _User.query.get(child.user_id)
    acc = float(record.accuracy) if record.accuracy else 0
    if _u:
        create_notification(_u.id, 'system_report',
            f'{child.name}的指物练习分析已生成',
            f'本次正确率：{acc:.0f}%，点击查看详情',
            related_id=record_id)


    return jsonify({
        'success': True,
        'data': {
            'record_id': record_id,
            'ai_analysis': ai_analysis,
            'from_cache': False,
            'tokens': usage.get('total_tokens', 0),
            'accuracy': float(record.accuracy) if record.accuracy else 0,
            'click_accuracy': float(record.click_accuracy) if record.click_accuracy else 0,
            'avg_time_sec': float(record.avg_time_sec) if record.avg_time_sec else 0,
            'round_details': record.round_details
        }
    }), 200

@point_game_ai_bp.route('/trend-analysis/<int:child_id>', methods=['GET'])
def trend_analysis(child_id):
    """趋势分析（调用AI）"""
    limit = request.args.get('limit', 5, type=int)
    
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404
    
    records = get_recent_records(child_id, limit)
    
    if not records:
        return jsonify({
            'success': True,
            'data': {
                'records': [],
                'ai_analysis': None,
                'child_name': child.name
            }
        }), 200
    
    age_months = calculate_month_age(child.birth_date)
    
    records_data = [{
        'id': r.id,
        'session_date': r.session_date.isoformat(),
        'round_total': r.round_total,
        'correct_rounds': r.correct_rounds,
        'wrong_rounds': r.wrong_rounds,
        'total_clicks': r.total_clicks,
        'correct_clicks': r.correct_clicks,
        'wrong_clicks': r.wrong_clicks,
        'timeout_count': r.timeout_count,
        'skip_count': r.skip_count,
        'total_time_sec': float(r.total_time_sec) if r.total_time_sec else 0,
        'avg_time_sec': float(r.avg_time_sec) if r.avg_time_sec else 0,
        'avg_reaction_time': float(r.avg_reaction_time) if r.avg_reaction_time else 0,
        'accuracy': float(r.accuracy) if r.accuracy else 0,
        'click_accuracy': float(r.click_accuracy) if r.click_accuracy else 0,
        'ai_analysis': r.ai_analysis,
        'round_details': r.round_details
    } for r in records]
    
    # RAG 检索专业知识
    latest_accuracy = float(records[0].accuracy) if records[0].accuracy else 0
    retrieval_query = build_query_for_retrieval(
        'point', age_months,
        f"指物练习趋势分析 最新正确率{latest_accuracy:.0f}% 共{len(records)}次记录"
    )
    extra_knowledge = retrieve(retrieval_query)

    # 调用AI趋势分析
    prompt = build_trend_analysis_prompt(child.name, age_months, records)
    ai_analysis, usage = call_ai(prompt, extra_knowledge, 'point', max_tokens=1000)
    
    # 记录token使用
    save_token_usage('point_trend', None, child_id, Config.POINT_GAME_AI_MODEL, usage)
    
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


@point_game_ai_bp.route('/point-records/<int:child_id>', methods=['GET'])
def get_point_records(child_id):
    """只获取数据，不调用AI"""
    limit = request.args.get('limit', 7, type=int)
    
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404
    
    records = get_recent_records(child_id, limit)
    
    records_data = [{
        'id': r.id,
        'session_date': r.session_date.isoformat(),
        'round_total': r.round_total,
        'correct_rounds': r.correct_rounds,
        'wrong_rounds': r.wrong_rounds,
        'total_clicks': r.total_clicks,
        'correct_clicks': r.correct_clicks,
        'wrong_clicks': r.wrong_clicks,
        'timeout_count': r.timeout_count,
        'skip_count': r.skip_count,
        'total_time_sec': float(r.total_time_sec) if r.total_time_sec else 0,
        'avg_time_sec': float(r.avg_time_sec) if r.avg_time_sec else 0,
        'avg_reaction_time': float(r.avg_reaction_time) if r.avg_reaction_time else 0,
        'accuracy': float(r.accuracy) if r.accuracy else 0,
        'click_accuracy': float(r.click_accuracy) if r.click_accuracy else 0,
        'round_details': r.round_details
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