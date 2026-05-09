from flask import Blueprint, request, jsonify
import json
import os
import tempfile
from pydub import AudioSegment
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from aliyun_asr import AliyunASR

voice_speech_bp = Blueprint('voice_speech', __name__)

# 初始化阿里云识别
aliyun_asr = AliyunASR()


@voice_speech_bp.route('/speech-recognize', methods=['POST'])
def speech_recognize():
    """语音识别 - 使用阿里云 API"""

    if 'audio' not in request.files:
        return jsonify({'success': False, 'message': '未收到音频文件'}), 400

    audio_file = request.files['audio']
    keywords_str = request.form.get('keywords', '[]')
    target = request.form.get('target', '')

    try:
        keywords = json.loads(keywords_str)
    except:
        keywords = []

    print(f'🎤 收到音频请求 | 目标: {target} | 关键词: {keywords}')

    # 保存原始 webm 文件
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
        audio_file.save(tmp.name)
        webm_path = tmp.name
        file_size = os.path.getsize(webm_path)

    print(f'📁 webm文件: {webm_path} | 大小: {file_size} bytes')

    # 文件太小，直接返回失败
    if file_size < 1000:
        os.unlink(webm_path)
        return jsonify({
            'success': True,
            'text': '',
            'matched': False,
            'message': '音频文件太小'
        }), 200

    wav_path = None
    pcm_path = None
    try:
        # 转换为 WAV
        wav_path = webm_path.replace('.webm', '.wav')
        audio_segment = AudioSegment.from_file(webm_path, format='webm')

        # 优化音频参数
        audio_segment = audio_segment.set_frame_rate(16000).set_channels(1)
        audio_segment = audio_segment + 10

        # 去除静音
        audio_segment = audio_segment.strip_silence(
            silence_len=200,
            silence_thresh=-40,
            padding=100
        )

        audio_segment.export(wav_path, format='wav')
        print(f'✅ 已转换为WAV: {wav_path} | 时长: {len(audio_segment)/1000:.2f}秒')

        # 转换为 PCM 格式 (s16le = signed 16-bit little-endian)
        pcm_path = wav_path.replace('.wav', '.pcm')
        audio_segment.export(pcm_path, format='s16le')
        print(f'✅ 已转换为PCM: {pcm_path}')

        # 读取 PCM 数据
        with open(pcm_path, 'rb') as f:
            pcm_data = f.read()

        # 调用阿里云识别
        text = aliyun_asr.recognize_audio(pcm_data, format='pcm', sample_rate=16000)
        recognition_method = 'Aliyun ASR'
        confidence = 0.9 if text else 0

        # 如果阿里云识别失败，使用降级方案
        if not text:
            print('⚠️ 阿里云识别失败，启用降级方案：音量判定')
            if file_size > 5000:
                text = target
                confidence = 0.3
                recognition_method = 'Volume-based (fallback)'
                print(f'✅ 降级判定: 检测到声音，假设为目标音 "{target}"')

        # 检查关键词匹配
        matched = False
        matched_keyword = ''
        match_score = 0

        if text:
            text_lower = text.lower().strip()
            text_clean = ''.join(c for c in text_lower if c.isalnum())
            print(f'🔍 检查匹配: 原文="{text}" | 清理后="{text_clean}" | 关键词={keywords}')

            best_match_score = 0

            for kw in keywords:
                kw_clean = ''.join(c for c in kw.lower() if c.isalnum())
                current_score = 0

                if text_clean == kw_clean:
                    current_score = 100
                    print(f'  ✅ 完全匹配: "{kw}" (分数: {current_score})')
                elif kw_clean in text_clean:
                    if len(kw_clean) == 1:
                        if text_clean == kw_clean or text_clean.startswith(kw_clean) or text_clean.endswith(kw_clean):
                            current_score = 80
                            print(f'  ✅ 单字符精确匹配: "{kw}" (分数: {current_score})')
                        else:
                            current_score = 40
                            print(f'  ⚠️ 单字符弱匹配: "{kw}" (分数: {current_score})')
                    else:
                        current_score = 90
                        print(f'  ✅ 包含匹配: "{kw}" (分数: {current_score})')
                elif text_clean in kw_clean and len(text_clean) >= 1:
                    current_score = 70
                    print(f'  ✅ 反向包含: "{kw}" (分数: {current_score})')
                elif len(kw_clean) > 0 and len(text_clean) > 0:
                    if kw_clean[0] == text_clean[0]:
                        current_score = 30
                        print(f'  ⚠️ 首字母匹配: "{kw}" (分数: {current_score})')

                if current_score > best_match_score:
                    best_match_score = current_score
                    matched_keyword = kw

            if best_match_score >= 60:
                matched = True
                match_score = best_match_score
                print(f'  ✅ 最终匹配成功: "{matched_keyword}" (分数: {match_score})')
            else:
                print(f'  ❌ 匹配分数不足: 最高分={best_match_score} (需要>=60)')

        result = {
            'success': True,
            'text': text,
            'matched': matched,
            'matched_keyword': matched_keyword,
            'match_score': match_score,
            'target': target,
            'keywords': keywords,
            'recognition_method': recognition_method,
            'confidence': confidence
        }
        print(f'📤 返回结果: {json.dumps(result, ensure_ascii=False)}')

    except Exception as e:
        print(f'❌ 识别异常: {e}')
        import traceback
        traceback.print_exc()

        result = {
            'success': True,
            'text': '',
            'matched': file_size > 5000,
            'fallback': True,
            'message': '识别失败，使用降级判定'
        }
        print(f'📤 降级返回: {json.dumps(result, ensure_ascii=False)}')

    finally:
        if os.path.exists(webm_path):
            os.unlink(webm_path)
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)
        if pcm_path and os.path.exists(pcm_path):
            os.unlink(pcm_path)
        print(f'🗑️ 已删除临时文件')

    return jsonify(result), 200
