# test_point_game_ai.py
import requests
import json

url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
headers = {
    "Authorization": "sk-1895293d88424c0388e03f12a46b6b54",
    "Content-Type": "application/json"
}

payload = {
    "model": "qwen3-8b-cee00651458c",  # 你的调优模型名
    "messages": [
        {"role": "user", "content": "你好，请简单介绍一下自己"}
    ],
    "temperature": 0.7,
    "max_tokens": 100,
    "enable_thinking": False
}

response = requests.post(url, json=payload, headers=headers)
print(json.dumps(response.json(), ensure_ascii=False, indent=2))