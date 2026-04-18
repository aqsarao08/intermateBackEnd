from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.services.llm_client import request_json

router = APIRouter(prefix="/interview", tags=["interview"])

# ── Models ────────────────────────────────────────────────────────────────────

class GenerateQuestionsRequest(BaseModel):
    role: str
    company_name: Optional[str] = ""
    jd_text: Optional[str] = ""
    resume_text: Optional[str] = ""
    ai_insights: Optional[dict] = {}
    num_questions: int = Field(default=5, ge=3, le=8)
    persona: str = "mixed"


class InterviewQuestion(BaseModel):
    question: str
    type: str
    target_skill: str


class GenerateQuestionsResponse(BaseModel):
    questions: List[InterviewQuestion]


class DimensionScores(BaseModel):
    relevance: int
    structure: int
    depth: int
    communication: int


class EvaluateAnswerRequest(BaseModel):
    question: str
    question_type: str = "behavioral"
    answer: str
    role: str
    jd_text: Optional[str] = ""
    persona: str = "mixed"


class EvaluateAnswerResponse(BaseModel):
    score: int
    dimensions: DimensionScores
    feedback: str
    strength: str
    improvement: str


# ── Internal pydantic wrappers for llm_client ─────────────────────────────────

class _QuestionsOutput(BaseModel):
    questions: List[InterviewQuestion]


class _EvalOutput(BaseModel):
    score: int
    dimensions: DimensionScores
    feedback: str
    strength: str
    improvement: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

_PERSONA_SYSTEM = {
    "friendly":   "Use a warm, encouraging tone. Mix easier relationship-building questions with technical ones. Be supportive.",
    "strict":     "Be demanding and direct. Push for specific details. Ask challenging follow-ups that expose vague thinking.",
    "technical":  "Focus heavily on technical implementation, architecture, algorithms, and code-level decisions. At least 3 of the questions must be deeply technical.",
    "behavioral": "Focus exclusively on behavioral questions using the STAR method (Situation, Task, Action, Result). Every question must ask for a specific past experience.",
    "mixed":      "Balance behavioral, technical, situational, and motivational question types evenly.",
}


@router.post("/generate-questions", response_model=GenerateQuestionsResponse)
def generate_questions(payload: GenerateQuestionsRequest) -> GenerateQuestionsResponse:
    jd_snippet     = (payload.jd_text or "")[:1200]
    resume_snippet = (payload.resume_text or "")[:800]
    insights       = payload.ai_insights or {}

    required_skills = insights.get("jdRequiredSkills", insights.get("jd_required_skills", []))
    skills_str = ", ".join(required_skills[:8]) if required_skills else "general software engineering skills"

    persona_guidance = _PERSONA_SYSTEM.get(payload.persona, _PERSONA_SYSTEM["mixed"])

    system_prompt = (
        "You are an expert technical interviewer. Generate realistic, specific interview questions "
        "grounded in the provided job description and candidate resume. "
        "Return ONLY valid JSON matching the schema. No extra text."
        f" Persona style: {persona_guidance}"
    )

    user_prompt = f"""Generate exactly {payload.num_questions} interview questions for a {payload.role} position at {payload.company_name or "this company"}.

Job Description (excerpt):
{jd_snippet or "Not provided"}

Candidate Resume (excerpt):
{resume_snippet or "Not provided"}

Key required skills: {skills_str}

Mix question types: behavioral (how you handled X), technical (explain/code X), situational (what would you do if...), motivational (why this role/company).
Ground questions in the actual JD and resume — reference specific skills, experiences, or requirements where possible.

Return JSON:
{{
  "questions": [
    {{
      "question": "<specific question text>",
      "type": "<behavioral|technical|situational|motivational>",
      "target_skill": "<the primary skill or trait this question assesses>"
    }}
  ]
}}"""

    try:
        raw = request_json(system_prompt, user_prompt, max_tokens=1200, response_model=_QuestionsOutput)
        questions_data = raw.get("questions", [])
    except Exception:
        questions_data = []

    questions: List[InterviewQuestion] = []
    for q in questions_data:
        if isinstance(q, dict):
            questions.append(InterviewQuestion(
                question=q.get("question", ""),
                type=q.get("type", "behavioral"),
                target_skill=q.get("target_skill", ""),
            ))
        elif isinstance(q, InterviewQuestion):
            questions.append(q)

    if not questions:
        questions = _fallback_questions(payload.role, payload.num_questions)

    return GenerateQuestionsResponse(questions=questions[: payload.num_questions])


_PERSONA_EVAL = {
    "friendly":   "Be encouraging in feedback. Score generously — reward effort and partial answers. Tone should be warm.",
    "strict":     "Be demanding. Penalize vague or unstructured answers heavily. Score conservatively. Expect depth.",
    "technical":  "Penalize heavily for lack of technical depth or incorrect technical details. Reward precise technical explanations.",
    "behavioral": "Penalize heavily if no specific example is given. Reward STAR-format answers generously.",
    "mixed":      "Score objectively and fairly based on relevance, structure, depth, and communication.",
}


@router.post("/evaluate-answer", response_model=EvaluateAnswerResponse)
def evaluate_answer(payload: EvaluateAnswerRequest) -> EvaluateAnswerResponse:
    system_prompt = (
        "You are an expert interview evaluator. Score the candidate's answer objectively and fairly. "
        "Return ONLY valid JSON matching the schema. No extra text."
    )

    user_prompt = f"""Evaluate this interview answer for a {payload.role} position.

Question ({payload.question_type}): {payload.question}

Candidate's Answer: {payload.answer or "(no answer provided)"}

Job context: {(payload.jd_text or "")[:600] or "Not provided"}

Score each dimension 0-10:
- relevance: Does the answer directly address what was asked?
- structure: Is it well-organized (STAR method or logical flow)?
- depth: Technical depth, specifics, concrete examples?
- communication: Clarity, conciseness, professional tone?

Overall score = weighted average (relevance 30%, structure 25%, depth 25%, communication 20%), rounded to nearest integer.

Return JSON:
{{
  "score": <0-10 integer>,
  "dimensions": {{
    "relevance": <0-10>,
    "structure": <0-10>,
    "depth": <0-10>,
    "communication": <0-10>
  }},
  "feedback": "<2-3 sentences of specific, actionable feedback>",
  "strength": "<1 sentence: what they did best>",
  "improvement": "<1 sentence: the single most important thing to improve>"
}}

Evaluator persona: {_PERSONA_EVAL.get(payload.persona, _PERSONA_EVAL['mixed'])}"""

    try:
        raw = request_json(system_prompt, user_prompt, max_tokens=500, response_model=_EvalOutput)
        if isinstance(raw, dict):
            dims = raw.get("dimensions", {})
            return EvaluateAnswerResponse(
                score=min(10, max(0, int(raw.get("score", 5)))),
                dimensions=DimensionScores(
                    relevance=min(10, max(0, int(dims.get("relevance", 5)))),
                    structure=min(10, max(0, int(dims.get("structure", 5)))),
                    depth=min(10, max(0, int(dims.get("depth", 5)))),
                    communication=min(10, max(0, int(dims.get("communication", 5)))),
                ),
                feedback=raw.get("feedback", ""),
                strength=raw.get("strength", ""),
                improvement=raw.get("improvement", ""),
            )
    except Exception:
        pass

    return _fallback_evaluation(payload.answer)


# ── Phase 2: Transcription ────────────────────────────────────────────────────

class TranscribeResponse(BaseModel):
    transcript: str


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(file: UploadFile = File(...)) -> TranscribeResponse:
    settings = get_settings()
    if not settings.openai_api_key:
        return TranscribeResponse(transcript="")
    try:
        import openai
        client = openai.OpenAI(api_key=settings.openai_api_key)
        content = await file.read()
        audio_io = BytesIO(content)
        audio_io.name = file.filename or "answer.webm"
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_io,
            response_format="text",
        )
        return TranscribeResponse(transcript=str(result).strip())
    except Exception:
        return TranscribeResponse(transcript="")


# ── Phase 3: Adaptive follow-up ───────────────────────────────────────────────

class GenerateFollowupRequest(BaseModel):
    question: str
    answer: str
    score: int
    weak_dimension: str
    role: str
    jd_text: Optional[str] = ""


class GenerateFollowupResponse(BaseModel):
    question: str
    type: str
    target_skill: str


class _FollowupOutput(BaseModel):
    question: str
    type: str
    target_skill: str


_DIM_GUIDANCE = {
    "relevance":     "The answer didn't directly address the question. Probe what the candidate actually did.",
    "structure":     "The answer lacked structure. Ask them to walk through it step by step (STAR format).",
    "depth":         "The answer was too superficial. Ask a deeper technical or detail-oriented follow-up.",
    "communication": "The answer was unclear. Ask them to clarify or summarize the key point.",
}


@router.post("/generate-followup", response_model=GenerateFollowupResponse)
def generate_followup(payload: GenerateFollowupRequest) -> GenerateFollowupResponse:
    guidance = _DIM_GUIDANCE.get(payload.weak_dimension, "The answer needed improvement. Ask a targeted follow-up.")

    system_prompt = (
        "You are an expert interviewer. Generate ONE concise follow-up question targeting a specific weakness. "
        "Return ONLY valid JSON. No extra text."
    )
    user_prompt = f"""A candidate for a {payload.role} role gave a weak answer (score: {payload.score}/10).

Original question: {payload.question}
Their answer: {payload.answer[:400]}

Weakness — {payload.weak_dimension}: {guidance}

Return JSON:
{{
  "question": "<targeted follow-up question>",
  "type": "<behavioral|technical|situational>",
  "target_skill": "<what this question specifically tests>"
}}"""

    try:
        raw = request_json(system_prompt, user_prompt, max_tokens=250, response_model=_FollowupOutput)
        if isinstance(raw, dict) and raw.get("question"):
            return GenerateFollowupResponse(
                question=raw["question"],
                type=raw.get("type", "behavioral"),
                target_skill=raw.get("target_skill", ""),
            )
    except Exception:
        pass

    fallback = {
        "relevance":     "Can you give me a specific example that directly answers the original question?",
        "structure":     "Can you walk me through that again using Situation → Task → Action → Result?",
        "depth":         f"Can you go deeper on the technical aspects of your answer for the {payload.role} context?",
        "communication": "Could you clarify and summarize the key point of your answer in 2-3 sentences?",
    }
    return GenerateFollowupResponse(
        question=fallback.get(payload.weak_dimension, "Can you elaborate with a specific example?"),
        type="behavioral",
        target_skill=payload.weak_dimension,
    )


# ── Fallbacks ─────────────────────────────────────────────────────────────────

def _fallback_questions(role: str, n: int) -> List[InterviewQuestion]:
    base = [
        InterviewQuestion(question=f"Tell me about yourself and why you are a strong fit for the {role} role.", type="motivational", target_skill="self-awareness"),
        InterviewQuestion(question="Describe a challenging technical problem you solved. What was your approach?", type="behavioral", target_skill="problem-solving"),
        InterviewQuestion(question="How do you handle tight deadlines with competing priorities?", type="situational", target_skill="time management"),
        InterviewQuestion(question="Walk me through your most significant project and the technologies you used.", type="technical", target_skill="technical depth"),
        InterviewQuestion(question="Tell me about a time you disagreed with a team member. How did you resolve it?", type="behavioral", target_skill="collaboration"),
        InterviewQuestion(question="Where do you see yourself in 3 years and how does this role fit that path?", type="motivational", target_skill="career vision"),
        InterviewQuestion(question="Describe a situation where you had to learn a new technology quickly. How did you approach it?", type="situational", target_skill="adaptability"),
        InterviewQuestion(question="What is your approach to writing clean, maintainable code?", type="technical", target_skill="code quality"),
    ]
    return base[:n]


def _fallback_evaluation(answer: str) -> EvaluateAnswerResponse:
    has_content = bool(answer and len(answer.strip()) > 30)
    score = 5 if has_content else 2
    return EvaluateAnswerResponse(
        score=score,
        dimensions=DimensionScores(relevance=score, structure=score, depth=score, communication=score),
        feedback="Keep your answers specific and structured using the STAR method (Situation, Task, Action, Result). Add concrete examples with measurable outcomes.",
        strength="You provided a response to the question.",
        improvement="Add concrete examples with measurable outcomes to strengthen your answer.",
    )
