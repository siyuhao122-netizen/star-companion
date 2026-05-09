from flask import Flask
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from models import db
from config import Config
import os

bcrypt = Bcrypt()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # 确保 instance 目录存在
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

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(child_bp, url_prefix='/api/child')
    app.register_blueprint(games_bp, url_prefix='/api/games')
    app.register_blueprint(survey_bp, url_prefix='/api/survey')
    app.register_blueprint(treehole_bp, url_prefix='/api/treehole')

    with app.app_context():
        db.create_all()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)