from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


PriorityLevel = Literal["high", "medium", "low"]
ActionLabel = Literal["Add now", "Learn first", "Build project first"]
MatchLevel = Literal["strong", "moderate", "weak"]


class ScoreBreakdown(BaseModel):
    keyword_match: int = 0
    hard_requirement_coverage: int = 0
    semantic_similarity: int = 0
    experience_alignment: int = 0
    project_relevance: int = 0
    formatting_section_quality: int = 0


class SectionScore(BaseModel):
    section: str
    score: int
    status: Literal["excellent", "good", "needs_improvement", "poor", "missing"]
    feedback: str


class SkillRecommendation(BaseModel):
    skill: str
    category: str
    priority: PriorityLevel
    reason: str
    action_label: ActionLabel
    why_it_matters: str
    where_to_appear: str
    evidence: List[str] = Field(default_factory=list)
    can_add_now: bool = False


class ResumeActionItem(BaseModel):
    priority: PriorityLevel
    action: str
    rationale: str


class ProjectSuggestion(BaseModel):
    title: str
    why_it_helps: str
    description: str
    skills_covered: List[str] = Field(default_factory=list)
    role_fit: str
    resume_value: str
    difficulty: Literal["beginner", "intermediate", "advanced"] = "intermediate"


class BulletRewrite(BaseModel):
    original_bullet: str
    rewritten_bullet: str
    reason: str


class ImprovementSuggestion(BaseModel):
    section: str
    priority: PriorityLevel
    text: str


class LLMGenerationPayload(BaseModel):
    bullet_rewrites: List[BulletRewrite] = Field(default_factory=list)
    optimized_summary: str = ""
    structure_suggestions: List[str] = Field(default_factory=list)
    improvement_suggestions: List[ImprovementSuggestion] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    ats_suggestions: List[str] = Field(default_factory=list)


class AnalysisMeta(BaseModel):
    parser_used: str
    jd_parser_used: str
    embedding_model: str
    llm_provider: str
    llm_used: bool
    version: str = "resume-analyzer-v2"


class AnalyzeResponse(BaseModel):
    resume_text: str
    jd_text: str
    ats_score: int
    match_level: MatchLevel
    score_breakdown: ScoreBreakdown
    matched_keywords: List[str] = Field(default_factory=list)
    missing_keywords: List[str] = Field(default_factory=list)
    hard_requirements_matched: List[str] = Field(default_factory=list)
    hard_requirements_missing: List[str] = Field(default_factory=list)
    preferred_requirements_missing: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    ats_suggestions: List[str] = Field(default_factory=list)
    missing_skill_groups: Dict[str, List[str]] = Field(default_factory=dict)
    skill_recommendations: List[SkillRecommendation] = Field(default_factory=list)
    learning_priority: Dict[str, PriorityLevel] = Field(default_factory=dict)
    resume_action_plan: List[ResumeActionItem] = Field(default_factory=list)
    project_suggestions: List[ProjectSuggestion] = Field(default_factory=list)
    bullet_rewrites: List[BulletRewrite] = Field(default_factory=list)
    optimized_summary: str = ""
    structure_suggestions: List[str] = Field(default_factory=list)
    section_scores: List[SectionScore] = Field(default_factory=list)
    improvement_suggestions: List[ImprovementSuggestion] = Field(default_factory=list)
    analysis_meta: AnalysisMeta
    raw_extractions: Optional[Dict[str, List[str]]] = None


class AnalyzeTextRequest(BaseModel):
    resume_text: str
    jd_text: str


SeverityLevel = Literal["high", "medium", "low"]
UrgencyLevel = Literal["high", "medium", "low"]
LearningStatus = Literal["not_started", "in_progress", "completed", "needs_review"]
WeaknessCategory = Literal[
    "frontend",
    "backend",
    "databases",
    "dsa",
    "system_design",
    "cloud_devops",
    "testing",
    "behavioral",
    "cs_fundamentals",
    "general",
]
SignalSourceType = Literal[
    "resume_jd_gap",
    "resume_analysis",
    "interview_feedback",
    "quiz_result",
    "coding_lab_result",
    "manual_input",
]
SignalType = Literal["missing", "weak", "failed", "partial", "low_confidence", "improvement_needed"]


class SourceSignalInput(BaseModel):
    source_type: SignalSourceType
    source_id: str = ""
    category: Optional[WeaknessCategory] = None
    skill: str
    signal_type: SignalType
    weight: float = 0.5
    confidence: float = 0.7
    role_relevance: float = 0.7
    evidence: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LearningWeakness(BaseModel):
    key: str
    category: WeaknessCategory
    label: str
    severity: SeverityLevel
    urgency: UrgencyLevel
    confidence: float
    role_relevance: float
    score: float
    source_signals: List[SourceSignalInput] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    explanation: str = ""


class LearningObjectiveDTO(BaseModel):
    id: str
    title: str
    category: WeaknessCategory
    priority: PriorityLevel
    linked_weakness_keys: List[str] = Field(default_factory=list)
    success_criteria: List[str] = Field(default_factory=list)


class LearningModuleDTO(BaseModel):
    id: str
    title: str
    objective: str
    why_it_matters: str
    category: WeaknessCategory
    priority: PriorityLevel
    estimated_minutes: int
    prerequisites: List[str] = Field(default_factory=list)
    outcomes: List[str] = Field(default_factory=list)
    status: LearningStatus = "not_started"
    order_index: int = 0
    resources: List[Dict[str, str]] = Field(default_factory=list)


class LearningProgressDTO(BaseModel):
    completed_modules: int = 0
    total_modules: int = 0
    readiness_score: int = 0
    next_best_actions: List[str] = Field(default_factory=list)


class LearningPlanRequest(BaseModel):
    project_id: str
    target_role: str = ""
    jd_text: str = ""
    resume_analysis: Dict[str, Any] = Field(default_factory=dict)
    interview_feedback: List[Dict[str, Any]] = Field(default_factory=list)
    quiz_results: List[Dict[str, Any]] = Field(default_factory=list)
    coding_lab_results: List[Dict[str, Any]] = Field(default_factory=list)
    additional_signals: List[SourceSignalInput] = Field(default_factory=list)


class LearningPlanResponse(BaseModel):
    project_id: str
    target_role: str
    role_focus: WeaknessCategory | Literal["general"] = "general"
    weaknesses: List[LearningWeakness] = Field(default_factory=list)
    objectives: List[LearningObjectiveDTO] = Field(default_factory=list)
    modules: List[LearningModuleDTO] = Field(default_factory=list)
    progress: LearningProgressDTO = Field(default_factory=LearningProgressDTO)
    normalized_signals: List[SourceSignalInput] = Field(default_factory=list)
