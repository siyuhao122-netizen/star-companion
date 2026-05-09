# 星伴项目技术方案

## 项目简介

星伴 (Star Companion) 是一个面向 2-6 岁儿童的 ASD（孤独症谱系障碍）筛查与早期干预辅助平台。通过标准化筛查量表、三项治疗性训练游戏与 AI 智能分析系统，为家长提供「筛查 → 干预 → 数据分析 → 反馈」的完整闭环。

---

## 后端技术

### 框架与核心库

| 技术 | 版本 | 用途 |
|------|------|------|
| **Flask** | 3.0.0 | Web 应用框架，采用工厂模式 `create_app()` 组织代码 |
| **Flask-SQLAlchemy** | 3.1.1 | ORM 数据库操作 |
| **Flask-CORS** | 4.0.0 | 跨域资源共享，允许前端 Live Server 跨域调用 |
| **Flask-Bcrypt** | 1.0.1 | 密码哈希 (bcrypt) |
| **python-dotenv** | 1.0.0 | 环境变量管理 |

### 数据库设计

- **数据库类型**：MySQL（通过环境变量 `DATABASE_URL` 配置连接，如 `mysql+pymysql://user:pass@host/star_companion`）
- **ORM 模型**：10 张表 —— User、EmailVerification、Child、NameReactionRecord、PointGameRecord、VoiceGameRecord、SurveyResult、TreeholeMessage、DailyRecommendation、AITokenUsage
- **索引优化**：对高频查询字段（email、child_id、session_date）建立索引
- **级联删除**：User → Child → 所有关联记录自动级联删除

### API 架构

- **蓝图模式 (Blueprints)**：10 个路由蓝图，按功能模块拆分
- **RESTful 风格**：GET/POST/PUT/DELETE 语义化路由
- **JSON 数据交换**：统一 `{ success, data/message }` 响应格式

### AI 集成

| 模型 | 提供商 | 用途 |
|------|--------|------|
| **qwen-turbo** | 阿里云百炼 | 问卷分析、树洞回复、叫名反应 AI、声音 AI |
| **qwen3-8b（微调）** | 阿里云百炼 | 指物练习单次 + 趋势分析 |
| **阿里云 ASR** | 阿里云语音识别 | 声音小话筒实时语音识别 |

**RAG（检索增强生成）方案**：
- 本地 TF-IDF（jieba 中文分词 + sklearn TfidfVectorizer）知识检索
- 6 份循证 ASD 专业知识库（约 60KB），涵盖 DSM-5 诊断标准、M-CHAT-R/CAST 验证研究、ESDM/ABA/JASPER 干预方法等
- 检索到的专业知识自动注入 System Prompt，增强 AI 分析的专业性和准确性
- 支持 5 种分析类型的角色化 Prompt（问卷/叫名/指物/声音/树洞）

### 音频处理

- **pydub**：WebM → WAV 格式转换（16kHz 单声道）
- **静音裁剪**：自动去除音频首尾静音段
- **音量检测**：作为 ASR 失败的备选方案

---

## 前端技术

### 技术选型

| 技术 | 用途 |
|------|------|
| **HTML5** | 语义化页面结构，12 个页面模块 |
| **CSS3** | Flexbox/Grid 布局，CSS 变量主题色，响应式设计（1024×600 主视口） |
| **Vanilla JavaScript (ES6+)** | 无框架，纯原生 JS 实现 |
| **Chart.js 4.4** | 数据可视化趋势图 |
| **Font Awesome 6.0** | 图标系统 |
| **Google Fonts** | Inter + Noto Sans SC 字体 |

### 核心功能实现

#### 1. 面部表情识别（叫名反应）
- 调用 `lightweight-expression-detector` 进行实时面部表情检测
- 判断孩子是否在叫名后产生表情变化（微笑、惊讶等）

#### 2. 语音交互（声音小话筒）
- MediaRecorder API 录制 WebM 音频
- 上传至后端进行 ASR 识别
- 实时音量可视化反馈

#### 3. 数据看板
- Chart.js 折线图展示训练趋势
- 三项核心指标卡片 + 历史记录列表
- AI 智能分析面板
- PDF 报告导出（html2canvas + jsPDF）

#### 4. PDF 报告导出
- html2canvas 截图（scale:2 高清）+ jsPDF A4 排版
- 封面标题 + 核心指标 + 趋势图 + AI 分析 + 历史记录
- 自动调用后端趋势分析 API 获取最新 AI 建议

---

## 架构图（文字描述）

```
┌─────────────────────────────────────────────────┐
│                    前端层                         │
│  HTML + CSS + JS (Live Server :5501)             │
│  Chart.js | html2canvas | jsPDF                  │
├─────────────────────────────────────────────────┤
│                  HTTP API (:5000)                 │
├─────────────────────────────────────────────────┤
│                 Flask 应用层                      │
│  Blueprints: auth|child|games|survey|ai|voice    │
├─────────────────────────────────────────────────┤
│              业务逻辑层                           │
│  RAG 知识检索 | AI Prompt 构造 | 音频处理         │
├──────────────┬──────────────────────────────────┤
│   MySQL DB   │  阿里云百炼 (qwen-turbo/qwen3)    │
│   (本地)     │  阿里云 ASR (语音识别)             │
└──────────────┴──────────────────────────────────┘
```

---

## 安全措施

- 密码 bcrypt 哈希存储
- 邮箱验证码（6 位，5 分钟过期）
- 环境变量隔离敏感配置（API Key、SMTP 密码等）
- CORS 白名单限制
- SQLAlchemy 参数化查询（防 SQL 注入）

---

## 项目统计

| 维度 | 数量 |
|------|------|
| 后端 Python 文件 | 15 个 |
| 前端页面 | 12 个 |
| JavaScript 模块 | 12 个 |
| CSS 样式表 | 12 个 |
| 数据库表 | 10 张 |
| API 路由端点 | 约 40 个 |
| RAG 知识库文档 | 6 份（约 60KB，50+ 引用论文） |
