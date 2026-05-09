from flask import Blueprint, request, jsonify
from models import db, SurveyResult, Child, AITokenUsage, User
from datetime import datetime
import requests
import json
from config import Config
from rag import retrieve, build_system_prompt, build_query_for_retrieval
from routes.auth import create_notification

ai_bp = Blueprint('ai', __name__)


# ========== 量表配置 ==========
SCALES = {
    'mchat': {
        'name': 'M-CHAT-R (婴幼儿孤独症筛查量表)',
        'description': '适用于16-30个月的婴幼儿',
        'total_questions': 20,
        'max_score': 20,
        'reverse_items': [2, 5, 7, 9, 12, 14, 15, 17, 18, 19, 20],
        'risk_levels': [
            {'range': (0, 2), 'level': '低风险', 'color': '#9BBF7A'},
            {'range': (3, 7), 'level': '中风险', 'color': '#D9A066'},
            {'range': (8, 20), 'level': '高风险', 'color': '#D4A0A0'}
        ],
        'dimensions': {
            'social_interaction': {
                'name': '社交互动',
                'items': [1, 2, 4, 6, 10, 12, 14, 16, 19],
                'description': '眼神接触、社交微笑、模仿能力等'
            },
            'joint_attention': {
                'name': '共同注意',
                'items': [7, 8, 9, 13, 15, 17],
                'description': '指物、分享兴趣、回应名字等'
            },
            'behavior_pattern': {
                'name': '行为模式',
                'items': [3, 5, 11, 18, 20],
                'description': '刻板行为、感官敏感、假想游戏等'
            }
        }
    },
    'cast': {
        'name': 'CAST (儿童孤独症谱系测试)',
        'description': '适用于4-11岁的儿童',
        'total_questions': 37,
        'max_score': 37,
        'reverse_items': [1, 5, 8, 12, 15, 19, 23, 26, 30, 31, 32, 33, 34, 35, 36, 37],
        'risk_levels': [
            {'range': (0, 10), 'level': '低风险', 'color': '#9BBF7A'},
            {'range': (11, 14), 'level': '中风险', 'color': '#D9A066'},
            {'range': (15, 37), 'level': '高风险', 'color': '#D4A0A0'}
        ],
        'dimensions': {
            'social_communication': {
                'name': '社交沟通',
                'items': list(range(1, 13)),
                'description': '对话能力、社交理解、非语言沟通等'
            },
            'restricted_behavior': {
                'name': '刻板行为与兴趣',
                'items': list(range(13, 25)),
                'description': '重复行为、特殊兴趣、仪式化动作等'
            },
            'peer_relationship': {
                'name': '同伴关系',
                'items': list(range(25, 38)),
                'description': '交友能力、团体活动、社交规则理解等'
            }
        }
    }
}


def calculate_month_age(birth_date):
    """计算月龄"""
    if not birth_date:
        return 0
    today = datetime.now().date()
    months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
    return max(0, months)


def calculate_score(answers, scale_type):
    """计算总分和各维度得分"""
    config = SCALES[scale_type]
    reverse_items = config['reverse_items']
    
    total_score = 0
    dimension_scores = {}
    
    for dim_key, dim_config in config['dimensions'].items():
        dim_score = 0
        for item_num in dim_config['items']:
            idx = item_num - 1
            if idx < len(answers):
                answer = answers[idx]
                if item_num in reverse_items:
                    dim_score += 1 if answer == 0 else 0
                else:
                    dim_score += answer
        dimension_scores[dim_key] = {
            'name': dim_config['name'],
            'score': dim_score,
            'max': len(dim_config['items']),
            'description': dim_config['description']
        }
        total_score += dim_score
    
    return total_score, dimension_scores


def get_risk_level(score, scale_type):
    """获取风险等级"""
    config = SCALES[scale_type]
    for level_config in config['risk_levels']:
        min_score, max_score = level_config['range']
        if min_score <= score <= max_score:
            return level_config['level']
    return '未知'


def save_token_usage(record_type, record_id, child_id, model_name, prompt_tokens, completion_tokens, total_tokens):
    """保存token使用记录"""
    try:
        token_record = AITokenUsage(
            record_type=record_type,
            record_id=record_id,
            child_id=child_id,
            model_name=model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens
        )
        db.session.add(token_record)
        db.session.commit()
    except Exception as e:
        print(f"⚠️ Token记录保存失败: {e}")


def call_bailian_ai(prompt, extra_knowledge='', analysis_type='survey'):
    """调用阿里云百炼AI（集成RAG），返回内容和token信息"""
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
            "max_tokens": 1000
        }
        
        print(f"🤖 问卷AI调用: {Config.BAILIAN_MODEL}")
        response = requests.post(url, json=payload, headers=headers)
        result = response.json()
        
        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            print(f"✅ 问卷AI完成 | tokens: {usage.get('total_tokens', 'N/A')}")
            return content, usage
        else:
            print(f"❌ AI调用失败: {result}")
            return None, {}
            
    except Exception as e:
        print(f"❌ AI调用异常: {e}")
        return None, {}


def generate_ai_prompt(child_name, age_months, scale_type, total_score, max_score, 
                       risk_level, dimension_scores, answers_summary):
    """生成AI分析提示词"""
    config = SCALES[scale_type]
    
    dimensions_text = ""
    for dim_key, dim_data in dimension_scores.items():
        dimensions_text += f"- {dim_data['name']}: {dim_data['score']}/{dim_data['max']}分\n"
    
    prompt = f"""请根据以下筛查结果，为家长生成一份温暖、专业的反馈报告。

【孩子信息】
昵称：{child_name}
月龄：{age_months}个月

【筛查工具】
{config['name']}（适用于{config['description']}）

【筛查结果】
总分：{total_score}分 / {max_score}分
风险等级：{risk_level}

【各维度得分】
{dimensions_text}

【重要说明】
此筛查仅为参考工具，不能替代专业医疗诊断。

请按以下结构输出分析报告：

## 🌟 整体评估
[直接说明得分和风险等级，解释这个分数代表什么，强调这只是筛查参考]

## 📊 能力维度分析
### ✅ 优势领域
[根据得分较高的维度，指出孩子的闪光点]

### 🌱 需要关注的领域
[根据得分较低的维度，指出需要加强的方面]

## 💡 家庭陪伴建议
### 本周可以尝试的3个小游戏
1. [针对薄弱维度的具体游戏建议1]
2. [针对薄弱维度的具体游戏建议2]
3. [针对薄弱维度的具体游戏建议3]

### 日常互动小贴士
- [实用的日常互动建议1]
- [实用的日常互动建议2]

## 🏥 专业支持建议
[根据风险等级给出专业就医/评估建议，包含免责声明]

请确保语言温暖、专业，用家长能看懂的话，避免引起过度焦虑，同时给予明确的行动指引。"""

    return prompt


# ========== API 路由 ==========

@ai_bp.route('/survey-analysis', methods=['POST'])
def survey_analysis():
    """AI问卷分析"""
    data = request.json
    child_id = data.get('child_id')
    scale_type = data.get('scale_type')
    answers = data.get('answers', [])
    
    if not child_id or not scale_type or scale_type not in SCALES:
        return jsonify({'success': False, 'message': '参数错误'}), 400
    
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404
    
    config = SCALES[scale_type]
    total_score, dimension_scores = calculate_score(answers, scale_type)
    risk_level = get_risk_level(total_score, scale_type)
    age_months = calculate_month_age(child.birth_date)
    
    answers_summary = f"共{len(answers)}题，异常回答{total_score}题，总分{total_score}，风险等级{risk_level}"

    # RAG 检索专业知识
    retrieval_query = build_query_for_retrieval(
        'survey', age_months,
        f"{config['name']} {risk_level} {answers_summary}"
    )
    extra_knowledge = retrieve(retrieval_query)

    # 生成AI提示词
    prompt = generate_ai_prompt(
        child.name, age_months, scale_type,
        total_score, config['max_score'],
        risk_level, dimension_scores, answers_summary
    )

    # 调用AI（集成RAG知识）
    ai_analysis, usage = call_bailian_ai(prompt, extra_knowledge, 'survey')
    
    # 保存结果到数据库
    survey_result = SurveyResult(
        child_id=child_id,
        scale_type=scale_type,
        answers=answers,
        total_score=total_score,
        max_score=config['max_score'],
        level=risk_level,
        ai_analysis=ai_analysis,
        dimension_scores=dimension_scores
    )
    db.session.add(survey_result)
    db.session.commit()
    
    # 记录token使用
    save_token_usage(
        record_type='survey_analysis',
        record_id=survey_result.id,
        child_id=child_id,
        model_name=Config.BAILIAN_MODEL,
        prompt_tokens=usage.get('prompt_tokens', 0),
        completion_tokens=usage.get('completion_tokens', 0),
        total_tokens=usage.get('total_tokens', 0)
    )

    # 通知用户：AI 分析报告已生成
    if child:
        user = User.query.get(child.user_id)
        if user:
            create_notification(user.id, 'system_report',
                f'{child.name}的筛查报告已生成',
                f'风险等级：{risk_level}，点击查看详细分析',
                related_id=survey_result.id)
    
    return jsonify({
        'success': True,
        'data': {
            'id': survey_result.id,
            'scale_type': scale_type,
            'scale_name': config['name'],
            'total_score': total_score,
            'max_score': config['max_score'],
            'risk_level': risk_level,
            'dimension_scores': dimension_scores,
            'ai_analysis': ai_analysis,
            'child_name': child.name,
            'age_months': age_months,
            'tokens': usage.get('total_tokens', 0)
        }
    }), 200


@ai_bp.route('/scale-info/<scale_type>', methods=['GET'])
def get_scale_info(scale_type):
    """获取量表信息"""
    if scale_type not in SCALES:
        return jsonify({'success': False, 'message': '无效的量表类型'}), 400
    
    config = SCALES[scale_type]
    
    return jsonify({
        'success': True,
        'data': {
            'type': scale_type,
            'name': config['name'],
            'description': config['description'],
            'total_questions': config['total_questions'],
            'max_score': config['max_score'],
            'reverse_items': config['reverse_items'],
            'risk_levels': config['risk_levels']
        }
    }), 200


@ai_bp.route('/survey-history/<int:child_id>', methods=['GET'])
def get_survey_history(child_id):
    """获取孩子的问卷历史记录"""
    scale_type = request.args.get('scale_type')
    
    query = SurveyResult.query.filter_by(child_id=child_id)
    if scale_type:
        query = query.filter_by(scale_type=scale_type)
    
    results = query.order_by(SurveyResult.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'data': [{
            'id': r.id,
            'scale_type': r.scale_type,
            'scale_name': SCALES.get(r.scale_type, {}).get('name', r.scale_type),
            'total_score': r.total_score,
            'max_score': r.max_score,
            'level': r.level,
            'ai_analysis': r.ai_analysis,
            'dimension_scores': r.dimension_scores,
            'created_at': r.created_at.isoformat()
        } for r in results]
    }), 200


@ai_bp.route('/recommend-scale/<int:child_id>', methods=['GET'])
def recommend_scale(child_id):
    """根据孩子月龄推荐量表"""
    child = Child.query.get(child_id)
    if not child:
        return jsonify({'success': False, 'message': '孩子不存在'}), 404
    
    age_months = calculate_month_age(child.birth_date)
    
    if age_months < 16:
        recommended = 'mchat'
        reason = f'宝宝{age_months}个月，建议满16个月后再进行筛查。M-CHAT-R适合16-30个月'
    elif 16 <= age_months <= 30:
        recommended = 'mchat'
        reason = f'宝宝{age_months}个月（约{age_months//12}岁{age_months%12}个月），M-CHAT-R是最适合这个年龄段的筛查工具'
    elif 31 <= age_months <= 47:
        # ✅ 新增：2.5-4岁过渡期
        recommended = 'mchat'
        reason = f'宝宝{age_months}个月（约{age_months//12}岁{age_months%12}个月），处于过渡期。建议先用M-CHAT-R筛查，满4岁后可使用CAST进行更全面评估'
    elif 48 <= age_months <= 132:
        recommended = 'cast'
        reason = f'宝宝{age_months}个月（约{age_months//12}岁），CAST更适合4岁以上儿童'
    else:
        recommended = 'cast'
        reason = f'宝宝已超过11岁，建议咨询专业医生获取更适合的评估工具'
    
    return jsonify({
        'success': True,
        'data': {
            'age_months': age_months,
            'recommended': recommended,
            'reason': reason,
            'scales': [
                {
                    'type': 'mchat',
                    'name': SCALES['mchat']['name'],
                    'description': SCALES['mchat']['description'],
                    'suitable': age_months <= 47  # ✅ 改：2.5-4岁也可以使用
                },
                {
                    'type': 'cast',
                    'name': SCALES['cast']['name'],
                    'description': SCALES['cast']['description'],
                    'suitable': age_months >= 48
                }
            ]
        }
    }), 200

# ========== 新增：查看token使用统计 ==========
@ai_bp.route('/token-usage/<int:child_id>', methods=['GET'])
def get_token_usage(child_id):
    """获取某个孩子的AI token使用统计"""
    records = AITokenUsage.query.filter_by(child_id=child_id)\
        .order_by(AITokenUsage.created_at.desc()).all()
    
    total_tokens = sum(r.total_tokens for r in records)
    
    return jsonify({
        'success': True,
        'data': {
            'total_tokens': total_tokens,
            'records': [{
                'id': r.id,
                'record_type': r.record_type,
                'model_name': r.model_name,
                'prompt_tokens': r.prompt_tokens,
                'completion_tokens': r.completion_tokens,
                'total_tokens': r.total_tokens,
                'created_at': r.created_at.isoformat()
            } for r in records]
        }
    }), 200