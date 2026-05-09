# 星伴 (Star Companion)

面向 2-6 岁儿童的孤独症谱系障碍（ASD）筛查与早期干预辅助平台。通过标准化量表筛查、三项治疗性训练游戏、AI 智能分析，为家长提供「筛查 → 干预 → 数据 → 反馈」的完整闭环。

## 功能概览

| 模块 | 说明 |
|------|------|
| 筛查评估 | M-CHAT-R（16-30 月龄）/ CAST（4-11 岁），AI 分析 + 风险分级 |
| 叫名反应 | 面部表情 + 语音检测，训练社会定向能力 |
| 指物练习 | 共同注意训练，区分陈述性/请求性指物 |
| 声音小话筒 | 阿里云 ASR 语音识别，训练发声模仿 |
| 数据看板 | Chart.js 趋势图 + AI 报告 + PDF 导出 |
| 家长树洞 | 匿名倾诉 + AI 自动回复（RAG 专业知识增强） |
| 个人中心 | 通知系统、帮助与反馈、账号管理 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.9+ / Flask 3.0 / SQLAlchemy / MySQL |
| 前端 | Vanilla HTML + CSS + JavaScript（无框架） |
| AI | 阿里云百炼 qwen-turbo / qwen3-8b + RAG 知识库 |
| 语音 | 阿里云 ASR 实时语音识别 |
| 图表 | Chart.js 4.4 |
| PDF | jsPDF 2.5 |

---

## 安装步骤（从零开始）

以下步骤假设你有一台 **Windows 10/11** 电脑，没有任何环境。严格按照顺序操作即可。

### 第一步：安装 Python

1. 打开浏览器，访问 `https://www.python.org/downloads/`
2. 点击黄色按钮 **Download Python 3.12.x**（或更高版本）
3. 下载完成后双击运行安装程序
4. **重要：勾选底部的 `Add Python to PATH`**，然后点击 **Install Now**
5. 等待安装完成，点击 **Close**
6. 验证安装：按 `Win + R`，输入 `cmd` 回车，在命令行中输入：
   ```
   python --version
   ```
   应该显示 `Python 3.12.x`

### 第二步：安装 MySQL

1. 访问 `https://dev.mysql.com/downloads/installer/`
2. 下载 **mysql-installer-community-8.0.x.msi**（约 420MB）
3. 双击运行，选择 **Custom** 安装类型
4. 在安装列表中选择：
   - **MySQL Server 8.0**
   - **MySQL Workbench**（可视化管理工具，建议勾选）
5. 点击 Next 直到安装完成
6. 在配置步骤中设置 **root 密码**（请记住这个密码，后续需要用到），其他保持默认
7. 安装完成后，打开 **MySQL Workbench**（或命令行），创建一个新数据库：
   ```sql
   CREATE DATABASE star_companion DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
8. 记下以下信息，后续配置需要：
   - 主机地址：`localhost`（本机）
   - 端口：`3306`
   - 用户名：`root`
   - 密码：你设置的 root 密码
   - 数据库名：`star_companion`

### 第三步：下载项目代码

```bash
git clone https://github.com/siyuhao122-netizen/star-companion.git
cd star-companion
```

如果无法访问 GitHub，可以手动下载 ZIP 包解压。

### 第四步：安装 Python 依赖

打开命令行（cmd），进入项目目录：

```bash
cd star-companion
pip install -r backend/requirements.txt
```

安装的包包括：Flask、Flask-SQLAlchemy、Flask-CORS、Flask-Bcrypt、pymysql、python-dotenv、requests、SpeechRecognition、pydub、jieba、scikit-learn 等。

### 第五步：配置环境变量

1. 在项目根目录找到 `.env.example` 文件
2. 将其复制一份，重命名为 `.env`
3. 用记事本打开 `.env`，逐项填写：

```ini
# Flask
SECRET_KEY=随便输入一串随机字符，例如 a1b2c3d4e5f6
DATABASE_URL=mysql+pymysql://root:你的MySQL密码@localhost:3306/star_companion

# QQ邮箱 SMTP（用于发送验证码和反馈邮件）
MAIL_USERNAME=你的QQ邮箱@qq.com
MAIL_PASSWORD=QQ邮箱SMTP授权码（不是QQ密码，需要在QQ邮箱设置中开启SMTP服务获取）

# 阿里云百炼 AI（问卷/树洞/叫名反应/声音小话筒）
BAILIAN_API_KEY=sk-你的百炼API密钥
BAILIAN_MODEL=qwen-turbo
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 阿里云百炼 AI（指物练习微调模型）
POINT_GAME_AI_API_KEY=sk-你的指物模型API密钥
POINT_GAME_AI_MODEL=你的微调模型名称
POINT_GAME_AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 阿里云语音识别
ALIYUN_ACCESS_KEY_ID=你的阿里云AccessKey ID
ALIYUN_ACCESS_KEY_SECRET=你的阿里云AccessKey Secret
ALIYUN_APP_KEY=你的阿里云语音识别AppKey
ALIYUN_REGION=cn-shanghai
```

#### 如何获取各项密钥：

**QQ 邮箱 SMTP 授权码：**
1. 登录 QQ 邮箱 → 设置 → 账户 → POP3/SMTP 服务
2. 开启 SMTP 服务，按提示发送短信验证
3. 获得 16 位授权码，填入 `MAIL_PASSWORD`

**阿里云百炼 API Key：**
1. 访问 `https://bailian.console.aliyun.com/`
2. 开通百炼服务 → 模型广场 → 开通 qwen-turbo 等模型
3. 右上角头像 → API-KEY 管理 → 创建新的 API Key
4. 复制 Key 填入 `BAILIAN_API_KEY`

**阿里云语音识别（ASR）：**
1. 访问 `https://nls-portal.console.aliyun.com/`
2. 开通智能语音交互服务
3. 创建项目 → 语音识别 → 创建 AccessKey
4. 获取 AccessKey ID / Secret / AppKey 填入配置

### 第六步：启动后端

在项目根目录下运行：

```bash
python backend/app.py
```

看到以下输出表示启动成功：
```
 * Running on http://127.0.0.1:5000
 * Running on http://localhost:5000
```

后端启动后会自动创建数据库表（首次运行），无需手动建表。

### 第七步：启动前端

1. 安装任意静态文件服务器。推荐使用 Node.js 的 `http-server`：
   ```bash
   npm install -g http-server
   ```
2. 在项目根目录下运行：
   ```bash
   http-server -p 5501 --cors
   ```
3. 打开浏览器，访问 `http://localhost:5501`
4. 或直接双击 `index.html` 文件打开（部分功能可能因跨域限制而无法使用）

### 第八步：验证安装

1. 打开浏览器访问 `http://localhost:5501`
2. 点击「注册」，输入邮箱获取验证码
3. 注册成功后登录，添加宝贝档案
4. 进行一次问卷筛查或训练游戏
5. 查看数据看板，确认 AI 分析能正常生成

---

## 项目结构

```
star-project/
├── backend/
│   ├── app.py              # Flask 应用入口
│   ├── config.py           # 配置管理（读取 .env）
│   ├── models.py           # 10 个数据库模型
│   ├── rag.py              # RAG 知识库检索
│   ├── aliyun_asr.py       # 阿里云语音识别 SDK
│   ├── knowledge/          # ASD 循证知识库（6 份文献）
│   ├── requirements.txt    # Python 依赖
│   └── routes/             # 10 个路由蓝图
├── pages/                  # HTML 页面（12 个）
├── js/                     # JavaScript（12 个）
├── css/                    # CSS 样式（12 个）
├── database/
│   └── star_companion.sql  # 数据库 DDL（参考用）
├── .env.example            # 环境变量模板
├── .gitignore
└── README.md
```

## API 路由一览

| 路由前缀 | 用途 |
|---------|------|
| `/api/auth` | 注册、登录、邮箱验证、密码管理、通知、反馈 |
| `/api/child` | 宝贝档案 CRUD |
| `/api/games` | 游戏结果提交、历史查询 |
| `/api/survey` | 问卷题目、结果提交 |
| `/api/ai` | AI 问卷分析、量表推荐 |
| `/api/point-game-ai` | 指物练习 AI 分析 |
| `/api/name-reaction-ai` | 叫名反应 AI 分析 |
| `/api/voice-game-ai` | 声音小话筒 AI 分析 |
| `/api/voice` | 语音识别（ASR） |
| `/api/treehole` | 树洞留言、AI 回复 |

完整 API 文档见 [docs/API.md](docs/API.md)

## 常见问题

**Q: 启动报错 `ModuleNotFoundError: No module named 'xxx'`**
A: 运行 `pip install -r backend/requirements.txt` 确保所有依赖已安装。

**Q: 数据库连接失败**
A: 检查 `.env` 中 `DATABASE_URL` 是否正确，确保 MySQL 服务已启动（Windows 服务中查找 MySQL80）。

**Q: AI 分析返回空**
A: 检查阿里云百炼 API Key 是否正确，确保模型已开通，账户余额充足。

**Q: 邮件验证码收不到**
A: 检查 `.env` 中 `MAIL_PASSWORD` 是 SMTP 授权码而非 QQ 密码。

## License

MIT
