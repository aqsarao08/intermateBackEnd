import uuid
from typing import List

from pydantic import BaseModel

from app.models.schemas import QuizGenerateRequest, QuizGenerateResponse, QuizQuestion
from app.services.llm_client import request_json


class _QuizOutput(BaseModel):
    questions: List[QuizQuestion]


DIFFICULTY_MAP = {"high": "hard", "medium": "medium", "low": "easy"}


def generate_quiz(payload: QuizGenerateRequest) -> QuizGenerateResponse:
    difficulty = DIFFICULTY_MAP.get(payload.severity, "medium")
    num = max(3, min(payload.num_questions, 10))

    system_prompt = (
        "You are an expert technical interviewer generating multiple-choice quiz questions. "
        "Return ONLY valid JSON matching the schema provided. "
        "Each question must have exactly 4 options. correct_index is 0-based."
    )

    user_prompt = f"""Generate {num} multiple-choice quiz questions to test knowledge of "{payload.skill}".
Context:
- Category: {payload.category}
- Target role: {payload.target_role or "software engineer"}
- Difficulty: {difficulty}

Return JSON with this exact structure:
{{
  "questions": [
    {{
      "id": "<uuid string>",
      "question": "<question text>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct_index": <0-3>,
      "explanation": "<why the correct answer is correct>",
      "difficulty": "{difficulty}"
    }}
  ]
}}"""

    try:
        raw = request_json(system_prompt, user_prompt, max_tokens=2000, response_model=_QuizOutput)
        questions_data = raw.get("questions", [])
    except Exception:
        questions_data = []

    questions: List[QuizQuestion] = []
    for i, q in enumerate(questions_data):
        qid = q.get("id") or str(uuid.uuid4())
        opts = q.get("options", [])
        if len(opts) < 2:
            continue
        correct = int(q.get("correct_index", 0))
        if not (0 <= correct < len(opts)):
            correct = 0
        questions.append(QuizQuestion(
            id=qid,
            question=q.get("question", f"Question {i + 1}"),
            options=opts,
            correct_index=correct,
            explanation=q.get("explanation", ""),
            difficulty=q.get("difficulty", difficulty),
        ))

    if not questions:
        questions = _fallback_questions(payload.skill, difficulty)

    return QuizGenerateResponse(module_id=payload.module_id, questions=questions)


def _fallback_questions(skill: str, difficulty: str) -> List[QuizQuestion]:
    return [
        QuizQuestion(
            id=str(uuid.uuid4()),
            question=f"Which of the following best describes a core concept of {skill}?",
            options=[
                f"It is a fundamental principle in {skill}",
                "It is unrelated to software engineering",
                "It applies only to database management",
                "It was deprecated in modern systems",
            ],
            correct_index=0,
            explanation=f"Option A correctly identifies a core concept of {skill}.",
            difficulty=difficulty,
        )
    ]
