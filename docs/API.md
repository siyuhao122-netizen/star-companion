# 星伴 API 接口文档

Base URL: `http://localhost:5000/api`

所有接口使用 JSON 格式，响应结构统一为 `{ "success": true/false, "data": ..., "message": "..." }`。

---

## 1. 用户认证 `/api/auth`

### POST `/api/auth/send-verify-code`
发送邮箱验证码

**Request:**
```json
{ "email": "user@qq.com", "type": "register" }
```
type 可选：`register` / `login` / `reset_password`

**Response:**
```json
{ "success": true, "message": "验证码已发送" }
```

### POST `/api/auth/register`
用户注册

**Request:**
```json
{ "email": "user@qq.com", "code": "123456", "nickname": "李妈妈", "password": "123456" }
```

**Response:**
```json
{ "success": true, "message": "注册成功", "user_id": 1 }
```

### POST `/api/auth/login`
用户登录（密码或验证码两种方式）

**Request (密码登录):**
```json
{ "email": "user@qq.com", "password": "123456", "loginType": "password" }
```
**Request (验证码登录):**
```json
{ "email": "user@qq.com", "code": "123456", "loginType": "code" }
```

**Response:**
```json
{ "success": true, "user": { "id": 1, "email": "user@qq.com", "nickname": "李妈妈" } }
```

### POST `/api/auth/reset-password`
重置密码

**Request:**
```json
{ "email": "user@qq.com", "newPassword": "654321" }
```

### POST `/api/auth/change-password`
修改密码（需验证当前密码）

**Request:**
```json
{ "user_id": 1, "current_password": "old", "new_password": "new" }
```

### POST `/api/auth/delete-account`
注销账户（删除所有关联数据）

**Request:**
```json
{ "user_id": 1 }
```

### POST `/api/auth/update-phone`
更新手机号

**Request:**
```json
{ "user_id": 1, "phone": "13812345678" }
```

### GET `/api/auth/notifications/<user_id>`
获取通知列表

**Query:** `?limit=20&unread=1`

**Response:**
```json
{
  "success": true,
  "data": {
    "unread_count": 3,
    "list": [{
      "id": 1, "type": "treehole_like", "title": "有人给你的留言点了赞",
      "content": "你的留言获得了 5 个赞", "is_read": false, "created_at": "2026-05-09T..."
    }]
  }
}
```

### POST `/api/auth/notifications/mark-read`
标记通知为已读

**Request (标记单条):**
```json
{ "id": 1 }
```
**Request (全部已读):**
```json
{ "user_id": 1, "mark_all": true }
```

### POST `/api/auth/notifications/create`
前端创建通知（用于训练/周报提醒）

**Request:**
```json
{ "user_id": 1, "type": "training_remind", "title": "训练时间到啦", "content": "..." }
```

### POST `/api/auth/feedback`
提交反馈

**Request:**
```json
{ "user_id": 1, "content": "建议增加..." }
```

---

## 2. 孩子管理 `/api/child`

### GET `/api/child/list/<user_id>`
获取用户的所有孩子

**Response:**
```json
{
  "success": true,
  "children": [{
    "id": 1, "name": "小宝", "gender": "男", "birth": "2023-06-15", "relation": "妈妈",
    "avatar_type": "icon", "avatar": "fa-face-smile", "focus_tags": ["社交","语言"],
    "is_active": true
  }]
}
```

### POST `/api/child/add`
添加孩子

**Request:**
```json
{
  "user_id": 1, "name": "小宝", "gender": "男", "birth_date": "2023-06-15",
  "relation": "妈妈", "avatar_type": "icon", "avatar": "fa-face-smile",
  "focus_tags": ["社交","语言"], "note": ""
}
```

### PUT `/api/child/update/<child_id>`
更新孩子信息

### POST `/api/child/set-active`
切换活跃孩子

**Request:**
```json
{ "user_id": 1, "child_id": 2 }
```

### GET `/api/child/<child_id>`
获取单个孩子信息

### DELETE `/api/child/<child_id>`
删除孩子

---

## 3. 游戏数据 `/api/games`

### POST `/api/games/name-reaction`
提交叫名反应训练结果（自动触发 AI 分析）

**Request:**
```json
{
  "child_id": 1, "round_total": 8, "success_count": 5,
  "avg_reaction_time": 2.3, "round_details": [...]
}
```

**Response:**
```json
{ "id": 1, "ai_analysis": "AI分析文字..." }
```

### GET `/api/games/name-reaction/history/<child_id>`
获取叫名反应历史记录

### POST `/api/games/point-game`
提交指物练习训练结果

**Request:**
```json
{
  "child_id": 1, "round_total": 8, "correct_rounds": 6,
  "wrong_rounds": 2, "total_clicks": 12, "correct_clicks": 8,
  "wrong_clicks": 4, "timeout_count": 0, "skip_count": 0,
  "total_time_sec": 45.2, "avg_time_sec": 5.6,
  "avg_reaction_time": 3.1, "accuracy": 75, "click_accuracy": 66, "round_details": [...]
}
```

### POST `/api/games/voice-game`
提交声音小话筒训练结果

**Request:**
```json
{
  "child_id": 1, "round_total": 8, "completed_rounds": 6,
  "success_count": 4, "round_details": [...]
}
```

---

## 4. 问卷筛查 `/api/survey`

### GET `/api/survey/questions/<scale_type>`
获取问卷题目

scale_type: `mchat` / `cast`

**Response:**
```json
{
  "success": true,
  "data": { "scale_name": "M-CHAT-R", "questions": [{"id": 1, "text": "..."}, ...] }
}
```

### POST `/api/survey/submit`
提交问卷结果

**Request:**
```json
{ "child_id": 1, "scale_type": "mchat", "answers": [0, 0, 1, ...] }
```

---

## 5. AI 分析 `/api/ai`

### POST `/api/ai/survey-analysis`
AI 问卷分析（生成报告）

**Request:**
```json
{ "child_id": 1, "scale_type": "mchat", "answers": [0, 0, 1, ...] }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1, "scale_name": "M-CHAT-R", "total_score": 8, "max_score": 20,
    "risk_level": "高风险", "ai_analysis": "...", "dimension_scores": {...}
  }
}
```

### GET `/api/ai/survey-history/<child_id>`
获取问卷历史

**Query:** `?scale_type=mchat`

### GET `/api/ai/recommend-scale/<child_id>`
根据月龄推荐量表

### GET `/api/ai/scale-info/<scale_type>`
获取量表配置信息

### GET `/api/ai/token-usage/<child_id>`
获取 AI Token 使用统计

---

## 6. 指物练习 AI `/api/point-game-ai`

### POST `/api/point-game-ai/single-analysis`
指物练习单次 AI 分析（首次调用，结果缓存）

**Request:**
```json
{ "child_id": 1, "record_id": 1 }
```

### GET `/api/point-game-ai/trend-analysis/<child_id>`
指物练习趋势 AI 分析

**Query:** `?limit=5`

### GET `/api/point-game-ai/point-records/<child_id>`
获取指物练习记录（不含 AI）

**Query:** `?limit=7`

---

## 7. 叫名反应 AI `/api/name-reaction-ai`

### POST `/api/name-reaction-ai/single-analysis`
叫名反应单次 AI 分析

**Request:**
```json
{ "child_id": 1, "record_id": 1 }
```

### GET `/api/name-reaction-ai/trend-analysis/<child_id>`
叫名反应趋势 AI 分析

### GET `/api/name-reaction-ai/records/<child_id>`
获取叫名反应记录

---

## 8. 声音小话筒 AI `/api/voice-game-ai`

### POST `/api/voice-game-ai/single-analysis`
声音小话筒单次 AI 分析

**Request:**
```json
{ "child_id": 1, "record_id": 1 }
```

### GET `/api/voice-game-ai/trend-analysis/<child_id>`
声音小话筒趋势 AI 分析

### GET `/api/voice-game-ai/records/<child_id>`
获取声音小话筒记录

---

## 9. 语音识别 `/api/voice`

### POST `/api/voice/recognize`
上传音频进行语音识别

**Request:** `multipart/form-data`
- `audio`: WebM 音频文件
- `child_id`: 孩子 ID

**Response:**
```json
{ "success": true, "text": "识别出的文字", "is_success": true }
```

---

## 10. 树洞社区 `/api/treehole`

### GET `/api/treehole/messages`
获取留言列表

**Query:** `?tag=日常倾诉`

### POST `/api/treehole/post`
发布留言（自动触发 AI 回复）

**Request:**
```json
{
  "user_id": 1, "content": "今天宝贝第一次主动叫妈妈了",
  "tag": "进步分享", "anonymous_name": "星星妈妈", "anonymous_avatar": "fa-star"
}
```

**Response:**
```json
{ "success": true, "id": 1, "ai_reply": "AI回复文字..." }
```

### POST `/api/treehole/regenerate-ai-reply/<msg_id>`
重新生成 AI 回复

### POST `/api/treehole/like/<msg_id>`
点赞留言（触发通知）

### DELETE `/api/treehole/delete/<msg_id>`
删除留言
