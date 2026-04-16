from typing import Dict, List

from app.core.config import get_settings

try:
    from sentence_transformers import SentenceTransformer, util
except Exception:  # pragma: no cover
    SentenceTransformer = None
    util = None

_embedding_model = None


def _get_embedding_model():
    global _embedding_model
    settings = get_settings()
    if not settings.enable_embeddings or SentenceTransformer is None:
        return None
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(settings.embedding_model)
    return _embedding_model


def percentage(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        return 0
    return max(0, min(100, round((numerator / denominator) * 100)))


def compute_semantic_similarity(resume_text: str, jd_text: str) -> int:
    model = _get_embedding_model()
    if model is None or util is None:
        return 0
    embeddings = model.encode([resume_text[:4000], jd_text[:4000]], convert_to_tensor=True)
    score = float(util.cos_sim(embeddings[0], embeddings[1]).item())
    return max(0, min(100, round(score * 100)))


def compute_section_scores(sections: Dict[str, str]) -> List[Dict[str, str | int]]:
    required_sections = ["summary", "skills", "experience", "projects", "education"]
    results = []
    for section in required_sections:
        content = sections.get(section, "")
        if not content:
            results.append({
                "section": section.title(),
                "score": 0,
                "status": "missing",
                "feedback": f"{section.title()} section is missing and should be added for ATS readability.",
            })
            continue

        length = len(content.split())
        score = 90 if length >= 40 else 70 if length >= 15 else 45
        status = "excellent" if score >= 85 else "good" if score >= 70 else "needs_improvement"
        results.append({
            "section": section.title(),
            "score": score,
            "status": status,
            "feedback": f"{section.title()} section is present but can be improved with clearer JD-aligned detail." if score < 85 else f"{section.title()} section is present and readable.",
        })
    return results


def compute_scores(
    matched_keywords: List[str],
    all_jd_skills: List[str],
    required_skills: List[str],
    resume_text: str,
    jd_text: str,
    sections: Dict[str, str],
) -> Dict[str, int | List[Dict[str, str | int]]]:
    keyword_match = percentage(len(matched_keywords), max(len(all_jd_skills), 1))
    hard_requirement_coverage = percentage(
        len([skill for skill in required_skills if skill in matched_keywords]),
        max(len(required_skills), 1),
    )
    semantic_similarity = compute_semantic_similarity(resume_text, jd_text)
    experience_alignment = 80 if sections.get("experience") else 35
    project_relevance = 80 if sections.get("projects") else 40
    section_scores = compute_section_scores(sections)
    formatting_section_quality = round(sum(item["score"] for item in section_scores) / len(section_scores))

    final_score = round(
        keyword_match * 0.30
        + hard_requirement_coverage * 0.25
        + semantic_similarity * 0.15
        + experience_alignment * 0.10
        + project_relevance * 0.10
        + formatting_section_quality * 0.10
    )

    return {
        "ats_score": max(0, min(100, final_score)),
        "keyword_match": keyword_match,
        "hard_requirement_coverage": hard_requirement_coverage,
        "semantic_similarity": semantic_similarity,
        "experience_alignment": experience_alignment,
        "project_relevance": project_relevance,
        "formatting_section_quality": formatting_section_quality,
        "section_scores": section_scores,
    }
