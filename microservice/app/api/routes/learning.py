from fastapi import APIRouter

from app.models.schemas import LearningPlanRequest, LearningPlanResponse
from app.services.learning_service import generate_learning_plan, normalize_learning_inputs

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
