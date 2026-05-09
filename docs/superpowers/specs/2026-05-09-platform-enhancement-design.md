# 星伴平台三项完善 — 设计方案

## 1. 敏感变量环境化

**改动文件**：
- `backend/routes/auth.py`：删除硬编码 SENDER_EMAIL / SENDER_PASSWORD（第19-20行），改为从 config.Config 读取
- `.env.example`：补充完整模板

## 2. 数据看板 PDF 导出

**方案**：前端纯客户端方案 html2canvas + jsPDF
**改动文件**：
- `pages/dataLook.html`：添加导出按钮 + 勾选面板
- `js/dataLook.js`：添加导出逻辑
- `css/dataLook.css`：添加按钮/面板样式
- CDN 引入 html2canvas 和 jsPDF

## 3. RAG + 专业 Prompt 提升 AI 分析

**方案**：本地 TF-IDF 检索 + 专业知识库 + 结构化 Prompt
**新增文件**：
- `backend/knowledge/` — ASD 专业知识库（Markdown）
- `backend/rag.py` — 检索增强生成模块
**改动文件**：
- 各 AI 路由文件：集成 RAG 检索 + 增强 Prompt
- `config.py`：新增 RAG 配置项
