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

    easy_count  = max(1, num // 3)
    hard_count  = max(1, num // 4)
    medium_count = num - easy_count - hard_count

    system_prompt = (
        "You are an expert technical interviewer creating diagnostic quiz questions. "
        "Your goal is to precisely identify WHICH sub-concepts a candidate knows vs. doesn't know. "
        "Return ONLY valid JSON matching the schema. Each question must have exactly 4 options. correct_index is 0-based."
    )

    user_prompt = f"""Generate {num} multiple-choice quiz questions to PRECISELY diagnose knowledge of "{payload.skill}".

Context:
- Category: {payload.category}
- Target role: {payload.target_role or "target role"}
- Mix: {easy_count} easy (foundational), {medium_count} medium (applied), {hard_count} hard (advanced/edge cases)

CRITICAL RULES:
1. Each question MUST target a SPECIFIC, DISTINCT sub-concept of "{payload.skill}"
   Good examples for "React": "useState Hook", "useEffect Dependencies", "Props vs State", "Virtual DOM", "React Context"
   Good examples for "SQL": "INNER vs OUTER JOIN", "GROUP BY + HAVING", "Subquery vs JOIN", "Index Usage", "ACID Transactions"
   Good examples for "Node.js": "Event Loop", "Async/Await vs Promises", "Middleware Pattern", "Stream API", "Error Handling"
2. NO two questions test the same concept
3. concept_tested must be SHORT and SPECIFIC (2-5 words) — it is displayed to the user as their diagnosis label
4. A wrong answer must reveal EXACTLY which concept needs work — make distractors plausible but clearly wrong to someone who knows the concept
5. explanation must teach the concept, not just confirm the answer

Return JSON:
{{
  "questions": [
    {{
      "id": "<uuid string>",
      "question": "<scenario-based or definition question>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct_index": <0-3>,
      "explanation": "<why correct answer is right; what the concept actually means>",
      "difficulty": "easy|medium|hard",
      "concept_tested": "<specific sub-concept, 2-5 words>"
    }}
  ]
}}"""

    try:
        raw = request_json(system_prompt, user_prompt, max_tokens=2500, response_model=_QuizOutput)
        questions_data = raw.get("questions", [])
    except Exception:
        questions_data = []

    questions: List[QuizQuestion] = []
    seen_concepts: set = set()

    for i, q in enumerate(questions_data):
        qid     = q.get("id") or str(uuid.uuid4())
        opts    = q.get("options", [])
        concept = (q.get("concept_tested") or "").strip()

        if len(opts) < 2:
            continue
        # Deduplicate concepts so every question tests something distinct
        if concept and concept.lower() in seen_concepts:
            concept = f"{concept} (variant)"
        if concept:
            seen_concepts.add(concept.lower())

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
            concept_tested=concept,
        ))

    if not questions:
        questions = _fallback_questions(payload.skill, difficulty)

    return QuizGenerateResponse(module_id=payload.module_id, questions=questions[:num])


def _fallback_questions(skill: str, difficulty: str) -> List[QuizQuestion]:
    return [
        QuizQuestion(
            id=str(uuid.uuid4()),
            question=f"Which best describes a core principle of {skill}?",
            options=[
                f"It is a foundational concept in {skill} that enables structured problem-solving",
                "It is unrelated to this professional domain",
                "It applies only in outdated niche workflows",
                "It is no longer relevant in current practice",
            ],
            correct_index=0,
            explanation=f"Option A correctly identifies the foundational role of this concept within {skill}.",
            difficulty=difficulty,
            concept_tested="Core Principles",
        )
    ]
