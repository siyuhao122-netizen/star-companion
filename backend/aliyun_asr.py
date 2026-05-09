"""
阿里云语音识别工具类
使用一句话识别 API
"""

import json
import time
import hmac
import hashlib
import base64
from datetime import datetime
from urllib.parse import quote
import requests
from config import Config
import sys
import io

# 设置标准输出编码为 UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


class AliyunASR:
    """阿里云语音识别"""

    def __init__(self):
        self.access_key_id = Config.ALIYUN_ACCESS_KEY_ID
        self.access_key_secret = Config.ALIYUN_ACCESS_KEY_SECRET
        self.app_key = Config.ALIYUN_APP_KEY
        self.region = Config.ALIYUN_REGION

        # 一句话识别 API 地址
        self.api_url = f"https://nls-gateway-{self.region}.aliyuncs.com/stream/v1/asr"

    def recognize_audio(self, audio_data, format='pcm', sample_rate=16000):
        """
        识别音频
        :param audio_data: 音频二进制数据
        :param format: 音频格式 (pcm, wav, opus)
        :param sample_rate: 采样率 (8000, 16000)
        :return: 识别结果文本
        """
        try:
            # 生成 Token
            token = self._get_token()
            if not token:
                print("❌ 获取 Token 失败")
                return None

            # 构建请求参数
            params = {
                'appkey': self.app_key,
                'format': format,
                'sample_rate': sample_rate,
                'enable_punctuation_prediction': True,
                'enable_inverse_text_normalization': True,
            }

            # 构建请求头
            headers = {
                'X-NLS-Token': token,
                'Content-Type': f'application/octet-stream',
            }

            # 发送请求
            print(f"🎤 发送音频到阿里云识别 | 大小: {len(audio_data)} bytes")
            response = requests.post(
                self.api_url,
                params=params,
                headers=headers,
                data=audio_data,
                timeout=10
            )

            # 解析结果
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 阿里云识别响应: {json.dumps(result, ensure_ascii=False)}")

                if result.get('status') == 20000000:
                    text = result.get('result', '')
                    confidence = result.get('confidence', 0)
                    print(f"✅ 识别成功: '{text}' (置信度: {confidence})")
                    return text
                else:
                    error_msg = result.get('message', '未知错误')
                    print(f"❌ 识别失败: {error_msg}")
                    return None
            else:
                print(f"❌ 请求失败: HTTP {response.status_code}")
                print(f"   响应: {response.text}")
                return None

        except Exception as e:
            print(f"❌ 阿里云识别异常: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _get_token(self):
        """获取访问 Token"""
        try:
            # 使用正确的 OpenAPI 地址 - 需要包含完整路径
            token_url = "https://nls-meta.cn-shanghai.aliyuncs.com"

            # 使用 UTC 时间
            from datetime import timezone
            timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            nonce = str(int(time.time() * 1000))

            params = {
                'AccessKeyId': self.access_key_id,
                'Action': 'CreateToken',
                'Format': 'JSON',
                'RegionId': self.region,
                'SignatureMethod': 'HMAC-SHA1',
                'SignatureNonce': nonce,
                'SignatureVersion': '1.0',
                'Timestamp': timestamp,
                'Version': '2019-02-28',
            }

            signature = self._generate_signature(params)
            params['Signature'] = signature

            print(f"🔗 请求URL: {token_url}")

            response = requests.get(token_url, params=params, timeout=10)

            print(f"📡 响应状态: {response.status_code}")

            if response.status_code == 200:
                result = response.json()
                token_data = result.get('Token', {})
                token = token_data.get('Id', '')
                expire_time = token_data.get('ExpireTime', 0)

                if token:
                    print(f"✅ Token 获取成功 | 过期时间: {expire_time}")
                    return token
                else:
                    print(f"❌ Token 为空: {result}")
                    return None
            else:
                print(f"❌ Token 请求失败: HTTP {response.status_code}")
                print(f"   响应: {response.text}")
                return None

        except Exception as e:
            print(f"❌ 获取 Token 异常: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _generate_signature(self, params):
        """生成签名"""
        # 排序参数
        sorted_params = sorted(params.items())

        # 构建待签名字符串
        query_string = '&'.join([f"{quote(k, safe='')}={quote(str(v), safe='')}" for k, v in sorted_params])

        # 构建 StringToSign
        string_to_sign = f"GET&{quote('/', safe='')}&{quote(query_string, safe='')}"

        print(f"🔐 StringToSign: {string_to_sign[:100]}...")

        # 计算签名
        key = (self.access_key_secret + '&').encode('utf-8')
        message = string_to_sign.encode('utf-8')
        signature = base64.b64encode(hmac.new(key, message, hashlib.sha1).digest()).decode('utf-8')

        print(f"🔐 Signature: {signature[:20]}...")

        return signature


def test_aliyun_asr():
    """测试阿里云语音识别"""
    print("=" * 50)
    print("测试阿里云语音识别")
    print("=" * 50)

    asr = AliyunASR()

    token = asr._get_token()
    if token:
        print(f"\n✅ Token 测试通过")
        print(f"   Token: {token[:20]}...")
        return True
    else:
        print(f"\n❌ Token 测试失败")
        return False


if __name__ == '__main__':
    test_aliyun_asr()
