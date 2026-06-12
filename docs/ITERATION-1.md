# 第一次迭代报告 — 2026-06-05

## 迭代目标

对星伴项目进行首次代码质量审查 + 功能测试，发现问题并建立基础设施。

## 发现的问题清单

### 🔴 严重问题（6 个）

| ID | 问题描述 | 文件位置 | 状态 |
|----|---------|---------|------|
| C-1 | 游戏提交接口未校验 child_id，不存在的 child 导致 500 错误（返回 HTML 异常页而非 JSON） | `backend/routes/games.py` | ❌ 待修复 |
| C-2 | `point_game_record` 表缺少 `avg_reaction_time` 列 | MySQL DDL | ✅ 已修复 |
| C-3 | `name_reaction_record`、`voice_game_record`、`point_game_record` 表缺少 `ai_analysis` 列 | MySQL DDL | ✅ 已修复 |
| C-4 | `survey_result` 表缺少 `scale_type`、`max_score`、`ai_analysis`、`dimension_scores` 列 | MySQL DDL | ✅ 已修复 |
| C-5 | `call_ai_for_game_analysis` 忽略了调用方传入的 `max_tokens` 参数（硬编码 500） | `backend/routes/games.py:31` | ❌ 待修复 |
| C-6 | 3 个 AI 调用函数（`ai_analysis.py`、`point_game_ai.py`、`voice_game_ai.py`）缺少 `requests.post` 的 `timeout` 参数 | 3 个文件 | ❌ 待修复 |

### 🟡 一般问题（9 个）

| ID | 问题描述 | 涉及文件 |
|----|---------|---------|
| M-1 | `calculate_month_age()` 重复定义 5 次 | 5 个 routes 文件 |
| M-2 | `save_token_usage()` 重复定义 5 次，签名不一致（1 个版本传独立参数，4 个版本传 dict） | 5 个 routes 文件 |
| M-3 | AI 调用函数碎片化：6 个文件中有 4 种命名（`call_bailian_ai`/`call_ai`/`call_ai_for_game_analysis`/`call_ai_for_treehole`），实现逻辑高度相似 | 6 个文件 |
| M-4 | `build_single_analysis_prompt` 和 `build_trend_analysis_prompt` 模式在 3 个文件中重复 | `point_game_ai.py`、`name_reaction_ai.py`、`voice_game_ai.py` |
| M-5 | `get_recent_records()` 重复 3 份（仅模型类名不同） | 同 M-4 |
| M-6 | `temperature=0.7` 硬编码 6 处 | 6 个 AI 调用函数 |
| M-7 | `max_tokens` 分散硬编码（300/500/1000） | 6 个 AI 调用函数 |
| M-8 | 通知创建时 `User` 导入风格不统一（顶层导入/局部导入/别名） | 4 处 |
| M-9 | `games.py:203` 存在 Dead Code（`return` 后的代码在编辑器中易混淆） | `backend/routes/games.py` |

### 🟢 建议优化（5 个）

| ID | 问题描述 |
|----|---------|
| L-1 | 未使用的 `import json`（`ai_analysis.py`、`point_game_ai.py`） |
| L-2 | `treehole.py` 中 RAG 月龄参数硬编码 30 个月 |
| L-3 | 分页 limit 默认值分散硬编码（5 vs 7） |
| L-4 | Python >=3.13 兼容性：`pydub` 依赖的 `audioop` 模块被移除 |
| L-5 | `database/star_companion.sql` 存在重复 ALTER 语句，缺少幂等性 |

## 测试结果

- **API 测试**：36 个测试用例，32 通过，4 失败（均为外键约束/列缺失导致，已定位根因）
- **数据库**：发现 7 个缺失列，已全部补齐
- **后端启动**：Python 3.9.13 + MySQL 8.0 环境成功运行于 `localhost:5000`

## 下一步建议

1. **优先修复 C-1**：在游戏提交接口增加 child 存在性校验 + 统一异常处理
2. **抽取公共代码**：将 `calculate_month_age`、`save_token_usage`、`call_ai` 提取到 `backend/utils.py`
3. **统一 AI 调用**：合并 6 个 AI 调用函数为 1 个参数化函数
4. **修复 SQL DDL**：清理重复语句，增加幂等性
5. **增加全局异常处理**：避免 500 错误返回 HTML 页面

---

## 第二次迭代 — 前端按钮响应修复（2026-06-05）

### 修复内容

**问题**：用户在登录/注册/忘记密码页面点击"获取验证码"按钮后无任何反应，看起来按钮失效。

**根因**：
1. `sendVerificationCode` 使用 `fetch` 但无超时（`AbortController`），后端挂起时请求无限等待
2. 按钮 click handler 在 `await` 前未禁用按钮/显示加载状态，用户无视觉反馈
3. 树洞发布按钮同样缺少防重复提交保护

**修复文件**：
| 文件 | 修复内容 |
|------|---------|
| `js/auth.js` | `sendVerificationCode` 增加 15s AbortController 超时；登录/注册两个验证码按钮增加立即禁用 + "发送中…" + 失败恢复；`startCodeCountdown` 使用 `textContent` 替代 `innerText` |
| `js/forgetPassword.js` | 同上模式：超时 + 按钮禁用 + 加载态 + 失败恢复 |
| `js/seniorHole.js` | `publishMessage` 增加 `publishBtn.disabled` + "发布中…" + `finally` 恢复 |

---

## 第三次迭代 — 密码约束提示 + 注册网络错误修复（2026-06-05）

### 密码约束提示精确化

**问题**：所有密码违规（长度不足/无字母/无数字）统一提示"密码至少6位"，用户不知道具体哪里不满足。

**修复**：
| 文件 | 变更 |
|------|------|
| `js/validator.js` | 新增 `Validator.getPasswordError(password)` — 逐条检查，多种不满足时随机返回一条 |
| `js/auth.js` | 登录/注册两处密码校验改用 `Validator.getPasswordError()` |
| `backend/routes/auth.py` | 三条密码校验（register/reset-password/change-password）从 `len<6` 改为 `≥8+字母+数字` |

### 注册"网络错误"修复

**问题**：注册时点击"完成注册"提示"网络错误，请稍后重试"，无法判断是后端未启动还是代码 bug。

**修复**：`js/auth.js` 中 `registerUser` 的 catch 块区分：
- TypeError + "fetch/NetworkError" → "无法连接服务器，请确认后端已启动"
- 其他异常 → 保留"网络错误，请稍后重试"

---

## 第四次迭代 — 5 Bug 修复 + 数据库编码 + 同源部署（2026-06-05）

### 1. 注册头像无效
根因：预设头像 `data-avatar` 值为 `bear/cat/dog`（非 FontAwesome 类名），存储后无法正确渲染。  
修复：HTML 改为 `fa-face-smile/fa-cat/fa-dog`，JS 默认值改为 `fa-face-smile`。

### 2. 忘记密码跳转  
根因：`<a href="#">` 触发锚点滚动竞态。  
修复：改为 `href="forgetPassword.html"`，移除 JS 拦截。

### 3. 注销账户 FK 约束失败
根因：`delete_account` 删除 Child 前未删除 AITokenUsage 记录。  
修复：循环中增加 `AITokenUsage.query.filter_by(child_id=child.id).delete()`。

### 4. PDF 导出失败
根因：`window.jspdf` 缺少 null check。  
修复：`exportPDF` 开头增加检查 + 友好提示。

### 5. 通知弹窗无覆盖层
根因：`notif-popup` 完全缺 CSS。  
修复：`peopleHome.css` 增加 fixed 定位 + z-index:9999 + 通知列表项样式。

### 数据库编码修复
根因：`child.gender` ENUM 值为乱码 `'鐢','濂'`（建表编码错误）。  
修复：ALTER TABLE 重设 + `config.py` 强制 utf8mb4 charset。

### 同源部署
`app.py` 增加静态文件托管，JS 改相对路径 `/api`，浏览器直接访问 7653 端口即可。

---

## 第六次迭代 — MySQL → SQLite 迁移（2026-06-05）

### 改动清单
| 文件 | 变更 |
|------|------|
| `.env` | 注释 DATABASE_URL（由 config.py 硬编码 SQLite 绝对路径） |
| `backend/config.py` | 删 MySQL 专用 `ENGINE_OPTIONS`；`load_dotenv(override=True)`；硬编码 SQLite 绝对路径 |
| `backend/models.py` | 9 个 ForeignKey 补 `ondelete`（CASCADE/SET NULL） |
| `backend/app.py` | `PRAGMA foreign_keys=ON` 事件监听（仅 SQLite 执行） |

### 关键决策
- 外键级联：MySQL 靠 DDL，SQLite 靠模型层 `ondelete`
- SQLite 默认不启外键，需 PRAGMA
- 绝对路径绕过 reloader 工作目录变化 + 系统环境变量干扰

---

## 第七次迭代 — 3 Bug 修复（2026-06-05）

### 1. 注销报错 NOT NULL constraint failed
根因：`delete_account` 漏删 Notification，`db.session.delete(user)` 时 SQLAlchemy 尝试 SET NULL 但列不允许。  
修复：增加 `Notification.query.filter_by(user_id=user_id).delete()`。

### 2. 完整分析始终分析指物练习
根因：`goToFullAnalysis()` 中 `game=point` 硬编码。  
修复：自动读取当前激活的 `.tab-btn.active` 的 `data-analysis` 属性，无数据时提示具体游戏名。

### 3. 忘记密码第一次点击不跳转
根因：`<a href="...">` 在某些浏览器/场景下被拦截。  
修复：改为 `onclick="location.href='forgetPassword.html'"` 内联 JS 跳转。

---

## 第九次迭代 — 分享码系统 + PDF+分析页修复（2026-06-08）

### 分享码系统
- ShareCode 模型（code/child_id/games/48h过期/可撤销）
- /api/share/generate, /verify, /revoke 三个端点
- 报告页 share modal 生成码+复制链接，接收方通过码验证

### PDF 优化
- 雷达图用 canvas.toDataURL() 高清截图嵌入
- 文字比例修正（px→mm 因子 0.3528）
- 核心指标 2×2 卡片式布局

### 数据看板修复
- 排序从 session_date 改为 id.desc()（Day类型同日记录排序不准）
- 情绪识别卡片样式对齐（history-row + detail-btn）
- 下拉框互斥（closeAllDropdowns）
- 加载中显示 "-" 替代假数据/0%

### 完整分析页修复
- 支持 game 参数动态切换（指物/叫名/声音/情绪）
- KPI 根据游戏类型显示不同字段
- AI 加载期间显示 "-"

---

## 第十三次迭代 — 综合报告 AI 缓存（2026-06-08）

### 问题
分享页与原报告页 AI 分析内容不同——每次打开页面都重新调用 AI API，非确定性输出导致内容不一致。

### 修复
`ai_analysis.py` 的 `comprehensive_analysis` 端点增加内存缓存：
- 缓存键：`child_id + games`
- 缓存值：完整 `result_data`
- TTL：15 分钟
- 超过 100 条自动清空

同一 child+games 组合，15 分钟内重复请求直接返回缓存，AI 只调用一次。

---

## 第十二次迭代 — 分享链接安全 + 页面内验证（2026-06-08）

### 1. 分享链接不包含分享码
根因：生成链接时把 `?code=XXXXXX` 拼入 URL，码暴露在链接中。  
修复：链接改为清洁路径 `/pages/reportExport.html`，不带任何参数。

### 2. 分享页内验证码（不通过 URL）
根因：验证按钮用 `location.href='?code='+value` 把码放入 URL 再刷新。  
修复：新增 `verifyCodeAndLoad()` 在当前页面调 `/api/share/verify`，成功直接 `loadReport(child_id, games)`，不刷新、码不入 URL。

### 3. 报告加载逻辑复用
新增 `loadReport(childId, games)` 函数，被 3 条入口路径复用：
- 数据看板进入（有 childId）→ 直接加载
- 旧链接兼容（URL 有 code）→ 自动填入验证
- 分享页进入（无参数）→ 显示码输入框

---

## 第十一次迭代 — 分享链接显示 + 情绪分析undefined（2026-06-08）

### 1. 分享弹窗增加完整链接
根因：shareUrl 已计算但从未在弹窗中展示，用户只看到分享码。  
修复：弹窗同时显示分享码 + 完整URL，增加「复制分享码」和「复制链接」两个按钮。

### 2. 情绪识别分析 undefined
根因：emotion_game_ai.py trend-analysis 响应缺少 `total_records` 字段（其他三个游戏都有）。  
修复：响应中增加 `'total_records': len(records_data)`。

---

## 第十次迭代 — PDF比例+分享UI+分析页语法修复（2026-06-08）

### 1. PDF 文字比例修复
根因：`cnTextToImage` 返回高度用了错误的 pt 基准公式，与 dataLook.js 不一致。  
修复：改为 `(totalH / SCALE) * 0.264583`

### 2. 分享入口 UI
根因：无 childId 时只显示错误文本，无分享码输入框。  
修复：显示美观的输入框 + 验证按钮

### 3. dataAnalys.js 语法致命错误
根因：init() 大括号错位，`if(!childId)` 的 `return;}` 意外截断函数，导致 fetchChildInfo/showLoading/fetchTrendAnalysis 悬在函数体外——永不执行。  
这是"分析页始终显示指物练习"的真正根因——实际根本没有加载任何数据。  
修复：修正大括号，恢复函数完整性

---

## 第八次迭代 — 3 Bug 修复（2026-06-05）

### 1. 注销后登录页按钮全部失效
根因：注销成功跳转用了相对路径 `sign-inANDsign-up.html`，解析出错。  
修复：改为绝对路径 `/pages/sign-inANDsign-up.html` + `localStorage.clear()` 彻底清理。

### 2. 完整分析提示「[object PointerEvent]」
根因：`addEventListener('click', goToFullAnalysis)` 把 event 对象传入函数，变 `gameType={event}`。  
修复：改为 `() => goToFullAnalysis()` 不传参数。

### 3. 注册验证码提前校验
根因：步骤1只校验格式，到最终提交才调后端。  
修复：`regNextStep1` 增加 `await fetch('/api/auth/verify-code')` 后端校验，通过才进入步骤2。

---

## 第五次迭代 — 4 Bug 修复（2026-06-05）

### 1. 忘记密码跳转
根因：之前修复遗漏了 JS 拦截残留。  
修复：确认 `href="forgetPassword.html"` + JS handler 已完全移除。

### 2. 注销报错 `AITokenUsage is not defined`
根因：`auth.py` import 行漏了 `AITokenUsage`。  
修复：import 末尾补上。

### 3. PDF 导出空数据崩溃
根因：`_cnTextToImage` 处理空字符串时 canvas height=0 → `toDataURL()` 失败。  
修复：空文本返回 1x1 占位图 + 导出前预检查选中游戏是否有数据，提示具体游戏名。

### 4. 通知弹窗居中毛玻璃
根因：弹窗定位为右上角，无遮罩。  
修复：改为 `fixed + top/left 50% + translate(-50%,-50%)` 居中 + 新增 `notif-overlay` 毛玻璃背景（`backdrop-filter: blur`）+ 点击遮罩关闭。

