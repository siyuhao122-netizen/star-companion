from flask import Flask, make_response, request as flask_request, send_from_directory
from flask_bcrypt import Bcrypt
from models import db
from sqlalchemy import event
from sqlalchemy.engine import Engine
import os
from config import Config

bcrypt = Bcrypt()

# 前端静态文件根目录（项目根，包含 index.html、pages/、js/、css/）
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    bcrypt.init_app(app)

    # 先注册 API 蓝图，确保 /api/* 优先于通配路由匹配
    from routes.auth import auth_bp
    from routes.child import child_bp
    from routes.games import games_bp
    from routes.survey import survey_bp
    from routes.treehole import treehole_bp
    from routes.ai_analysis import ai_bp
    from routes.point_game_ai import point_game_ai_bp
    # 新增
    from routes.name_reaction_ai import name_reaction_ai_bp
    from routes.voice_game_ai import voice_game_ai_bp
    from routes.voice_speech import voice_speech_bp
    from routes.emotion_game_ai import emotion_game_ai_bp
    from routes.share import share_bp

    app.register_blueprint(voice_speech_bp, url_prefix='/api/voice')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(child_bp, url_prefix='/api/child')
    app.register_blueprint(games_bp, url_prefix='/api/games')
    app.register_blueprint(survey_bp, url_prefix='/api/survey')
    app.register_blueprint(treehole_bp, url_prefix='/api/treehole')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(point_game_ai_bp, url_prefix='/api/point-game-ai')
    # 新增
    app.register_blueprint(name_reaction_ai_bp, url_prefix='/api/name-reaction-ai')
    app.register_blueprint(voice_game_ai_bp, url_prefix='/api/voice-game-ai')
    app.register_blueprint(emotion_game_ai_bp, url_prefix='/api/emotion-game-ai')
    app.register_blueprint(share_bp, url_prefix='/api/share')

    # ========== SQLite 外键约束启用（仅 SQLite） ==========
    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        """SQLite 默认不启用外键约束，需要手动 PRAGMA"""
        # 仅对 SQLite 执行，避免 MySQL 报语法错误
        import sqlite3
        if isinstance(dbapi_connection, sqlite3.Connection):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    # ========== 前端静态文件（放在 API 蓝图之后，确保 /api/* 优先匹配） ==========
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if not path:
            return send_from_directory(FRONTEND_DIR, 'index.html')
        file_path = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(file_path):
            return send_from_directory(FRONTEND_DIR, path)
        return send_from_directory(FRONTEND_DIR, 'index.html')

    with app.app_context():
        db.create_all()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=7657)
