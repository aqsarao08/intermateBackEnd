const INTERVIEW_SERVICE_URL =
  process.env.LEARNING_SERVICE_URL ||
  process.env.RESUME_ANALYZER_URL ||
  "http://localhost:8001";

export async function generateInterviewQuestions({
  role,
  companyName = "",
  jdText = "",
  resumeText = "",
  aiInsights = {},
  numQuestions = 5,
  persona = "mixed",
}) {
  const res = await fetch(`${INTERVIEW_SERVICE_URL}/interview/generate-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role,
      company_name: companyName,
      jd_text: jdText,
      resume_text: resumeText,
      ai_insights: aiInsights,
      num_questions: numQuestions,
      persona,
    }),
  });

  let data;
  try { data = await res.json(); } catch { throw new Error(`Interview service error ${res.status}`); }
  if (!res.ok) throw new Error(data.detail || data.message || "Question generation failed");

  return (data.questions || []).map((q) => ({
    question:    q.question,
    type:        q.type || "behavioral",
    targetSkill: q.target_skill || "",
  }));
}

export async function evaluateInterviewAnswer({
  question,
  questionType = "behavioral",
  answer,
  role,
  jdText = "",
  persona = "mixed",
}) {
  const res = await fetch(`${INTERVIEW_SERVICE_URL}/interview/evaluate-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      question_type: questionType,
      answer,
      role,
      jd_text: jdText,
      persona,
    }),
  });

  let data;
  try { data = await res.json(); } catch { throw new Error(`Interview service error ${res.status}`); }
  if (!res.ok) throw new Error(data.detail || data.message || "Evaluation failed");

  return {
    score:       data.score,
    dimensions:  data.dimensions,
    feedback:    data.feedback,
    strength:    data.strength,
    improvement: data.improvement,
  };
}

// Phase 2 ── Audio transcription via OpenAI Whisper ───────────────────────────

export async function transcribeAudio(audioBuffer, mimeType = "audio/webm") {
  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  form.append("file", blob, "answer.webm");

  const res = await fetch(`${INTERVIEW_SERVICE_URL}/interview/transcribe`, {
    method: "POST",
    body: form,
  });

  let data;
  try { data = await res.json(); } catch { throw new Error(`Transcription service error ${res.status}`); }
  if (!res.ok) throw new Error(data.detail || data.message || "Transcription failed");
  return {
    transcript: data.transcript || "",
    deliveryObservations: data.delivery_observations || data.deliveryObservations || {},
  };
}

// Phase 3 ── Adaptive follow-up generation ────────────────────────────────────

export async function generateFollowupQuestion({
  question,
  answer,
  score,
  weakDimension,
  role,
  jdText = "",
}) {
  const res = await fetch(`${INTERVIEW_SERVICE_URL}/interview/generate-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      answer,
      score,
      weak_dimension: weakDimension,
      role,
      jd_text: jdText,
    }),
  });

  let data;
  try { data = await res.json(); } catch { throw new Error(`Follow-up service error ${res.status}`); }
  if (!res.ok) throw new Error(data.detail || data.message || "Follow-up generation failed");

  return {
    question:    data.question,
    type:        data.type || "behavioral",
    targetSkill: data.target_skill || "",
    isFollowup:  true,
  };
}
