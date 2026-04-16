from typing import Dict, List

from app.services.llm_client import request_json


def build_generation_payload(
    resume_text: str,
    jd_text: str,
    matched_keywords: List[str],
    missing_keywords: List[str],
    skill_recommendations: List[Dict[str, object]],
    bullets: List[str],
    jd_sections: Dict[str, List[str]] | None = None,
    skill_context: Dict[str, str] | None = None,
    role_focus: str = "general",
) -> Dict[str, object]:
    jd_sections = jd_sections or {}
    skill_context = skill_context or {}
    required_lines = jd_sections.get("requirements", [])[:5]
    responsibility_lines = jd_sections.get("responsibilities", [])[:5]
    preferred_lines = jd_sections.get("preferred", [])[:3]
    top_skill_context = {
        item["skill"]: skill_context.get(item["skill"], "")
        for item in skill_recommendations[:8]
        if item.get("skill")
    }

    system_prompt = (
        "You are a job-specific resume coach for a production AI career platform. "
        "Never invent experience. Only rewrite using skills already evidenced or explicitly marked Add now. "
        "Be concrete, job-specific, and implementation-oriented. "
        "Every recommendation must be grounded in the job description language provided. "
        "Return JSON only."
    )

    user_prompt = f"""
Resume:
{resume_text[:5000]}

Job description:
{jd_text[:4000]}

Matched keywords:
{matched_keywords}

Missing keywords:
{missing_keywords}

Skill recommendations:
{skill_recommendations[:8]}

Candidate bullets:
{bullets[:8]}

JD requirement lines:
{required_lines}

JD responsibility lines:
{responsibility_lines}

JD preferred lines:
{preferred_lines}

Skill context from JD:
{top_skill_context}

Role focus:
{role_focus}

Return JSON with keys:
- bullet_rewrites: array of objects {{original_bul