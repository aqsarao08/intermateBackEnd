import re
from collections import defaultdict
from typing import Any, Dict, List

from app.models.schemas import (
    ConceptDiagnosisRequest,
    ConceptDiagnosisResponse,
    LearningObjectiveDTO,
    LearningPlanRequest,
    LearningPlanResponse,
    LearningProgressDTO,
    LearningWeakness,
    ProjectRecommendation,
    RecommendProjectsRequest,
    RecommendProjectsResponse,
    SourceSignalInput,
    LearningModuleDTO,
    TargetedResource,
)
from app.services.llm_client import request_json
from app.services.skill_extractor import canonicalize


CATEGORY_RULES = {
    "frontend": ["react", "next.js", "redux", "javascript", "typescript", "css", "html", "ui", "frontend"],
    "backend": ["node.js", "express", "api", "authentication", "authorization", "backend", "microservices"],
    "databases": ["mongodb", "postgresql", "mysql", "redis", "database", "sql"],
    "dsa": ["dsa", "algorithms", "data structures", "leetcode", "problem solving"],
    "system_design": ["system design", "scalability", "distributed systems", "architecture"],
    "cloud_devops": ["aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "terraform", "deployment"],
    "testing": ["jest", "pytest", "testing", "react testing library", "cypress", "playwright", "unit test"],
    "behavioral": ["communication", "leadership", "behavioral", "storytelling", "collaboration"],
    "cs_fundamentals": ["oop", "operating systems", "networking", "dbms", "computer science"],
    "marketing": ["marketing", "seo", "sem", "campaign", "brand", "content", "social media", "copywriting"],
    "finance": ["finance", "financial", "accounting", "budget", "forecast", "excel", "power bi", "tableau"],
    "hr": ["recruitment", "talent acquisition", "employee relations", "onboarding", "training", "hr"],
    "operations": ["operations", "process improvement", "procurement", "supply chain", "inventory", "vendor"],
    "design": ["design", "figma", "wireframe", "prototype", "branding", "ux", "ui design", "graphic design"],
}

SOURCE_WEIGHT_DEFAULTS = {
    "resume_jd_gap": 0.85,
    "resume_analysis": 0.65,
    "interview_feedback": 0.75,
    "quiz_result": 0.70,
    "coding_lab_result": 0.80,
    "manual_input": 0.50,
}

SIGNAL_MULTIPLIERS = {
    "missing": 1.0,
    "failed": 1.0,
    "weak": 0.8,
    "improvement_needed": 0.75,
    "partial": 0.6,
    "low_confidence": 0.5,
}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", canonicalize(value)).strip("_") or "general"


VALID_CATEGORIES = frozenset(
    ["frontend", "backend", "databases", "dsa", "system_design",
     "cloud_devops", "testing", "behavioral", "cs_fundamentals",
     "marketing", "finance", "hr", "operations", "design", "general"]
)


def infer_category(skill: str, explicit_category: str | None = None) -> str:
    if explicit_category and explicit_category in VALID_CATEGORIES:
        return explicit_category
    lowered = canonicalize(skill)
    for category, keywords in CATEGORY_RULES.items():
        if any(keyword in lowered for keyword in keywords):
            return category
    return "general"


def derive_role_focus(target_role: str, jd_text: str, signals: List[SourceSignalInput]) -> str:
    combined = " ".join([target_role, jd_text] + [signal.skill for signal in signals]).lower()
    for category in ("frontend", "backend", "cloud_devops", "testing", "databases", "system_design", "marketing", "finance", "hr", "operations", "design"):
        if any(keyword in combined for keyword in CATEGORY_RULES.get(category, [])):
            return category
    return "general"


def normalize_resume_analysis_signals(resume_analysis: Dict[str, object]) -> List[SourceSignalInput]:
    signals: List[SourceSignalInput] = []
    for item in resume_analysis.get("skillRecommendations", []) or []:
        skill = item.get("skill")
        if not skill:
            continue
        action_label = item.get("actionLabel") or item.get("action_label") or ""
        if action_label == "Add now":
            continue
        signals.append(
            SourceSignalInput(
                source_type="resume_jd_gap",
                source_id="resume-analysis",
                category=infer_category(skill, item.get("category")),
                skill=skill,
                signal_type="missing" if action_label == "Build project first" else "weak",
                weight=SOURCE_WEIGHT_DEFAULTS["resume_jd_gap"],
                confidence=0.8,
                role_relevance=1.0 if item.get("priority") == "high" else 0.75,
                evidence=item.get("reason") or item.get("whyItMatters") or f"{skill} was identified as a role gap.",
                metadata={
                    "priority": item.get("priority", "medium"),
                    "action_label": action_label,
                    "where_to_appear": item.get("whereToAppear") or item.get("where_to_appear", ""),
                },
            )
        )
    return signals


def normalize_interview_feedback(feedback_items: List[Dict[str, object]]) -> List[SourceSignalInput]:
    signals: List[SourceSignalInput] = []
    for index, item in enumerate(feedback_items):
        skill = str(item.get("skill") or item.get("topic") or item.get("category") or "behavioral communication").strip()
        score = float(item.get("score", 0) or 0)
        signal_type = "failed" if score and score < 0.4 else "weak"
        confidence = 0.85 if item.get("evidence") or item.get("feedback") else 0.7
        signals.append(
            SourceSignalInput(
                source_type="interview_feedback",
                source_id=str(item.get("id") or item.get("sessionId") or f"interview-{index}"),
                category=infer_category(skill, item.get("category")),
                skill=skill,
                signal_type=signal_type,
                weight=SOURCE_WEIGHT_DEFAULTS["interview_feedback"],
                confidence=confidence,
                role_relevance=float(item.get("roleRelevance", 0.8) or 0.8),
                evidence=str(item.get("feedback") or item.get("evidence") or f"Interview feedback flagged {skill}."),
                metadata={"score": score},
            )
        )
    return signals


def normalize_quiz_results(quiz_results: List[Dict[str, object]]) -> List[SourceSignalInput]:
    signals: List[SourceSignalInput] = []
    for index, item in enumerate(quiz_results):
        skill = str(item.get("skill") or item.get("topic") or item.get("moduleTitle") or "general knowledge").strip()
        score = float(item.get("score", 0) or 0)
        signal_type = "failed" if score < 0.5 else "partial" if score < 0.7 else "low_confidence"
        signals.append(
            SourceSignalInput(
                source_type="quiz_result",
                source_id=str(item.get("id") or item.get("quizId") or f"quiz-{index}"),
                category=infer_category(skill, item.get("category")),
                skill=skill,
                signal_type=signal_type,
                weight=SOURCE_WEIGHT_DEFAULTS["quiz_result"],
                confidence=0.75,
                role_relevance=float(item.get("roleRelevance", 0.7) or 0.7),
                evidence=str(item.get("feedback") or f"Quiz score for {skill}: {int(score * 100) if score <= 1 else int(score)}"),
                metadata={"score": score},
            )
        )
    return signals


def normalize_coding_lab_results(lab_results: List[Dict[str, object]]) -> List[SourceSignalInput]:
    signals: List[SourceSignalInput] = []
    for index, item in enumerate(lab_results):
        skill = str(item.get("skill") or item.get("topic") or item.get("labTitle") or "practical implementation").strip()
        score = float(item.get("score", 0) or 0)
        signal_type = "failed" if score < 0.6 else "partial" if score < 0.75 else "low_confidence"
        signals.append(
            SourceSignalInput(
                source_type="coding_lab_result",
                source_id=str(item.get("id") or item.get("labId") or f"lab-{index}"),
                category=infer_category(skill, item.get("category")),
                skill=skill,
                signal_type=signal_type,
                weight=SOURCE_WEIGHT_DEFAULTS["coding_lab_result"],
                confidence=0.8,
                role_relevance=float(item.get("roleRelevance", 0.75) or 0.75),
                evidence=str(item.get("feedback") or f"Coding lab performance for {skill} is below target."),
                metadata={"score": score},
            )
        )
    return signals


def normalize_learning_inputs(payload: LearningPlanRequest) -> List[SourceSignalInput]:
    signals: List[SourceSignalInput] = []
    signals.extend(normalize_resume_analysis_signals(payload.resume_analysis))
    signals.extend(normalize_interview_feedback(payload.interview_feedback))
    signals.extend(normalize_quiz_results(payload.quiz_results))
    signals.extend(normalize_coding_lab_results(payload.coding_lab_results))
    signals.extend(payload.additional_signals)
    return signals


def summarize_weakness(signals: List[SourceSignalInput], skill: str, category: str) -> LearningWeakness:
    weighted_total = 0.0
    confidence_total = 0.0
    role_relevance_total = 0.0

    for signal in signals:
        multiplier = SIGNAL_MULTIPLIERS.get(signal.signal_type, 0.7)
        weighted_total += signal.weight * multiplier * signal.role_relevance
        confidence_total += signal.confidence
        role_relevance_total += signal.role_relevance

    count = max(len(signals), 1)
    confidence = min(1.0, confidence_total / count)
    role_relevance = min(1.0, role_relevance_total / count)
    score = min(1.0, weighted_total / count)

    severity = "high" if score >= 0.75 else "medium" if score >= 0.45 else "low"
    urgency = "high" if role_relevance >= 0.8 and severity != "low" else "medium" if score >= 0.35 else "low"
    evidence_preview = "; ".join(signal.evidence for signal in signals[:2] if signal.evidence)
    label = skill.title()

    return LearningWeakness(
        key=f"{category}_{slugify(skill)}",
        category=category,
        label=label,
        severity=severity,
        urgency=urgency,
        confidence=round(confidence, 2),
        role_relevance=round(role_relevance, 2),
        score=round(score, 2),
        source_signals=signals,
        missing_skills=sorted({canonicalize(signal.skill) for signal in signals}),
        explanation=evidence_preview or f"{label} needs more evidence for the target role.",
    )


def build_learning_objectives(weaknesses: List[LearningWeakness]) -> List[LearningObjectiveDTO]:
    grouped: Dict[str, List[LearningWeakness]] = defaultdict(list)
    for weakness in weaknesses:
        grouped[weakness.category].append(weakness)

    objectives: List[LearningObjectiveDTO] = []
    for category, items in grouped.items():
        items = sorted(items, key=lambda item: (item.severity == "high", item.score), reverse=True)
        top_items = items[:3]
        objectives.append(
            LearningObjectiveDTO(
                id=f"objective_{category}",
                title=f"Strengthen {category.replace('_', ' ')} fundamentals for the target role",
                category=category,
                priority="high" if any(item.severity == "high" for item in top_items) else "medium",
                linked_weakness_keys=[item.key for item in top_items],
                success_criteria=[
                    f"Demonstrate improved confidence in {item.label.lower()}" for item in top_items[:2]
                ],
            )
        )
    return objectives


def _build_default_resources(title: str, category: str) -> List[Dict[str, str]]:
    query = re.sub(r"\s+", "+", title.strip())
    docs_url = ""
    docs_label = ""

    lowered = canonicalize(title)
    if "react" in lowered:
        docs_url = "https://react.dev/learn"
        docs_label = "React official docs"
    elif "next" in lowered:
        docs_url = "https://nextjs.org/docs"
        docs_label = "Next.js docs"
    elif "node" in lowered or "express" in lowered:
        docs_url = "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs"
        docs_label = "Node.js learning docs"
    elif "mongo" in lowered:
        docs_url = "https://www.mongodb.com/docs/"
        docs_label = "MongoDB docs"
    elif "sql" in lowered or category == "databases":
        docs_url = "https://developer.mozilla.org/en-US/docs/Glossary/SQL"
        docs_label = "SQL overview"
    elif "test" in lowered or category == "testing":
        docs_url = "https://testing-library.com/docs/"
        docs_label = "Testing Library docs"
    elif "docker" in lowered:
        docs_url = "https://docs.docker.com/get-started/"
        docs_label = "Docker getting started"
    elif "system design" in lowered:
        docs_url = "https://github.com/donnemartin/system-design-primer"
        docs_label = "System Design Primer"
    elif "javascript" in lowered or "typescript" in lowered:
        docs_url = "https://developer.mozilla.org/en-US/docs/Web/JavaScript"
        docs_label = "MDN JavaScript guides"

    resources: List[Dict[str, str]] = [
        {
            "label": f"YouTube lecture: {title}",
            "url": f"https://www.youtube.com/results?search_query={query}+full+course",
            "platform": "YouTube",
            "type": "video",
        }
    ]

    if docs_url:
        resources.insert(
            0,
            {
                "label": docs_label,
                "url": docs_url,
                "platform": "Official Docs",
                "type": "docs",
            },
        )

    return resources


def build_placeholder_modules(objectives: List[LearningObjectiveDTO], weaknesses: List[LearningWeakness]) -> List[LearningModuleDTO]:
    weakness_lookup = {weakness.key: weakness for weakness in weaknesses}
    modules: List[LearningModuleDTO] = []
    for index, objective in enumerate(objectives, start=1):
        linked = [weakness_lookup[key] for key in objective.linked_weakness_keys if key in weakness_lookup]
        primary = linked[0] if linked else None
        modules.append(
            LearningModuleDTO(
                id=f"module_{slugify(objective.id)}",
                title=primary.label if primary else objective.title,
                objective=objective.title,
                why_it_matters=primary.explanation if primary else "This module addresses a key role-relevant learning gap.",
                category=objective.category,
                priority=objective.priority,
                estimated_minutes=120 if objective.priority == "high" else 90,
                prerequisites=[],
                outcomes=objective.success_criteria,
                order_index=index,
                resources=_build_default_resources(
                    primary.label if primary else objective.title,
                    objective.category,
                ),
            )
        )
    return modules


def generate_learning_plan(payload: LearningPlanRequest) -> LearningPlanResponse:
    normalized_signals = normalize_learning_inputs(payload)
    grouped_signals: Dict[tuple[str, str], List[SourceSignalInput]] = defaultdict(list)
    for signal in normalized_signals:
        category = infer_category(signal.skill, signal.category)
        grouped_signals[(category, canonicalize(signal.skill))].append(
            signal.model_copy(update={"category": category})
        )

    weaknesses = [
        summarize_weakness(signals, skill, category)
        for (category, skill), signals in grouped_signals.items()
    ]
    weaknesses.sort(key=lambda item: (item.severity == "high", item.role_relevance, item.score), reverse=True)

    objectives = build_learning_objectives(weaknesses)
    modules = build_placeholder_modules(objectives, weaknesses)
    role_focus = derive_role_focus(payload.target_role, payload.jd_text, normalized_signals)

    next_actions = []
    if modules:
        next_actions.append(f"Start {modules[0].title}")
    if weaknesses:
        next_actions.append(f"Prioritize {weaknesses[0].label} because it is the highest-severity gap.")

    return LearningPlanResponse(
        project_id=payload.project_id,
        target_role=payload.target_role,
        role_focus=role_focus,
        weaknesses=weaknesses,
        objectives=objectives,
        modules=modules,
        progress=LearningProgressDTO(
            completed_modules=0,
            total_modules=len(modules),
            readiness_score=0,
            next_best_actions=next_actions,
        ),
        normalized_signals=normalized_signals,
    )


# ── Concept-level diagnosis ───────────────────────────────────────────────────

def diagnose_quiz_concepts(payload: ConceptDiagnosisRequest) -> ConceptDiagnosisResponse:
    """
    Analyse quiz results at sub-concept level.
    Identifies exactly which concepts the user knows vs. is weak on,
    infers their skill level, and generates targeted resources for gaps.
    """
    questions = payload.questions
    answers   = payload.answers

    concepts_known: list[str] = []
    concepts_weak:  list[str] = []

    correct_count = 0
    for q, ans in zip(questions, answers):
        correct_idx = int(q.get("correctIndex", q.get("correct_index", 0)))
        concept     = (q.get("conceptTested") or q.get("concept_tested") or "").strip()
        is_correct  = (ans == correct_idx)

        if is_correct:
            correct_count += 1
            if concept and concept not in concepts_known and concept not in concepts_weak:
                concepts_known.append(concept)
        else:
            if concept and concept not in concepts_weak:
                concepts_weak.append(concept)
                # Remove from known if it appears in weak (another question revealed the gap)
                if concept in concepts_known:
                    concepts_known.remove(concept)

    total     = max(len(questions), 1)
    score_pct = round((correct_count / total) * 100)

    if score_pct >= 80:
        skill_level = "advanced"
    elif score_pct >= 50:
        skill_level = "intermediate"
    else:
        skill_level = "beginner"

    targeted_resources = _generate_targeted_resources(
        payload.skill, payload.category, payload.role, concepts_weak
    )

    summary = _build_concept_summary(payload.skill, skill_level, concepts_known, concepts_weak)

    return ConceptDiagnosisResponse(
        skill=payload.skill,
        skill_level=skill_level,
        score_pct=score_pct,
        concepts_known=concepts_known,
        concepts_weak=concepts_weak,
        targeted_resources=targeted_resources,
        summary=summary,
    )


def _generate_targeted_resources(
    skill: str,
    category: str,
    role: str,
    weak_concepts: list[str],
) -> list[TargetedResource]:
    if not weak_concepts:
        return []

    concepts_str = "\n".join(f"- {c}" for c in weak_concepts[:7])

    system_prompt = (
        "You are a technical learning expert. Generate specific, real learning resources. "
        "Use ONLY real URLs from: official documentation, MDN, React docs, Node.js docs, "
        "Python docs, YouTube (use youtube.com/results?search_query=... for search), "
        "freeCodeCamp (freecodecamp.org/news), or GitHub. "
        "If unsure of the exact URL, use a YouTube search URL. Return ONLY valid JSON."
    )

    user_prompt = f"""The user is learning "{skill}" for a {role or "target"} role (category: {category}).

They are SPECIFICALLY WEAK in these sub-concepts:
{concepts_str}

Generate ONE targeted resource per weak concept.

Return JSON:
{{
  "resources": [
    {{
      "concept": "<exact concept from the list above>",
      "label": "<descriptive resource title>",
      "url": "<real URL — use YouTube search if unsure of direct URL>",
      "platform": "YouTube|MDN|Official Docs|freeCodeCamp|GitHub|Dev.to",
      "type": "video|docs|article|course|practice",
      "why_this_helps": "<one sentence: how this resource closes this specific concept gap>"
    }}
  ]
}}"""

    try:
        raw       = request_json(system_prompt, user_prompt, max_tokens=1800)
        resources = raw.get("resources", [])
        return [
            TargetedResource(
                concept=r.get("concept", ""),
                label=r.get("label", ""),
                url=r.get("url", ""),
                platform=r.get("platform", ""),
                type=r.get("type", "article"),
                why_this_helps=r.get("why_this_helps", ""),
            )
            for r in resources
            if r.get("url") and r.get("label") and r.get("concept")
        ]
    except Exception:
        return []


def _build_concept_summary(
    skill: str,
    skill_level: str,
    concepts_known: list[str],
    concepts_weak: list[str],
) -> str:
    known = len(concepts_known)
    weak  = len(concepts_weak)
    total = known + weak
    if total == 0:
        return f"No concept data available for {skill}."
    if weak == 0:
        return f"Strong grasp of {skill} — all tested concepts answered correctly."
    if known == 0:
        return f"Foundational gaps in {skill}. Focus on core concepts before advancing to applied use."
    return (
        f"{skill_level.capitalize()} level in {skill}. "
        f"Solid on {known} concept{'s' if known != 1 else ''}, "
        f"needs targeted study on {weak} concept{'s' if weak != 1 else ''}."
    )


# ── Project recommendations ───────────────────────────────────────────────────

def recommend_projects(payload: RecommendProjectsRequest) -> RecommendProjectsResponse:
    """
    Generate concrete project ideas that directly target the user's detected weak areas.
    Each project connects to specific concepts the user failed in quizzes.
    """
    if not payload.weak_skills:
        return RecommendProjectsResponse(projects=[])

    skills_str = "\n".join(
        "- {skill} (weak concepts: {concepts})".format(
            skill=ws.get("skill", ""),
            concepts=", ".join(ws.get("conceptsWeak", ws.get("concepts_weak", []))[:4]) or "general fundamentals",
        )
        for ws in payload.weak_skills[:6]
    )

    system_prompt = (
        "You are a career mentor. Generate practical, portfolio-ready proof-of-skill ideas "
        "that directly target specific skill gaps. Ideas must be concrete and completable in 1-3 weeks. "
        "Return ONLY valid JSON."
    )

    user_prompt = f"""The user is preparing for a {payload.role or "target"} role.

Their DETECTED WEAK AREAS with specific concept gaps:
{skills_str}

Job description context: {(payload.jd_text or "")[:400] or "General professional role"}

Generate exactly 3 project ideas. Each project MUST:
1. Directly address 1-2 of the weak skills/concepts listed above
2. Be specific enough to build in 1-3 weeks
3. Mention in why_this_project EXACTLY which weak concepts it will reinforce

Return JSON:
{{
  "projects": [
    {{
      "title": "<specific project name>",
      "description": "<2-3 sentences: what to build, what problem it solves>",
      "difficulty": "beginner|intermediate|advanced",
      "estimated_hours": <realistic number 8-40>,
      "primary_skill": "<the main skill this project drills>",
      "related_skills": ["<skill1>", "<skill2>", "<skill3>"],
      "why_this_project": "<specifically how this project targets the user's detected concept gaps>",
      "steps": [
        "<concrete step 1 — what to set up>",
        "<concrete step 2 — core feature to build>",
        "<concrete step 3 — feature that exercises the weak concept>",
        "<concrete step 4 — what to add to make it portfolio-ready>"
      ],
      "weak_areas_addressed": ["<exact weak skill or concept from the list above>"]
    }}
  ]
}}"""

    try:
        raw      = request_json(system_prompt, user_prompt, max_tokens=2500)
        projects = raw.get("projects", [])
        return RecommendProjectsResponse(
            projects=[
                ProjectRecommendation(
                    title=p.get("title", ""),
                    description=p.get("description", ""),
                    difficulty=p.get("difficulty", "intermediate"),
                    estimated_hours=int(p.get("estimated_hours", 20)),
                    primary_skill=p.get("primary_skill", ""),
                    related_skills=p.get("related_skills", []),
                    why_this_project=p.get("why_this_project", ""),
                    steps=p.get("steps", []),
                    weak_areas_addressed=p.get("weak_areas_addressed", []),
                )
                for p in projects
                if p.get("title")
            ]
        )
    except Exception:
        return RecommendProjectsResponse(projects=[])
