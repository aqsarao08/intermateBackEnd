from typing import Dict, List, Literal, Optional

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
