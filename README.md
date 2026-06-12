# 星伴 (Star Companion)

面向 2-6 岁儿童的孤独症谱系障碍（ASD）筛查与早期干预辅助平台。通过标准化量表筛查、四项治疗性训练游戏、AI 智能分析，为家长提供「筛查 → 干预 → 数据 → 反馈」的完整闭环。

## 功能概览

| 模块 | 说明 |
|------|------|
| 筛查评估 | M-CHAT-R（16-30 月龄）/ CAST（4-11 岁），AI 分析 + 风险分级 |
| 叫名反应 | 面部表情 + 语音检测，训练社会定向能力 |
| 指物练习 | 共同注意训练，区分陈述性/请求性指物 |
| 声音小话筒 | 阿里云 ASR 语音识别，训练发声模仿 |
| 情绪识别 | 8 轮情景故事，语音播报 + 表情选项，训练共情与情绪认知 |
| 数据看板 | 4 游戏 Chart.js 趋势图 + AI 报告 + 综合 PDF 导出 |
| 综合报告 | 雷达图 + AI 综合分析 + 分享码分享 + PDF 下载 |
| 家长树洞 | 匿名倾诉 + AI 自动回复（RAG 专业知识增强） |
| 个人中心 | 通知系统、帮助与反馈、账号管理 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.9+ / Flask 3.0 / SQLAlchemy / SQLite |
| 前端 | Vanilla HTML + CSS + JavaScript（无框架） |
| AI | 阿里云百炼 qwen-turbo / qwen3-8b + RAG 知识库 |
| 语音 | 阿里云 ASR 实时语音识别 |
| 图表 | Chart.js 4.4 |
| PDF | jsPDF 2.5 + html2canvas |
| 数据库 | SQLite（零配置，文件存储） |

---

## 快速启动（3 步）

### 第一步：安装 Python 依赖

```bash
pip install -r backend/requirements.txt
```

### 第二步：配置环境变量

复制 `.env.example` 为 `.env`，填写必要配置：

```ini
SECRET_KEY=你的密钥
MAIL_USERNAME=你的QQ邮箱@qq.com
MAIL_PASSWORD=QQ邮箱SMTP授权码
BAILIAN_API_KEY=sk-你的百炼API密钥
BAILIAN_MODEL=qwen-turbo
POINT_GAME_AI_API_KEY=sk-你的指物模型密钥
ALIYUN_ACCESS_KEY_ID=你的阿里云AK
ALIYUN_ACCESS_KEY_SECRET=你的阿里云SK
ALIYUN_APP_KEY=你的语音识别AppKey
```

### 第三步：启动

```bash
python backend/app.py
```

浏览器打开 `http://127.0.0.1:7653` 即可使用。数据库自动创建，无需安装 MySQL。

---

## 项目结构

```
star-companion/
├── backend/
│   ├── app.py              # Flask 入口（端口 7653，托管前端静态文件）
│   ├── config.py           # 配置管理
│   ├── models.py           # 13 个数据模型
│   ├── utils.py            # 公共工具函数
│   ├── rag.py              # RAG 知识库检索（jieba + TF-IDF）
│   ├── aliyun_asr.py       # 阿里云语音识别 SDK
│   ├── knowledge/          # 6 份 ASD 循证文献
│   ├── requirements.txt    # Python 依赖
│   └── routes/             # 12 个路由蓝图
│       ├── auth.py         # 注册/登录/验证码/通知/反馈/注销
│       ├── child.py        # 宝贝 CRUD
│       ├── games.py        # 4 游戏数据提交 + 推荐
│       ├── survey.py       # 问卷题目 + 提交
│       ├── ai_analysis.py  # AI 问卷分析 + 综合评估 + 缓存
│       ├── point_game_ai.py
│       ├── name_reaction_ai.py
│       ├── voice_game_ai.py
│       ├── emotion_game_ai.py
│       ├── voice_speech.py # 语音识别
│       ├── treehole.py     # 树洞社区
│       └── share.py        # 分享码生成/验证/撤销
├── pages/                  # HTML 页面
├── js/                     # JavaScript
├── css/                    # CSS 样式
├── database/               # MySQL DDL（参考用，已不用）
├── docs/                   # 产品/API/部署文档 + 迭代记录
└── README.md
```

## API 路由一览

| 路由前缀 | 用途 |
|---------|------|
| `/api/auth` | 注册、登录、邮箱验证、密码管理、通知、反馈、注销 |
| `/api/child` | 宝贝档案 CRUD + 活跃切换 |
| `/api/games` | 4 游戏结果提交 + 历史 + 首页推荐 |
| `/api/survey` | M-CHAT-R(20题) + CAST(37题) |
| `/api/ai` | AI 问卷分析 + 量表推荐 + 综合评估 + Token 统计 |
| `/api/point-game-ai` | 指物练习单次/趋势 AI |
| `/api/name-reaction-ai` | 叫名反应单次/趋势 AI |
| `/api/voice-game-ai` | 声音小话筒单次/趋势 AI |
| `/api/emotion-game-ai` | 情绪识别单次/趋势 AI |
| `/api/voice` | 语音识别（ASR） |
| `/api/treehole` | 树洞留言 + AI 回复 |
| `/api/share` | 分享码生成 + 验证 + 撤销 |

## 常见问题

**Q: 启动报错 `ModuleNotFoundError`**
A: `pip install -r backend/requirements.txt`

**Q: 数据库在哪**
A: 自动创建在 `backend/star_companion.db`（SQLite 文件）

**Q: AI 分析返回空**
A: 检查 `.env` 中百炼 API Key 是否正确，模型是否已开通，账户余额是否充足

**Q: 邮件验证码收不到**
A: `.env` 中 `MAIL_PASSWORD` 需填写 QQ 邮箱 SMTP 授权码（不是 QQ 密码）

**Q: Python 版本要求**
A: Python 3.9 ~ 3.12（3.13+ 移除了 `audioop` 导致 `pydub` 不兼容）

## License

MIT
