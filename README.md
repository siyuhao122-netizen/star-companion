# 星伴 (Star Companion)

面向 2-6 岁儿童的孤独症谱系障碍（ASD）筛查与早期干预辅助平台。通过标准化量表筛查、四项治疗性训练游戏、AI 智能分析、数据看板、综合报告、家长树洞社区，为家长提供「筛查 → 干预 → 数据 → 反馈」的完整闭环。

---

## 一、功能概览

### 1.1 筛查评估

- **M-CHAT-R**（16-30 月龄，20 题）：国际最广泛使用的幼儿 ASD 筛查工具
- **CAST**（4-11 岁，37 题）：学龄前及学龄期儿童筛查
- 系统根据儿童月龄自动推荐合适量表
- AI 自动生成包含「整体评估 + 维度分析 + 家庭建议 + 就医指引」的报告

### 1.2 治疗性游戏训练（4 项）

| 游戏 | 训练目标 | ASD 核心能力 | 玩法 | 技术 |
|------|---------|-------------|------|------|
| **叫名反应** | 听到名字后转头/微笑/发声 | 社会定向 | 8 轮，摄像头检测面部转向 + 声音 | MediaPipe Face Mesh |
| **指物练习** | 指认物品并点击 | 共同注意 | 8 轮，听指令指认物品卡片 | 视觉+点击反馈 |
| **声音小话筒** | 模仿发音 | 沟通动机 | 8 轮，录音→ASR 识别→匹配 | 阿里云语音识别 |
| **情绪识别** | 情景故事→猜心情 | 共情启蒙 | 8 轮，语音播报情景→4 选 1 情绪 | Web Speech API |

每项游戏训练后可查看 AI 分析报告（单次 + 趋势）。

### 1.3 数据看板

- 4 游戏核心指标卡片（最新正确率 + 趋势箭头）
- Chart.js 趋势折线图
- 游戏详情卡片（历史记录 + 详情弹窗）
- 切换宝贝、最近 N 次筛选、导出 PDF
- 一键跳转完整分析页（dataAnalys.html）

### 1.4 综合评估报告

- 核心指标概览（卡片式布局）
- 雷达图（Chart.js 雷达图，4 游戏能力维度）
- AI 综合评估分析
- PDF 导出（html2canvas 截图 + jsPDF，所见即所得）
- 分享码系统：
  - 生成 6 位分享码（48 小时有效）
  - 复制分享链接 + 分享码
  - 对方打开链接 → 输入分享码 → 查看报告
  - 码不入 URL，页面内验证

### 1.5 家长树洞

- 匿名倾诉社区
- AI 自动回复（基于 RAG 专业知识）
- 标签分类（日常倾诉 / 育儿困惑 / 情绪压力 / 家庭关系）
- 点赞、删除
- 匿名模式切换

### 1.6 个人中心

- 多宝贝管理（添加 / 编辑 / 删除 / 切换）
- 宝贝档案（昵称 / 生日 / 性别 / 头像 / 关注标签）
- 通知系统（训练提醒 / 周报 / 树洞互动）
- 账号与安全（修改密码 / 修改手机号 / 注销账户）
- 帮助与反馈

---

## 二、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Python 3.9 ~ 3.12 + Flask 3.0 | 12 个蓝图，RESTful JSON API |
| ORM | SQLAlchemy | 13 个数据模型 |
| 数据库 | SQLite | 零配置，自动建表，文件存储于 `backend/star_companion.db` |
| 前端 | Vanilla HTML + CSS + JS | 无框架，无打包，13 个页面 |
| AI | 阿里云百炼 qwen-turbo + qwen3-8b | 问卷分析 / 游戏分析 / 树洞回复 / 综合评估 |
| RAG | jieba + TF-IDF | 本地知识检索，6 份 ASD 循证文献 |
| 语音 | 阿里云 ASR | 一句话识别（WebM→WAV→PCM） |
| 图表 | Chart.js 4.4 | 趋势折线图 + 雷达图 |
| PDF | jsPDF 2.5 + html2canvas 1.4 | 综合报告导出 |
| 部署 | Flask 内置服务器 | 后端托管前端静态文件，同源零 CORS |

---

## 三、快速启动

### 3.1 环境要求

- **Python**：3.9 ~ 3.12（3.13+ 不可用，`audioop` 模块已移除导致 `pydub` 不兼容）
- **操作系统**：Windows 10/11、macOS、Linux
- 无需安装 MySQL、Node.js 等任何外部依赖

### 3.2 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/siyuhao122-netizen/star-companion.git
cd star-companion

# 2. 安装 Python 依赖
pip install -r backend/requirements.txt

# 3. 配置环境变量
# 将 .env.example 复制为 .env，填写 API Key 等信息
cp .env.example .env

# 4. 启动
python backend/app.py
```

浏览器打开 `http://127.0.0.1:7653` 即可使用。

首次启动自动创建 SQLite 数据库（`backend/star_companion.db`）。

### 3.3 环境变量说明

| 变量 | 用途 | 必填 |
|------|------|------|
| `SECRET_KEY` | Flask 密钥 | 是 |
| `MAIL_USERNAME` | QQ 邮箱（发送验证码） | 是 |
| `MAIL_PASSWORD` | QQ 邮箱 SMTP 授权码（非 QQ 密码） | 是 |
| `BAILIAN_API_KEY` | 阿里云百炼 API Key（问卷/树洞/游戏 AI） | 是 |
| `BAILIAN_MODEL` | 模型名，默认 `qwen-turbo` | 否 |
| `BAILIAN_BASE_URL` | API 地址 | 否 |
| `POINT_GAME_AI_API_KEY` | 指物练习专用模型 Key | 否 |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AK（语音识别用） | 否 |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 SK | 否 |
| `ALIYUN_APP_KEY` | 语音识别 AppKey | 否 |

---

## 四、项目结构

```
star-companion/
├── backend/
│   ├── app.py              # Flask 工厂 create_app()，端口 7653，托管前端静态文件
│   ├── config.py           # 配置管理（.env + 默认值）
│   ├── models.py           # 13 个 SQLAlchemy 数据模型
│   ├── utils.py            # 公共函数（calculate_month_age / save_token_usage / call_bailian_ai）
│   ├── rag.py              # RAG 知识检索（jieba 分词 + TF-IDF + 余弦相似度）
│   ├── aliyun_asr.py       # 阿里云一句话识别 SDK 封装
│   ├── star_companion.db   # SQLite 数据库文件（自动创建）
│   ├── knowledge/          # 6 份 ASD 循证文献（Markdown）
│   │   ├── 01-dsm5-asd-diagnostic-criteria.md
│   │   ├── 02-mchatr-validation.md
│   │   ├── 03-cast-validation.md
│   │   ├── 04-early-intervention-evidence.md
│   │   ├── 05-game-training-scientific-basis.md
│   │   └── 06-parent-guidance-and-communication.md
│   ├── requirements.txt    # Python 依赖包列表
│   └── routes/             # 12 个蓝图路由模块
│       ├── auth.py              # 注册/登录/验证码/通知/反馈/注销（11 路由）
│       ├── child.py             # 宝贝档案 CRUD + 活跃切换（5 路由）
│       ├── games.py             # 四游戏数据提交 + 叫名 AI 自动触发 + 首页推荐（7 路由）
│       ├── survey.py            # M-CHAT-R(20题) + CAST(37题)（3 路由）
│       ├── ai_analysis.py       # AI 问卷分析 + 量表推荐 + 综合评估 + 缓存（6 路由）
│       ├── point_game_ai.py     # 指物练习单次/趋势 AI（3 路由）
│       ├── name_reaction_ai.py  # 叫名反应单次/趋势 AI（3 路由）
│       ├── voice_game_ai.py     # 声音小话筒单次/趋势 AI（3 路由）
│       ├── emotion_game_ai.py   # 情绪识别单次/趋势 AI（3 路由）
│       ├── voice_speech.py      # 阿里云 ASR 语音识别（1 路由）
│       ├── treehole.py          # 树洞社区 + AI 回复 + 点赞（5 路由）
│       └── share.py             # 分享码生成/验证/撤销（3 路由）
├── pages/                  # 13 个 HTML 页面
│   ├── index.html               # 启动屏
│   ├── sign-inANDsign-up.html   # 登录/注册
│   ├── forgetPassword.html      # 忘记密码
│   ├── mainPart.html            # 首页（游戏入口 + 今日推荐）
│   ├── peopleHome.html          # 个人中心
│   ├── askName.html             # 叫名反应游戏
│   ├── touchGame.html           # 指物练习游戏
│   ├── voice.html               # 声音小话筒游戏
│   ├── emotionGame.html         # 情绪识别游戏
│   ├── dataLook.html            # 数据看板
│   ├── dataAnalys.html          # 完整分析页
│   ├── reportExport.html        # 综合评估报告页
│   ├── survey-select.html       # 问卷选择
│   ├── askQuestions.html        # 问卷答题
│   └── seniorHole.html          # 家长树洞
├── js/                     # 13 个 JavaScript 文件（与 HTML 页面一一对应）
├── css/                    # 13 个 CSS 样式文件
├── database/
│   └── star_companion.sql  # MySQL DDL（历史参考，当前使用 SQLite）
├── docs/
│   ├── API.md              # API 接口文档
│   ├── PRODUCT.md          # 产品说明
│   ├── DEPLOY.md           # 部署指南
│   ├── tech-stack.md       # 技术栈说明
│   └── ITERATION-1.md      # 迭代记录（13 次迭代）
├── .env.example            # 环境变量模板
├── .gitignore
├── CLAUDE.md               # AI 助手上下文文档
└── README.md
```

---

## 五、13 个数据模型

| 模型 | 表名 | 说明 |
|------|------|------|
| `User` | `user` | 用户（邮箱/密码/昵称/手机/头像） |
| `EmailVerification` | `email_verification` | 邮箱验证码（注册/登录/重置密码） |
| `Child` | `child` | 宝贝档案（多孩子支持，活跃切换） |
| `NameReactionRecord` | `name_reaction_record` | 叫名反应训练记录 |
| `PointGameRecord` | `point_game_record` | 指物练习训练记录（12+ 字段） |
| `VoiceGameRecord` | `voice_game_record` | 声音小话筒训练记录 |
| `EmotionGameRecord` | `emotion_game_record` | 情绪识别训练记录 |
| `SurveyResult` | `survey_result` | 问卷筛查结果（M-CHAT-R / CAST） |
| `TreeholeMessage` | `treehole_message` | 树洞留言（匿名 + AI 回复 + 点赞） |
| `DailyRecommendation` | `daily_recommendation` | 每日训练推荐 |
| `AITokenUsage` | `ai_token_usage` | AI 消耗统计（按记录类型追踪） |
| `Notification` | `notification` | 通知系统（训练提醒/周报/树洞互动） |
| `ShareCode` | `share_code` | 分享码（code / child_id / 48h 过期 / 可撤销） |

---

## 六、API 路由一览

| 蓝图 | 前缀 | 路由数 | 用途 |
|------|------|--------|------|
| `auth_bp` | `/api/auth` | 11 | 注册、登录、邮箱验证、密码管理、通知、反馈、注销 |
| `child_bp` | `/api/child` | 5 | 宝贝 CRUD + 活跃切换 |
| `games_bp` | `/api/games` | 7 | 四游戏数据提交 + 历史 + 首页推荐 |
| `survey_bp` | `/api/survey` | 3 | M-CHAT-R(20题) + CAST(37题) |
| `ai_bp` | `/api/ai` | 6 | AI 问卷分析 + 量表推荐 + 综合评估 + 缓存 + Token 统计 |
| `point_game_ai_bp` | `/api/point-game-ai` | 3 | 指物单次/趋势 AI |
| `name_reaction_ai_bp` | `/api/name-reaction-ai` | 3 | 叫名单次/趋势 AI |
| `voice_game_ai_bp` | `/api/voice-game-ai` | 3 | 声音单次/趋势 AI |
| `emotion_game_ai_bp` | `/api/emotion-game-ai` | 3 | 情绪单次/趋势 AI |
| `voice_speech_bp` | `/api/voice` | 1 | 阿里云 ASR 语音识别 |
| `treehole_bp` | `/api/treehole` | 5 | 树洞留言 + AI 回复 + 点赞 + 重生成 + 删除 |
| `share_bp` | `/api/share` | 3 | 分享码生成 / 验证 / 撤销 |

完整 API 文档见 `docs/API.md`

---

## 七、AI 架构

```
┌────────────────────────────────────────────────┐
│            阿里云百炼 AI 模型                     │
├────────────────────┬───────────────────────────┤
│  qwen-turbo         │  qwen3-8b（指物微调）      │
│  ──────────         │  ──────────────            │
│  · 问卷分析          │  · 指物单次分析            │
│  · 综合评估          │  · 指物趋势分析            │
│  · 树洞 AI 回复      │                           │
│  · 叫名反应 AI       │                           │
│  · 声音小话筒 AI     │                           │
│  · 情绪识别 AI       │                           │
├────────────────────┴───────────────────────────┤
│  阿里云 ASR（语音识别）                           │
│  · 声音小话筒 → WebM → WAV → PCM → 一句话识别    │
└────────────────────────────────────────────────┘
         ↓ 增强
  RAG 知识库（本地 TF-IDF + jieba）
  6 份 ASD 循证文献 → 检索 Top-3 → 注入 System Prompt
```

- AI 结果缓存于记录表的 `ai_analysis` 字段
- 综合评估使用 15 分钟内存缓存，同一 child+games 组合不重复调用 AI
- Token 用量通过 `AITokenUsage` 表追踪

---

## 八、常见问题

**Q: 启动报错 `ModuleNotFoundError: No module named 'xxx'`**
A: `pip install -r backend/requirements.txt`

**Q: 数据库在哪？如何查看？**
A: SQLite 文件位于 `backend/star_companion.db`。可用 VS Code 插件 `SQLite Viewer` 直接打开浏览，或下载 DB Browser for SQLite。

**Q: AI 分析返回空**
A: 检查 `.env` 中 `BAILIAN_API_KEY` 是否正确，模型是否已在百炼控制台开通，账户余额是否充足。

**Q: 邮件验证码收不到**
A: `.env` 中 `MAIL_PASSWORD` 需填 QQ 邮箱 **SMTP 授权码**（不是 QQ 密码）。获取方式：QQ 邮箱 → 设置 → 账户 → POP3/SMTP 服务 → 开启 → 获取授权码。

**Q: Python 3.13+ 启动报错 `audioop`**
A: Python 3.13 移除了 `audioop` 模块，`pydub` 不兼容。请使用 Python 3.9 ~ 3.12。

**Q: 端口 7653 被占用**
A: 修改 `backend/app.py` 最后一行 `app.run(debug=True, host='0.0.0.0', port=7653)` 中的端口号，并同步修改 `js/*.js` 中的 API_BASE（搜索 `/api` 确认使用相对路径）。

## License

MIT
