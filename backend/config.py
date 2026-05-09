import os
import secrets
import warnings
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

load_dotenv(os.path.join(BASE_DIR, '..', '.env'))


class Config:
    _secret = os.environ.get('SECRET_KEY')
    if not _secret:
        _secret = secrets.token_hex(32)
        warnings.warn('SECRET_KEY not set in environment. Using random key '
                       '(sessions invalidated on restart).', RuntimeWarning)
    SECRET_KEY = _secret

    # SQLite 数据库
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        f"sqlite:///{os.path.join(BASE_DIR, 'star_companion.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    CORS_ORIGINS = ['http://localhost:5500', 'http://127.0.0.1:5500',
                    'http://localhost:5501', 'http://127.0.0.1:5501']

    # QQ邮箱 SMTP
    MAIL_SERVER = "smtp.qq.com"
    MAIL_PORT = 465
    MAIL_USE_SSL = True
    MAIL_USE_TLS = False
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', '')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_USERNAME', '')

    # 阿里云百炼 AI (问卷/树洞/叫名反应/声音小话筒)
    BAILIAN_API_KEY = os.environ.get('BAILIAN_API_KEY', '')
    BAILIAN_MODEL = os.environ.get('BAILIAN_MODEL', 'qwen-turbo')
    BAILIAN_BASE_URL = os.environ.get('BAILIAN_BASE_URL',
                                       'https://dashscope.aliyuncs.com/compatible-mode/v1')

    # 阿里云百炼 AI (指物练习专用微调模型)
    POINT_GAME_AI_MODEL = os.environ.get('POINT_GAME_AI_MODEL', 'qwen3-8b')
    POINT_GAME_AI_BASE_URL = os.environ.get('POINT_GAME_AI_BASE_URL',
                                             'https://dashscope.aliyuncs.com/compatible-mode/v1')
    POINT_GAME_AI_API_KEY = os.environ.get('POINT_GAME_AI_API_KEY', '')

    # 阿里云语音识别
    ALIYUN_ACCESS_KEY_ID = os.environ.get('ALIYUN_ACCESS_KEY_ID', '')
    ALIYUN_ACCESS_KEY_SECRET = os.environ.get('ALIYUN_ACCESS_KEY_SECRET', '')
    ALIYUN_APP_KEY = os.environ.get('ALIYUN_APP_KEY', '')
    ALIYUN_REGION = os.environ.get('ALIYUN_REGION', 'cn-shanghai')
