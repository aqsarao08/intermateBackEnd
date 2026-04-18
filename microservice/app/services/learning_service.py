import re
from collections import defaultdict
from typing import Dict, List

from app.models.schemas import (
    LearningObjectiveDTO,
    LearningPlanRequest,
    LearningPlanResponse,
    LearningProgressDTO,
    LearningWeakness,
    SourceSignalInput,
    LearningModuleDTO,
)
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
     "cloud_devops", "testing", "behavioral", "cs_fundamentals", "general"]
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
    for category in ("frontend", "backend", "cloud_devops", "testing", "databases", "system_design"):
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
                resources=[],
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
