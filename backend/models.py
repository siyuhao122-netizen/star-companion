from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import JSON, Enum
from datetime import datetime

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    nickname = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    avatar = db.Column(db.String(500))
    relation = db.Column(db.String(20))
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    children = db.relationship('Child', backref='parent', lazy=True, cascade='all, delete-orphan')
    messages = db.relationship('TreeholeMessage', backref='author', lazy=True)


class EmailVerification(db.Model):
    __tablename__ = 'email_verification'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(6), nullable=False)
    type = db.Column(db.Enum('register', 'login', 'reset_password', name='verification_type'), default='register')
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Child(db.Model):
    __tablename__ = 'child'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    gender = db.Column(db.Enum('男', '女', name='gender_enum'), default='男')
    relation = db.Column(db.String(20), default='妈妈')
    birth_date = db.Column(db.Date)
    avatar_type = db.Column(db.Enum('icon', 'custom', name='avatar_type_enum'), default='icon')
    avatar = db.Column(db.Text) 
    focus_tags = db.Column(JSON)
    note = db.Column(db.String(200))
    is_active = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    name_records = db.relationship('NameReactionRecord', backref='child', lazy=True)
    point_records = db.relationship('PointGameRecord', backref='child', lazy=True)
    voice_records = db.relationship('VoiceGameRecord', backref='child', lazy=True)
    survey_results = db.relationship('SurveyResult', backref='child', lazy=True)


class NameReactionRecord(db.Model):
    __tablename__ = 'name_reaction_record'
    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey('child.id'), nullable=False)
    session_date = db.Column(db.Date, nullable=False)
    round_total = db.Column(db.Integer, default=8)
    success_count = db.Column(db.Integer, default=0)
    avg_reaction_time = db.Column(db.Numeric(5, 2))
    round_details = db.Column(JSON)
    ai_analysis = db.Column(db.Text)                     # 新增：AI分析结果
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class PointGameRecord(db.Model):
    __tablename__ = 'point_game_record'
    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey('child.id'), nullable=False)
    session_date = db.Column(db.Date, nullable=False)
    round_total = db.Column(db.Integer, default=8)
    correct_rounds = db.Column(db.Integer, default=0)
    wrong_rounds = db.Column(db.Integer, default=0)
    total_clicks = db.Column(db.Integer, default=0)
    correct_clicks = db.Column(db.Integer, default=0)
    wrong_clicks = db.Column(db.Integer, default=0)
    timeout_count = db.Column(db.Integer, default=0)
    skip_count = db.Column(db.Integer, default=0)
    total_time_sec = db.Column(db.Numeric(8, 2))
    avg_time_sec = db.Column(db.Numeric(5, 2))
    avg_reaction_time = db.Column(db.Numeric(5, 2))
    accuracy = db.Column(db.Numeric(5, 2))
    click_accuracy = db.Column(db.Numeric(5, 2))
    round_details = db.Column(JSON)
    ai_analysis = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class VoiceGameRecord(db.Model):
    __tablename__ = 'voice_game_record'
    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey('child.id'), nullable=False)
    session_date = db.Column(db.Date, nullable=False)
    round_total = db.Column(db.Integer, default=8)
    completed_rounds = db.Column(db.Integer, default=0)
    success_count = db.Column(db.Integer, default=0)
    round_details = db.Column(JSON)
    ai_analysis = db.Column(db.Text)                     # 新增：AI分析结果
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SurveyResult(db.Model):
    __tablename__ = 'survey_result'
    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey('child.id'), nullable=False)
    scale_type = db.Column(db.Enum('mchat', 'cast', name='scale_type_enum'), nullable=False)
    answers = db.Column(JSON)
    total_score = db.Column(db.Integer)
    max_score = db.Column(db.Integer)
    level = db.Column(db.String(20))
    summary = db.Column(db.Text)
    suggestions = db.Column(JSON)
    ai_analysis = db.Column(db.Text)
    dimension_scores = db.Column(JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class TreeholeMessage(db.Model):
    __tablename__ = 'treehole_message'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    anonymous_name = db.Column(db.String(50))
    anonymous_avatar = db.Column(db.String(50))
    content = db.Column(db.Text, nullable=False)
    tag = db.Column(db.String(20), default='日常倾诉')
    ai_reply = db.Column(db.Text)
    likes = db.Column(db.Integer, default=0)
    is_public = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class DailyRecommendation(db.Model):
    __tablename__ = 'daily_recommendation'
    id = db.Column(db.Integer, primary_key=True)
    child_id = db.Column(db.Integer, db.ForeignKey('child.id'), nullable=False)
    recommend_date = db.Column(db.Date, nullable=False)
    priority_game = db.Column(db.Enum('name', 'point', 'mic', name='game_type_enum'))
    tip_text = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AITokenUsage(db.Model):
    __tablename__ = 'ai_token_usage'
    id = db.Column(db.Integer, primary_key=True)
    record_type = db.Column(db.String(50), nullable=False, comment='记录类型：name_single/name_trend/voice_single/voice_trend/point_single/point_trend/survey_analysis')
    record_id = db.Column(db.Integer, comment='关联的记录ID')
    child_id = db.Column(db.Integer, db.ForeignKey('child.id'))
    model_name = db.Column(db.String(100), comment='使用的模型名称')
    prompt_tokens = db.Column(db.Integer, default=0)
    completion_tokens = db.Column(db.Integer, default=0)
    total_tokens = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)