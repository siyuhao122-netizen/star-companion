from flask import Blueprint, request, jsonify
from models import db, SurveyResult
from datetime import date

survey_bp = Blueprint('survey', __name__)


# ========== M-CHAT-R 题目（20题） ==========
MCHAT_QUESTIONS = [
    {"id": 1, "text": "如果您指着房间另一头的玩具，您的孩子会看那个玩具吗？", "reverse": False},
    {"id": 2, "text": "您是否曾经怀疑过您的孩子可能有听力问题？", "reverse": True},
    {"id": 3, "text": "您的孩子喜欢玩假装游戏吗？（例如：假装喂娃娃、假装打电话）", "reverse": False},
    {"id": 4, "text": "您的孩子喜欢爬上爬下吗？（例如：爬家具、爬楼梯）", "reverse": False},
    {"id": 5, "text": "您的孩子会在脸附近做一些不同寻常的手指动作吗？", "reverse": True},
    {"id": 6, "text": "您的孩子曾用食指指着东西，要求要某样东西吗？", "reverse": False},
    {"id": 7, "text": "您的孩子曾用食指指着东西，表示对某样东西有兴趣吗？", "reverse": True},
    {"id": 8, "text": "您的孩子对其他孩子有兴趣吗？", "reverse": False},
    {"id": 9, "text": "您的孩子曾经拿东西给您（父母）看吗？", "reverse": True},
    {"id": 10, "text": "当您叫孩子的名字时，他/她会有反应吗？", "reverse": False},
    {"id": 11, "text": "当您对孩子笑时，他/她会以微笑回应吗？", "reverse": False},
    {"id": 12, "text": "您的孩子看起来对噪音特别敏感吗？（例如：捂住耳朵）", "reverse": True},
    {"id": 13, "text": "您的孩子会走路吗？", "reverse": False},
    {"id": 14, "text": "您的孩子看着您的眼睛超过一两秒吗？", "reverse": True},
    {"id": 15, "text": "您的孩子会模仿您吗？（例如：您做鬼脸，孩子也会模仿）", "reverse": True},
    {"id": 16, "text": "如果您转头看某样东西，您的孩子会跟着看吗？", "reverse": False},
    {"id": 17, "text": "您的孩子会设法吸引您看他/她自己的活动吗？", "reverse": True},
    {"id": 18, "text": "您的孩子理解别人说的话吗？", "reverse": True},
    {"id": 19, "text": "碰到不熟悉的事物时会看着您的脸，看看您的反应吗？", "reverse": True},
    {"id": 20, "text": "您的孩子喜欢藏猫猫或捉迷藏的游戏吗？", "reverse": True}
]

# ========== CAST 题目（37题） ==========
CAST_QUESTIONS = [
    # 社交沟通维度 (1-12题)
    {"id": 1, "text": "他/她会主动和其他孩子一起玩吗？", "dimension": "social_communication", "reverse": True},
    {"id": 2, "text": "他/她说话时会看着您的眼睛吗？", "dimension": "social_communication", "reverse": False},
    {"id": 3, "text": "他/她喜欢和别人分享食物或玩具吗？", "dimension": "social_communication", "reverse": False},
    {"id": 4, "text": "他/她能理解别人的面部表情吗？（如生气、开心）", "dimension": "social_communication", "reverse": False},
    {"id": 5, "text": "他/她说话时语调自然吗？", "dimension": "social_communication", "reverse": True},
    {"id": 6, "text": '''他/她会用点头表示"是"，摇头表示"否"吗？''', "dimension": "social_communication", "reverse": False},
    {"id": 7, "text": "他/她能进行简单的来回对话吗？", "dimension": "social_communication", "reverse": False},
    {"id": 8, "text": "他/她会主动向您展示他/她感兴趣的东西吗？", "dimension": "social_communication", "reverse": True},
    {"id": 9, "text": "他/她能理解简单的笑话或幽默吗？", "dimension": "social_communication", "reverse": False},
    {"id": 10, "text": '''他/她会用"我"、"你"这样的人称代词吗？''', "dimension": "social_communication", "reverse": False},
    {"id": 11, "text": '''他/她理解"假装"的概念吗？（如假装喝茶）''', "dimension": "social_communication", "reverse": False},
    {"id": 12, "text": "他/她的面部表情丰富吗？", "dimension": "social_communication", "reverse": True},
    
    # 刻板行为与兴趣维度 (13-24题)
    {"id": 13, "text": "他/她是否有特殊的、非常强烈的兴趣？", "dimension": "restricted_behavior", "reverse": False},
    {"id": 14, "text": "他/她是否坚持某些日常惯例，改变时会很不安？", "dimension": "restricted_behavior", "reverse": False},
    {"id": 15, "text": "他/她的兴趣是否和同龄孩子差不多？", "dimension": "restricted_behavior", "reverse": True},
    {"id": 16, "text": "他/她是否反复做同一件事？（如反复开关门）", "dimension": "restricted_behavior", "reverse": False},
    {"id": 17, "text": "他/她是否对手或物体的触感特别敏感？", "dimension": "restricted_behavior", "reverse": False},
    {"id": 18, "text": "他/她是否有摇晃身体、转圈等重复动作？", "dimension": "restricted_behavior", "reverse": False},
    {"id": 19, "text": "他/她对声音的反应是否和其他孩子差不多？", "dimension": "restricted_behavior", "reverse": True},
    {"id": 20, "text": "他/她是否收集或排列特定物品？（如把玩具排成一行）", "dimension": "restricted_behavior", "reverse": False},
    {"id": 21, "text": "他/她是否对玩具的某个部分特别感兴趣？（如车轮）", "dimension": "restricted_behavior", "reverse": False},
    {"id": 22, "text": "他/她是否有奇怪的走路方式？（如踮脚走路）", "dimension": "restricted_behavior", "reverse": False},
    {"id": 23, "text": "他/她玩玩具的方式和其他孩子差不多吗？", "dimension": "restricted_behavior", "reverse": True},
    {"id": 24, "text": "他/她是否对气味或味道特别敏感？", "dimension": "restricted_behavior", "reverse": False},
    
    # 同伴关系维度 (25-37题)
    {"id": 25, "text": "他/她喜欢参加生日派对等社交活动吗？", "dimension": "peer_relationship", "reverse": False},
    {"id": 26, "text": "他/她有没有至少一个固定的好朋友？", "dimension": "peer_relationship", "reverse": True},
    {"id": 27, "text": '''他/她理解"轮流"的概念吗？''', "dimension": "peer_relationship", "reverse": False},
    {"id": 28, "text": "他/她是否对他人的情绪有反应？（如别人哭时也会难过）", "dimension": "peer_relationship", "reverse": False},
    {"id": 29, "text": "他/她会主动安慰受伤或难过的朋友吗？", "dimension": "peer_relationship", "reverse": False},
    {"id": 30, "text": "他/她和其他孩子相处时，行为是否得体？", "dimension": "peer_relationship", "reverse": True},
    {"id": 31, "text": "他/她是否理解基本的社交规则？（如不打断别人说话）", "dimension": "peer_relationship", "reverse": True},
    {"id": 32, "text": "他/她能和其他孩子合作完成任务吗？", "dimension": "peer_relationship", "reverse": True},
    {"id": 33, "text": "他/她在集体活动中能遵守规则吗？", "dimension": "peer_relationship", "reverse": True},
    {"id": 34, "text": '''他/她是否理解"赢"和"输"的概念？''', "dimension": "peer_relationship", "reverse": True},
    {"id": 35, "text": "他/她会主动邀请其他孩子一起玩吗？", "dimension": "peer_relationship", "reverse": True},
    {"id": 36, "text": "他/她能理解其他孩子的意图吗？", "dimension": "peer_relationship", "reverse": True},
    {"id": 37, "text": "他/她在学校或幼儿园适应得好吗？", "dimension": "peer_relationship", "reverse": True}
]


@survey_bp.route('/questions/<scale_type>', methods=['GET'])
def get_questions(scale_type):
    """获取问卷题目"""
    if scale_type == 'mchat':
        return jsonify({
            'success': True,
            'data': {
                'scale_type': 'mchat',
                'scale_name': 'M-CHAT-R (婴幼儿孤独症筛查量表)',
                'description': '适用于16-30个月的婴幼儿',
                'total': 20,
                'questions': MCHAT_QUESTIONS
            }
        })
    elif scale_type == 'cast':
        return jsonify({
            'success': True,
            'data': {
                'scale_type': 'cast',
                'scale_name': 'CAST (儿童孤独症谱系测试)',
                'description': '适用于4-11岁的儿童',
                'total': 37,
                'questions': CAST_QUESTIONS
            }
        })
    else:
        return jsonify({'success': False, 'message': '无效的量表类型'}), 400


@survey_bp.route('/submit', methods=['POST'])
def submit_survey():
    """提交问卷（兼容旧版，建议使用新的AI接口）"""
    data = request.json
    result = SurveyResult(
        child_id=data['child_id'],
        scale_type=data.get('scale_type', 'mchat'),
        answers=data['answers'],
        total_score=data['total_score'],
        max_score=data.get('max_score', 20),
        level=data['level'],
        summary=data.get('summary'),
        suggestions=data.get('suggestions')
    )
    db.session.add(result)
    db.session.commit()
    return jsonify({'id': result.id}), 201


@survey_bp.route('/latest/<int:child_id>', methods=['GET'])
def get_latest_survey(child_id):
    """获取最新的问卷结果"""
    scale_type = request.args.get('scale_type')
    query = SurveyResult.query.filter_by(child_id=child_id)
    if scale_type:
        query = query.filter_by(scale_type=scale_type)
    
    result = query.order_by(SurveyResult.created_at.desc()).first()
    if not result:
        return jsonify({}), 200
    
    return jsonify({
        'id': result.id,
        'scale_type': result.scale_type,
        'answers': result.answers,
        'total_score': result.total_score,
        'max_score': result.max_score,
        'level': result.level,
        'summary': result.summary,
        'suggestions': result.suggestions,
        'ai_analysis': result.ai_analysis,
        'dimension_scores': result.dimension_scores,
        'created_at': result.created_at.isoformat()
    })