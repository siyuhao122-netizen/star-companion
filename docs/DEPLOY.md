# 星伴 · 安装部署指南

## 环境要求

| 组件 | 最低版本 | 说明 |
|------|---------|------|
| Python | 3.9+ | 推荐 3.12 |
| MySQL | 8.0+ | 数据库 |
| Git | 任意版本 | 用于下载代码 |
| 静态文件服务器 | — | 如 http-server、Live Server 等 |

---

## 详细安装步骤

### 一、安装 Python

1. 访问 `https://www.python.org/downloads/`
2. 下载 Python 3.12.x 安装包
3. 运行安装程序，**务必勾选 `Add Python to PATH`**
4. 验证：打开命令行输入 `python --version`，显示版本号即成功

### 二、安装并配置 MySQL

#### macOS
```bash
brew install mysql
brew services start mysql
```

#### Windows
1. 访问 `https://dev.mysql.com/downloads/installer/`
2. 下载 mysql-installer-community，选择 Custom 安装
3. 勾选 MySQL Server 8.0 + MySQL Workbench
4. 安装过程中设置 root 密码并记住
5. 安装完成后服务自动启动

#### 创建数据库

使用 MySQL Workbench 或命令行：

```sql
CREATE DATABASE star_companion DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

验证数据库连接：
```bash
mysql -u root -p -e "SHOW DATABASES;" | grep star_companion
```

### 三、下载项目

```bash
git clone https://github.com/siyuhao122-netizen/star-companion.git
cd star-companion
```

### 四、安装 Python 依赖

```bash
pip install -r backend/requirements.txt
```

依赖列表说明：

| 包名 | 用途 |
|------|------|
| Flask 3.0 | Web 框架 |
| Flask-SQLAlchemy 3.1 | ORM 数据库操作 |
| Flask-CORS 4.0 | 跨域支持 |
| Flask-Bcrypt 1.0 | 密码加密 |
| pymysql | MySQL 数据库驱动 |
| python-dotenv 1.0 | 环境变量加载 |
| requests | HTTP 请求（调用 AI API） |
| SpeechRecognition 3.10 | 语音识别库 |
| pydub 0.25 | 音频格式转换 |
| jieba 0.42 | 中文分词（RAG 知识库） |
| scikit-learn 1.3+ | TF-IDF 文本检索（RAG 知识库） |

### 五、配置环境变量

将 `.env.example` 复制为 `.env`，按下面说明逐项填写：

```bash
cp .env.example .env
```

#### 必填配置项

**1. SECRET_KEY**
```
SECRET_KEY=随机字符串，如 a1b2c3d4e5f6g7h8
```

**2. DATABASE_URL**
```
DATABASE_URL=mysql+pymysql://root:你的密码@localhost:3306/star_companion
```

**3. 邮件服务（QQ 邮箱）**
```
MAIL_USERNAME=你的QQ号@qq.com
MAIL_PASSWORD=QQ邮箱SMTP授权码
```
获取 SMTP 授权码：QQ 邮箱 → 设置 → 账户 → POP3/SMTP 服务 → 开启 → 获取授权码

**4. 阿里云百炼 AI（必填，否则 AI 分析无法使用）**
```
BAILIAN_API_KEY=sk-xxxxxxxxxxxxxxxx
BAILIAN_MODEL=qwen-turbo
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```
获取步骤：
- 访问 `https://bailian.console.aliyun.com/`
- 开通百炼服务（新用户有免费额度）
- 模型广场 → 开通 qwen-turbo 模型
- 右上角头像 → API-KEY 管理 → 创建 API Key

**5. 指物练习 AI（选填，不填则使用 BAILIAN_API_KEY）**
```
POINT_GAME_AI_API_KEY=sk-xxxxxxxxxxxxxxxx
POINT_GAME_AI_MODEL=qwen3-8b
POINT_GAME_AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

**6. 阿里云语音识别（选填，不填则使用音量检测替代）**
```
ALIYUN_ACCESS_KEY_ID=xxxxxxxx
ALIYUN_ACCESS_KEY_SECRET=xxxxxxxx
ALIYUN_APP_KEY=xxxxxxxx
ALIYUN_REGION=cn-shanghai
```
获取步骤：
- 访问 `https://nls-portal.console.aliyun.com/`
- 开通智能语音交互服务
- 创建项目 → 获取 AccessKey 和 AppKey

### 六、启动服务

#### 启动后端

```bash
# 在项目根目录下运行
python backend/app.py
```

成功启动后会显示：
```
 * Running on http://127.0.0.1:5000
```

后端首次运行会自动创建数据库表。

#### 启动前端

使用任意静态文件服务器，在项目根目录：

```bash
# 方式一：Node.js http-server
npm install -g http-server
http-server -p 5501 --cors

# 方式二：Python
python -m http.server 5501

# 打开浏览器访问 http://localhost:5501
```

### 七、验证部署

1. 打开 `http://localhost:5501`
2. 点击「注册」→ 输入邮箱 → 获取验证码 → 完成注册
3. 登录后添加宝贝档案
4. 进行一次筛查或训练游戏
5. 进入数据看板，确认 AI 分析能正常生成

如果以上所有步骤都能走通，部署成功。

---

## 生产环境建议

### 使用 Gunicorn 运行后端

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 backend.app:create_app()
```

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
    }

    location / {
        root /path/to/star-project;
        index index.html;
    }
}
```

### 使用 MySQL 远程服务器

修改 `.env` 中的 `DATABASE_URL` 为远程地址：
```
DATABASE_URL=mysql+pymysql://user:password@your-server-ip:3306/star_companion
```

确保远程 MySQL 允许外部连接，并已创建 `star_companion` 数据库。

---

## 故障排查

| 问题 | 可能原因 | 解决方法 |
|------|---------|---------|
| ModuleNotFoundError | 依赖未安装 | `pip install -r backend/requirements.txt` |
| 数据库连接失败 | MySQL 未启动或密码错误 | 检查 Windows 服务中的 MySQL80 是否运行 |
| AI 分析返回空 | API Key 错误或余额不足 | 登录百炼控制台检查 Key 和余额 |
| 邮件发不出去 | SMTP 授权码错误 | QQ 邮箱中重新获取授权码 |
| 前端跨域报错 | CORS 未正确配置 | 确保后端在 5000 端口，前端在 5501 端口 |
| 端口被占用 | 其他程序占用了 5000/5501 端口 | `netstat -ano | findstr 5000` 查看并关闭占用进程 |
