"""RAG 模块 — ASD 专业知识检索增强生成（本地 TF-IDF + jieba）"""
import os
import re
import jieba
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

KNOWLEDGE_DIR = os.path.join(os.path.dirname(__file__), 'knowledge')

_docs = None
_chunks = None
_vectorizer = None
_tfidf_matrix = None


def _load_knowledge():
    global _docs, _chunks, _vectorizer, _tfidf_matrix
    if _chunks is not None:
        return

    _docs = []
    _chunks = []
    try:
        for fname in sorted(os.listdir(KNOWLEDGE_DIR)):
            if not fname.endswith('.md'):
                continue
            with open(os.path.join(KNOWLEDGE_DIR, fname), 'r', encoding='utf-8') as f:
                content = f.read()
            title = content.split('\n')[0].strip('# ').strip()
            _docs.append((title, content))

            sections = re.split(r'\n(?=## )', content)
            for sec in sections:
                sec = sec.strip()
                if not sec:
                    continue
                lines = sec.split('\n')
                sec_title = lines[0].strip('# ').strip()
                sec_body = '\n'.join(lines[1:]).strip()
                if len(sec_body) < 30:
                    continue
                chunk_text = f"【{title} - {sec_title}】\n{sec_body}"
                _chunks.append((sec_title, chunk_text))

        if not _chunks:
            _chunks = [('', '')]

        _vectorizer = TfidfVectorizer(
            tokenizer=lambda x: jieba.lcut(x),
            max_features=800,
            token_pattern=None
        )
        _tfidf_matrix = _vectorizer.fit_transform([c[1] for c in _chunks])
    except Exception as e:
        print(f"⚠️ 加载知识库失败: {e}，RAG 功能将降级")
        _chunks = [('', '')]
        _vectorizer = TfidfVectorizer(
            tokenizer=lambda x: jieba.lcut(x),
            max_features=100,
            token_pattern=None
        )
        _tfidf_matrix = _vectorizer.fit_transform([''])


def retrieve(query, top_k=3):
    _load_knowledge()
    if not _chunks or len(_chunks) <= 1:
        return ''

    query_vec = _vectorizer.transform([query])
    sims = cosine_similarity(query_vec, _tfidf_matrix)[0]

    ranked = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)
    top = [i for i, s in ranked[:top_k] if s > 0.05]

    if not top:
        return ''

    pieces = []
    for i in top:
        pieces.append(_chunks[i][1])
    return '\n\n---\n\n'.join(pieces)


def build_system_prompt(analysis_type, extra_knowledge=''):
    base_role = {
        'survey': (
            "你是一位持有儿童发育行为执照的资深评估顾问，拥有10年以上ASD筛查与评估经验。"
            "你深谙M-CHAT-R和CAST量表的每个条目背后的发育心理学含义，"
            "并能引用相关效度研究（Robins et al., 2014; Scott et al., 2002）为家长提供循证解读。"
        ),
        'name': (
            "你是一位专注于社会定向与听觉处理的儿童发育干预师。"
            "你了解叫名不应是ASD最早出现的核心指标之一（Osterling & Dawson, 1994），"
            "也熟悉通过行为训练和社会动机增强来逐步改善反应（Dawson et al., 2010 ESDM）。"
        ),
        'point': (
            "你是一位共同注意（Joint Attention）与社交沟通干预专家。"
            "你熟悉陈述性指物与请求性指物的发展差异（Baron-Cohen, 1995），"
            "以及基于Kasari et al. (2006) JASPER模式的共同注意干预方法。"
        ),
        'voice': (
            "你是一位儿童语言发育与声音模仿干预师。"
            "你了解声音模仿是语言发展的前奏，也了解ASD儿童在口部运动规划和沟通动机上的挑战。"
            "你遵循自然发展行为干预（NDBI）框架（Schreibman et al., 2015）。"
        ),
        'treehole': (
            "你是一位温暖、专业的心理咨询师，同时具备ASD家庭支持经验。"
            "你理解ASD家长特有的压力、焦虑和孤独感（Hayes & Watson, 2013），"
            "能用共情的方式提供心理支持。"
        ),
    }

    guidelines = (
        '\n\n【专业准则】\n'
        '1. 永远基于循证实践（EBP）给出建议，不使用未经科学验证的方法\n'
        '2. 解读数据时联系发育心理学背景，但用家长能听懂的语言解释\n'
        '''3. 不自称"诊断"，仅说"信号""需要关注""值得进一步评估"\n'''
        '4. 给出的建议必须具体、可操作，家长能在日常生活中直接使用\n'
        '5. 以温暖、赋能的语言收尾，让家长感到被支持而非被评判\n'
        '6. 适当引用量表标准和研究证据增强专业性，但不对家长直接抛出论文名称\n'
        '7. 对于有波动的数据，强调"波动是正常的，看长期趋势"'
    )

    prompt = base_role.get(analysis_type, base_role['survey']) + guidelines

    if extra_knowledge:
        prompt += (
            "\n\n【参考资料—请结合以下专业知识进行分析】\n"
            + extra_knowledge
        )

    return prompt


def build_query_for_retrieval(analysis_type, child_age_months, data_summary):
    type_keywords = {
        'survey': 'ASD筛查 量表评分 M-CHAT-R CAST 风险评估 早期干预 循证',
        'name': '叫名反应 社会定向 听觉回应 叫名不应 ASD核心指标 社会动机 ESDM 早期干预',
        'point': '指物练习 共同注意 JointAttention 陈述性指物 社交动机 JASPER 早期干预',
        'voice': '声音模仿 语言发育 沟通意愿 口部运动 NDBI 发声模仿 早期干预',
        'treehole': 'ASD家长支持 心理疏导 育儿压力 孤独症家庭 父母压力 早期干预',
    }
    keywords = type_keywords.get(analysis_type, 'ASD 孤独症 发育筛查')
    return f"{keywords} {child_age_months}个月 {data_summary}"
