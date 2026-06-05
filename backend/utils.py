"""星伴后端公共工具函数

将跨路由文件重复定义的函数集中到此模块，消除代码重复。
"""

from datetime import datetime
from models import db, AITokenUsage
from config import Config
from rag import build_system_prompt
import requests


# ============================================================
# 1. 月龄计算（原 5 处重复定义，现统一为 1 处）
# ============================================================

def calculate_month_age(birth_date):
    """根据出生日期计算当前月龄"""
    if not birth_date:
        return 0
    today = datetime.now().date()
    months = (today.year - birth_date.year) * 12 + (today.month - birth_date.month)
    return max(0, months)


# ============================================================
# 2. Token 用量记录（原 5 处重复定义 + 2 种签名，现统一为 1 处）
# ============================================================

def save_token_usage(record_type, record_id, child_id, model_name, usage_data):
    """保存 AI Token 使用记录

    Args:
        record_type: 记录类型（如 'name_single', 'point_trend' 等）
        record_id: 关联的记录 ID
        child_id: 孩子 ID
        model_name: 使用的模型名称
        usage_data: AI 返回的 usage 字典，包含 prompt_tokens/completion_tokens/total_tokens
    """
    try:
        token_record = AITokenUsage(
            record_type=record_type,
            record_id=record_id,
            child_id=child_id,
            model_name=model_name,
            prompt_tokens=usage_data.get('prompt_tokens', 0),
            completion_tokens=usage_data.get('completion_tokens', 0),
            total_tokens=usage_data.get('total_tokens', 0)
        )
        db.session.add(token_record)
        db.session.commit()
    except Exception as e:
        print(f"[WARN] Token 记录保存失败: {e}")


# ============================================================
# 3. 统一 AI 调用（原 6 处重复实现 + 4 种命名，现统一为 1 处）
# ============================================================

def call_bailian_ai(prompt, extra_knowledge='', analysis_type='survey',
                    config_key='bailian', max_tokens=500, timeout=15,
                    temperature=0.7, enable_thinking=None, system_suffix=''):
    """调用阿里云百炼 AI（集成 RAG），返回 (content, usage_dict)

    Args:
        prompt: 用户提示词
        extra_knowledge: RAG 检索到的额外知识
        analysis_type: 分析类型（survey/name/point/voice/treehole），用于选择系统角色
        config_key: 配置键名
            - 'bailian': 使用 BAILIAN_* 系列配置（qwen-turbo，默认）
            - 'point_game': 使用 POINT_GAME_AI_* 系列配置（指物微调模型）
        max_tokens: 最大生成 token 数（默认 500）
        timeout: HTTP 请求超时秒数（默认 15）
        temperature: 生成温度（默认 0.7）
        enable_thinking: 是否启用深度思考（None=使用模型默认值）
        system_suffix: 追加到 system prompt 末尾的内容（如树洞标签）

    Returns:
        (content: str|None, usage: dict)
    """
    try:
        # 根据 config_key 选择对应的配置
        if config_key == 'point_game':
            model = Config.POINT_GAME_AI_MODEL
            base_url = Config.POINT_GAME_AI_BASE_URL
            api_key = Config.POINT_GAME_AI_API_KEY
        else:
            model = Config.BAILIAN_MODEL
            base_url = Config.BAILIAN_BASE_URL
            api_key = Config.BAILIAN_API_KEY

        url = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        system_content = build_system_prompt(analysis_type, extra_knowledge)
        if system_suffix:
            system_content += system_suffix

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        if enable_thinking is not None:
            payload["enable_thinking"] = enable_thinking

        print(f"[AI] 调用 {model} | 类型: {analysis_type} | max_tokens: {max_tokens}")
        response = requests.post(url, json=payload, headers=headers, timeout=timeout)
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            print(f"[AI] 完成 | tokens: {usage.get('total_tokens', 'N/A')}")
            return content, usage
        else:
            print(f"[AI] 调用失败: {result}")
            return None, {}

    except Exception as e:
        print(f"[AI] 调用异常: {e}")
        return None, {}
