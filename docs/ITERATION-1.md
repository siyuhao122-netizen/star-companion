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

