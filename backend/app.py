from flask import Flask
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from models import db
import os
from config import Config

bcrypt = Bcrypt()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    bcrypt.init_app(app)
    CORS(app, origins=app.config['CORS_ORIGINS'])

    # 注册蓝图
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

    with app.app_context():
        db.create_all()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
