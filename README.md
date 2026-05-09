# 星伴 (Star Companion) — ASD 筛查与早期干预平台

面向 2-6 岁儿童的孤独症谱系障碍（ASD）筛查与早期干预辅助平台。帮助家长通过标准化量表筛查、治疗性小游戏训练和 AI 智能分析，及早发现发育信号并进行家庭干预。

## 功能模块

### 筛查评估
- **M-CHAT-R**（20 题，16-30 月龄）— 婴幼儿孤独症筛查量表
- **CAST**（37 题，4-11 岁）— 儿童孤独症谱系测试
- AI 智能分析 + 维度得分 + 风险分级

### 游戏训练
- **叫名反应** — 社会定向与听觉回应（面部表情识别 + 语音检测）
- **指物练习** — 共同注意与社交性指物（点击交互 + 视觉刺激）
- **声音小话筒** — 发声启蒙与声音模仿（阿里云语音识别 + 音量检测）

### 数据看板
- 三项核心指标 + 趋势对比
- Chart.js 趋势图
- AI 智能报告 + 专业建议
- PDF 报告导出

### 家长树洞
- 匿名倾诉社区
- AI 自动回复（含 RAG 专业知识增强）

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python Flask 3.0 + SQLAlchemy + SQLite |
| 前端 | Vanilla HTML + CSS + JavaScript（无框架） |
| AI 模型 | 阿里云百炼 qwen-turbo / qwen3-8b（微调） |
| 语音识别 | 阿里云 ASR（实时语音转写） |
| RAG 知识库 | 本地 TF-IDF + jieba 分词 + 循证 ASD 专业知识库 |
| 数据可视化 | Chart.js 4.4 |
| PDF 导出 | html2canvas + jsPDF |

## 快速开始

### 环境要求
- Python 3.9+
- Node.js（仅前端开发服务器）

### 1. 安装后端依赖

```bash
pip install -r backend/requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入以下配置：

```bash
cp .env.example .env
```

必填配置：
- `MAIL_USERNAME` / `MAIL_PASSWORD` — QQ 邮箱 SMTP（用于验证码发送）
- `BAILIAN_API_KEY` / `POINT_GAME_AI_API_KEY` — 阿里云百炼 API Key
- `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET` / `ALIYUN_APP_KEY` — 阿里云语音识别

### 3. 启动后端

```bash
python backend/app.py
# Flask 运行在 http://localhost:5000
```

### 4. 启动前端

使用 VS Code Live Server 或任意静态服务器：

```bash
# 使用 Live Server（VS Code 插件）
# 端口: 5501
# 入口: index.html
```

## 项目结构

```
star-project/
├── backend/
│   ├── app.py              # Flask 应用工厂
│   ├── config.py           # 配置管理
│   ├── models.py           # 数据库模型（10 张表）
│   ├── rag.py              # RAG 知识检索模块
│   ├── aliyun_asr.py       # 阿里云语音识别
│   ├── knowledge/           # ASD 专业知识库（6 份循证文献）
│   ├── requirements.txt
│   └── routes/
│       ├── auth.py         # 用户认证
│       ├── child.py        # 孩子档案
│       ├── games.py        # 游戏数据
│       ├── survey.py       # 问卷筛查
│       ├── ai_analysis.py  # AI 问卷分析
│       ├── name_reaction_ai.py  # 叫名反应 AI
│       ├── point_game_ai.py     # 指物练习 AI
│       ├── voice_game_ai.py     # 声音 AI
│       ├── voice_speech.py      # 语音识别
│       └── treehole.py          # 树洞社区
├── pages/                  # HTML 页面（12 个）
├── js/                     # JavaScript（12 个）
├── css/                    # CSS 样式（12 个）
├── database/
│   └── star_companion.sql  # 数据库 DDL
├── .env.example            # 环境变量模板
└── README.md
```

## API 路由概览

| 前缀 | 用途 |
|------|------|
| `/api/auth` | 注册、登录、邮箱验证、密码重置 |
| `/api/child` | 孩子档案 CRUD、活跃孩子切换 |
| `/api/games` | 游戏结果提交、推荐 |
| `/api/survey` | 问卷题目、结果提交 |
| `/api/ai` | AI 问卷分析、量表推荐 |
| `/api/point-game-ai` | 指物练习 AI 分析 |
| `/api/name-reaction-ai` | 叫名反应 AI 分析 |
| `/api/voice-game-ai` | 声音 AI 分析 |
| `/api/voice` | 语音识别 |
| `/api/treehole` | 树洞留言 |

## 数据库

使用 SQLite（文件存储在 `backend/star_companion.db`）。首次运行时自动建表。10 张核心表：

User → Child → (NameReactionRecord | PointGameRecord | VoiceGameRecord | SurveyResult)
同时包含 EmailVerification、TreeholeMessage、DailyRecommendation、AITokenUsage

## License

MIT
