from typing import Dict, List

from app.core.config import get_settings
from app.models.schemas import (
    AnalyzeResponse,
    AnalysisMeta,
    ImprovementSuggestion,
    ResumeActionItem,
    ScoreBreakdown,
    SectionScore,
)
from app.services.evidence_mapper import build_skill_evidence_map, detect_sections, extract_bullets
from app.services.jd_extractor import extract_jd_requirements
from app.services.llm_generator import build_generation_payload
from app.services.recommender import (
    build_project_suggestions,
    build_resume_action_plan,
    build_skill_recommendations,
)
from app.services.scoring import compute_scores
from app.services.skill_extractor import extract_skills, group_skills


def infer_match_level(score: int) -> str:
    if score >= 80:
        return "strong"
    if score >= 60:
        return "moderate"
    return "weak"


def default_summary(matched_keywords: List[str], missing_keywords: List[str]) -> str:
    strengths = ", ".join(matched_keywords[:3]) or "relevant role-aligned strengths"
    gap = missing_keywords[0] if missing_keywords else "role-specific depth"
    return f"Strong alignment in {strengths}. The biggest gap is {gap}, so tailor your resume around proven experience and close missing evidence with projects."


def build_jd_reference_text(jd: Dict[str, object], section_name: str) -> str:
    sectioned_lines = jd.get("sectioned_lines", {}) or {}
    lines = sectioned_lines.get(section_name, [])
    if not lines:
        return ""
    return lines[0]


def build_specific_improvements(jd: Dict[str, object], skill_recommendations: List[Dict[str, object]], sections: Dict[str, str]) -> List[Dict[str, str]]:
    top_missing = skill_recommendations[:3]
    role_focus = str(jd.get("role_focus", "general"))
    required_skills = jd.get("required_skills", [])
    required_preview = ", ".join(required_skills[:5]) if required_skills else "the top required stack"
    summary_additions = ", ".join(item["skill"] for item in top_missing if item["action_label"] == "Add now") or ", ".join(item["skill"] for item in top_missing[:2])
    projects_gap = next((item for item in skill_recommendations if item["action_label"] == "Build project first"), None)
    proof_label = "case study or project" if role_focus in {"marketing", "finance", "hr", "operations", "design", "general"} else "project"
    summary_reference = build_jd_reference_text(jd, "requirements") or build_jd_reference_text(jd, "responsibilities")
    projects_reference = build_jd_reference_text(jd, "responsibilities") or build_jd_reference_text(jd, "requirements")
    skills_reference = build_jd_reference_text(jd, "requirements") or build_jd_reference_text(jd, "preferred")
    current_summary = sections.get("summary", "")
    summary_gap = "Your resume does not appear to have a dedicated summary section." if not current_summary else "Your current summary is too generic for this role."
    summary_reference_clause = f' in lines like "{summary_reference}"' if summary_reference else ""
    skills_reference_clause = f'The strongest requirement signal comes from "{skills_reference}". ' if skills_reference else ""
    projects_reference_clause = f'The JD responsibilities include "{projects_reference}". ' if projects_reference else ""
    summary_text = (
        f"For this {role_focus} role, your summary should explicitly mention {summary_additions or required_preview}. "
        f"{summary_gap} The JD emphasizes {required_preview}"
        f"{summary_reference_clause}, but your summary does not make that fit obvious enough. "
        f"Add one line that connects your proven experience to the target role and another that names the most relevant tools and responsibilities from the JD."
    )
    skills_text = (
        f"Your skills section should be grouped by category and reflect the JD directly. "
        f"{skills_reference_clause}"
        f"Promote proven skills first, then keep missing skills like {', '.join(item['skill'] for item in top_missing if item['action_label'] != 'Add now') or 'the top JD gaps'} out of the resume until you can support them honestly."
    )
    projects_text = (
        f"Your projects or proof-of-work section needs at least one {proof_label} tailored to this job. "
        f"{projects_reference_clause}"
        f"{'Build a ' + proof_label + ' around ' + projects_gap['skill'] + ' so you can show credible proof in future applications.' if projects_gap else 'Add a concrete proof-of-work example that mirrors the responsibilities and terminology from the JD.'}"
    )
    return [
        {"section": "Summary", "priority": "high", "text": summary_text},
        {"section": "Skills", "priority": "high", "text": skills_text},
        {"section": "Projects", "priority": "medium", "text": projects_text},
    ]


def analyze_resume_against_jd(
    resume_text: str,
    jd_text: str,
    parser_used: str,
    jd_parser_used: str,
) -> AnalyzeResponse:
    settings = get_settings()
    jd = extract_jd_requirements(jd_text)
    resume_skills = extract_skills(resume_text)
    matched_keywords = [skill for skill in jd["all_skills"] if skill in resume_skills]
    missing_keywords = [skill for skill in jd["all_skills"] if skill not in resume_skills]

    sections = detect_sections(resume_text)
    bullets = extract_bullets(resume_text)
    evidence_map = build_skill_evidence_map(resume_text, jd["all_skills"])
    scores = compute_scores(
        matched_keywords=matched_keywords,
        all_jd_skills=jd["all_skills"],
        required_skills=jd["required_skills"],
        resume_text=resume_text,
        jd_text=jd_text,
        sections=sections,
    )

    skill_recommendations = build_skill_recommendations(
        missing_skills=missing_keywords,
        required_skills=jd["required_skills"],
        preferred_skills=jd["preferred_skills"],
        evidence_map=evidence_map,
        skill_context=jd.get("skill_context"),
    )
    resume_action_plan = build_resume_action_plan(skill_recommendations)
    project_suggestions = build_project_suggestions(skill_recommendations, role_focus=str(jd.get("role_focus", "general")))

    llm_payload: Dict[str, object] = {}
    try:
        llm_payload = build_generation_payload(
            resume_text=resume_text,
            jd_text=jd_text,
            matched_keywords=matched_keywords,
            missing_keywords=missing_keywords,
            skill_recommendations=skill_recommendations,
            bullets=bullets,
            jd_sections=jd.get("sectioned_lines"),
            skill_context=jd.get("skill_context"),
            role_focus=str(jd.get("role_focus", "general")),
        )
    except Exception:
        llm_payload = {}

    strengths = llm_payload.get("strengths") or [f"Evidence of {skill}" for skill in matched_keywords[:4]]
    weaknesses = llm_payload.get("weaknesses") or [f"Missing evidence for {skill} even though the JD explicitly asks for it." for skill in missing_keywords[:4]]
    responsibilities_reference = build_jd_reference_text(jd, "responsibilities")
    responsibilities_clause = f', especially lines like "{responsibilities_reference}"' if responsibilities_reference else ""
    ats_suggestions = llm_payload.get("ats_suggestions") or [
        f"Use the JD's exact phrasing for proven skills like {', '.join(matched_keywords[:3]) or 'your strongest matching skills'} in your skills and experience sections.",
        f"Do not add missing skills like {', '.join(missing_keywords[:3]) or 'unsupported requirements'} unless you can support them with real project or work evidence.",
        f"Add measurable outcomes to bullets with the specific tools and responsibilities named in the JD{responsibilities_clause}.",
    ]

    improvement_suggestions = [
        ImprovementSuggestion(**item)
        for item in (llm_payload.get("improvement_suggestions") or build_specific_improvements(jd, skill_recommendations, sections))
    ]

    section_scores = [SectionScore(**item) for item in scores["section_scores"]]
    learning_priority = {item["skill"]: item["priority"] for item in skill_recommendations}

    return AnalyzeResponse(
        resume_text=resume_text,
        jd_text=jd_text,
        ats_score=scores["ats_score"],
        match_level=infer_match_level(scores["ats_score"]),
        score_breakdown=ScoreBreakdown(
            keyword_match=scores["keyword_match"],
            hard_requirement_coverage=scores["hard_requirement_coverage"],
            semantic_similarity=scores["semantic_similarity"],
            experience_alignment=scores["experience_alignment"],
            project_relevance=scores["project_relevance"],
            formatting_section_quality=scores["formatting_section_quality"],
        ),
        matched_keywords=matched_keywords,
        missing_keywords=missing_keywords,
        hard_requirements_matched=[skill for skill in jd["required_skills"] if skill in matched_keywords],
        hard_requirements_missing=[skill for skill in jd["required_skills"] if skill not in matched_keywords],
        preferred_requirements_missing=[skill for skill in jd["preferred_skills"] if skill not in matched_keywords],
        strengths=strengths[:6],
        weaknesses=weaknesses[:6],
        ats_suggestions=ats_suggestions[:8],
        missing_skill_groups=group_skills(missing_keywords),
        skill_recommendations=skill_recommendations,
        learning_priority=learning_priority,
        resume_action_plan=[ResumeActionItem(**item) for item in resume_action_plan],
        project_suggestions=project_suggestions,
        bullet_rewrites=llm_payload.get("bullet_rewrites") or [],
        optimized_summary=llm_payload.get("optimized_summary") or default_summary(matched_keywords, missing_keywords),
        structure_suggestions=llm_payload.get("structure_suggestions") or [
            "Keep the resume single-column and text-first.",
            "Place a targeted summary above skills and experience.",
            "Group skills by category instead of a long comma-separated list.",
        ],
        section_scores=section_scores,
        improvement_suggestions=improvement_suggestions,
        analysis_meta=AnalysisMeta(
            parser_used=parser_used,
            jd_parser_used=jd_parser_used,
            embedding_model=settings.embedding_model if settings.enable_embeddings else "disabled",
            llm_provider=settings.llm_provider,
            llm_used=bool(llm_payload),
        ),
        raw_extractions={
            "resume_skills": resume_skills,
            "jd_all_skills": jd["all_skills"],
            "jd_required_skills": jd["required_skills"],
            "jd_preferred_skills": jd["preferred_skills"],
            "jd_domain_terms": jd["domain_terms"],
            "jd_requirement_lines": (jd.get("sectioned_lines", {}) or {}).get("requirements", []),
            "jd_responsibility_lines": (jd.get("sectioned_lines", {}) or {}).get("responsibilities", []),
            "jd_preferred_lines": (jd.get("sectioned_lines", {}) or {}).get("preferred", []),
        },
    )
