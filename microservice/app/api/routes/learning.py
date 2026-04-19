from fastapi import APIRouter

from app.models.schemas import (
    ConceptDiagnosisRequest,
    ConceptDiagnosisResponse,
    LearningPlanRequest,
    LearningPlanResponse,
    QuizGenerateRequest,
    QuizGenerateResponse,
    RecommendProjectsRequest,
    RecommendProjectsResponse,
)
from app.services.learning_service import (
    diagnose_quiz_concepts,
    generate_learning_plan,
    normalize_learning_inputs,
    recommend_projects,
)
from app.services.quiz_service import generate_quiz

router = APIRouter(prefix="/learning", tags=["learning"])


@router.post("/diagnose", response_model=LearningPlanResponse)
def diagnose_learning_needs(payload: LearningPlanRequest) -> LearningPlanResponse:
    return generate_learning_plan(payload)


@router.post("/normalize-signals")
def normalize_signals(payload: LearningPlanRequest):
    return {
        "project_id": payload.project_id,
        "target_role": payload.target_role,
        "normalized_signals": [signal.model_dump() for signal in normalize_learning_inputs(payload)],
    }


@router.post("/generate-quiz", response_model=QuizGenerateResponse)
def generate_quiz_endpoint(payload: QuizGenerateRequest) -> QuizGenerateResponse:
    return generate_quiz(payload)


@router.post("/diagnose-concepts", response_model=ConceptDiagnosisResponse)
def diagnose_concepts_endpoint(payload: ConceptDiagnosisRequest) -> ConceptDiagnosisResponse:
    """
    Post-quiz concept analysis: identifies which sub-concepts the user knows vs. is weak on,
    infers skill level, and returns targeted resources for each gap.
    """
    return diagnose_quiz_concepts(payload)


@router.post("/recommend-projects", response_model=RecommendProjectsResponse)
def recommend_projects_endpoint(payload: RecommendProjectsRequest) -> RecommendProjectsResponse:
    """
    Generate project ideas that directly target the user's detected weak concepts.
    """
    return recommend_projects(payload)
