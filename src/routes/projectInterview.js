import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import InterviewSession from "../models/InterviewSession.js";
import Project from "../models/Project.js";
import { awardXP } from "../services/gamification.js";
import {
  generateInterviewQuestions,
  evaluateInterviewAnswer,
  transcribeAudio,
  generateFollowupQuestion,
} from "../utils/interviewServiceClient.js";

const router = express.Router();

const MAX_FOLLOWUPS = 2;

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// ── Fallback questions when microservice is unavailable ───────────────────────
function fallbackQuestions(role, companyName, skills) {
  return [
    { question: `Tell me about yourself and why you are a fit for the ${role} role.`,           type: "motivational", targetSkill: "self-awareness" },
    { question: `Why do you want to work at ${companyName || "this company"}?`,                 type: "motivational", targetSkill: "company fit" },
    { question: `How have you used ${skills[0] || "your technical skills"} in a real project?`, type: "technical",    targetSkill: skills[0] || "technical depth" },
    { question: "Describe a challenge you solved that is relevant to this role.",               type: "behavioral",   targetSkill: "problem-solving" },
    { question: "What makes your resume a strong match for this job?",                          type: "situational",  targetSkill: "self-assessment" },
  ];
}

// ── Weakest dimension from evaluation ────────────────────────────────────────
function weakestDimension(dims = {}) {
  return Object.entries(dims).sort((a, b) => a[1] - b[1])[0]?.[0] || "depth";
}

// ── Build final report from completed questions ───────────────────────────────
function buildReport(questions, overallScore) {
  const strengths    = questions.map((q) => q.strength).filter(Boolean);
  const improvements = questions.map((q) => q.improvement).filter(Boolean);

  let recommendation;
  if (overallScore >= 8)      recommendation = "Excellent performance! Focus on polishing delivery and researching the company.";
  else if (overallScore >= 6) recommendation = "Good performance. Practice STAR-format answers and add measurable results.";
  else if (overallScore >= 4) recommendation = "Fair performance. Focus on answer depth and relevance — practice each question type aloud.";
  else                        recommendation = "Needs improvement. Review fundamentals, practice each question type, and retry the interview.";

  return {
    strengths,
    improvements,
    suggestedResources: [
      "Practice the STAR method (Situation, Task, Action, Result) for behavioral questions",
      "Research the company's products, culture, and recent news",
      "Prepare 3-5 specific examples from past projects with measurable outcomes",
    ],
    recommendation,
  };
}

// ── POST /api/projects/:id/interview/start ────────────────────────────────────
router.post("/:id/interview/start", requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id, userId: req.user.userId, status: "active",
    });

    if (!project) return res.status(404).json({ message: "Project not found" });

    const role        = project.jobRole      || "this role";
    const companyName = project.companyName  || "";
    const skills      = project.aiInsights?.jdRequiredSkills || [];
    const persona     = req.body.persona || "mixed";

    let questions;
    try {
      questions = await generateInterviewQuestions({
        role, companyName,
        jdText:      project.jobDescription || "",
        resumeText:  project.resumeText     || "",
        aiInsights:  project.aiInsights     || {},
        numQuestions: 5,
        persona,
      });
    } catch (err) {
      console.warn("Question generation failed, using fallback:", err.message);
      questions = fallbackQuestions(role, companyName, skills);
    }

    const session = await InterviewSession.create({
      user:      req.user.userId,
      projectId: project._id,
      role,
      title: `${project.title} Interview`,
      persona,
      questions: questions.map((q, i) => ({
        question:    q.question,
        type:        q.type        || "behavioral",
        targetSkill: q.targetSkill || "",
        isFollowup:  false,
        orderIndex:  i,
      })),
    });

    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/projects/:id/interview/history ───────────────────────────────────
router.get("/:id/interview/history", requireAuth, async (req, res) => {
  try {
    const sessions = await InterviewSession.find({
      user: req.user.userId, projectId: req.params.id,
    }).sort({ createdAt: -1 }).lean();

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/projects/:id/interview/:sessionId/transcribe (Phase 2) ─────────
router.post("/:id/interview/:sessionId/transcribe", requireAuth, audioUpload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No audio file provided" });

    const session = await InterviewSession.findOne({
      _id: req.params.sessionId, user: req.user.userId, projectId: req.params.id,
    }).lean();
    if (!session) return res.status(404).json({ message: "Session not found" });

    let transcript = "";
    try {
      transcript = await transcribeAudio(req.file.buffer, req.file.mimetype || "audio/webm");
    } catch (err) {
      console.warn("Transcription failed:", err.message);
    }

    res.json({ transcript });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/projects/:id/interview/:sessionId/answer ──────────────────────
router.patch("/:id/interview/:sessionId/answer", requireAuth, async (req, res) => {
  try {
    const { index, answer } = req.body;

    const [session, project] = await Promise.all([
      InterviewSession.findOne({
        _id: req.params.sessionId, user: req.user.userId, projectId: req.params.id,
      }),
      Project.findOne({ _id: req.params.id, userId: req.user.userId })
        .select("jobRole jobDescription").lean(),
    ]);

    if (!session) return res.status(404).json({ message: "Session not found" });
    if (!session.questions[index]) return res.status(400).json({ message: "Invalid question index" });

    const q = session.questions[index];

    // ── Evaluate answer with AI ──
    let evaluation;
    try {
      evaluation = await evaluateInterviewAnswer({
        question:     q.question,
        questionType: q.type || "behavioral",
        answer:       answer || "",
        role:         session.role || project?.jobRole || "software engineer",
        jdText:       project?.jobDescription || "",
        persona:      session.persona || "mixed",
      });
    } catch (err) {
      console.warn("Evaluation failed, using fallback:", err.message);
      evaluation = {
        score: 5,
        dimensions: { relevance: 5, structure: 5, depth: 5, communication: 5 },
        feedback:    "Keep your answers specific and structured using the STAR method.",
        strength:    "You provided a response to the question.",
        improvement: "Add concrete examples with measurable outcomes.",
      };
    }

    q.userAnswer  = answer || "";
    q.aiFeedback  = evaluation.feedback;
    q.strength    = evaluation.strength;
    q.improvement = evaluation.improvement;
    q.score       = evaluation.score;
    q.dimensions  = evaluation.dimensions;

    // ── Phase 3: adaptive follow-up ──
    let followupAdded = false;
    const canAddFollowup =
      evaluation.score < 6 &&
      !q.isFollowup &&
      session.followupCount < MAX_FOLLOWUPS;

    if (canAddFollowup) {
      try {
        const weakDim  = weakestDimension(evaluation.dimensions);
        const followup = await generateFollowupQuestion({
          question:     q.question,
          answer:       answer || "",
          score:        evaluation.score,
          weakDimension: weakDim,
          role:         session.role || project?.jobRole || "software engineer",
          jdText:       project?.jobDescription || "",
        });

        // Insert follow-up immediately after the current question
        session.questions.splice(index + 1, 0, {
          question:    followup.question,
          type:        followup.type || "behavioral",
          targetSkill: followup.targetSkill || "",
          isFollowup:  true,
          orderIndex:  index + 1,
          score:       0,
          dimensions:  { relevance: 0, structure: 0, depth: 0, communication: 0 },
        });

        // Re-index everything after insertion
        for (let i = index + 2; i < session.questions.length; i++) {
          session.questions[i].orderIndex = i;
        }

        session.followupCount = (session.followupCount || 0) + 1;
        followupAdded = true;
      } catch (err) {
        console.warn("Follow-up generation failed:", err.message);
      }
    }

    // ── Completion: determined server-side (after possible follow-up insertion) ──
    const isLastQuestion = index >= session.questions.length - 1;
    if (isLastQuestion) {
      session.completedAt = new Date();
      const answered = session.questions.filter((x) => x.score > 0);
      session.overallScore = answered.length
        ? Math.round(answered.reduce((s, x) => s + x.score, 0) / answered.length)
        : 0;
      session.report = buildReport(session.questions, session.overallScore);
    }

    await session.save();

    if (isLastQuestion) {
      const newScore = session.overallScore;
      const prev = await InterviewSession.findOne({
        user: req.user.userId, projectId: req.params.id,
        completedAt: { $ne: null }, _id: { $ne: session._id },
      }).sort({ completedAt: -1 }).select("overallScore").lean();

      awardXP(req.user.userId, "interview_complete", { score: newScore, resourceId: String(session._id) }, "Mock interview completed").catch(() => {});

      if (prev && newScore > prev.overallScore) {
        awardXP(req.user.userId, "interview_improve",
          { improvement: newScore - prev.overallScore, previousScore: prev.overallScore, newScore },
          "Interview score improved"
        ).catch(() => {});
      }
    }

    res.json({ ...session.toObject(), followupAdded });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE /api/projects/:id/interview/:sessionId ─────────────────────────────
router.delete("/:id/interview/:sessionId", requireAuth, async (req, res) => {
  try {
    const session = await InterviewSession.findOneAndDelete({
      _id: req.params.sessionId,
      user: req.user.userId,
      projectId: req.params.id,
    });
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json({ message: "Session deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/projects/:id/interview/:sessionId/report
router.get("/:id/interview/:sessionId/report", requireAuth, async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      user: req.user.userId,
      projectId: req.params.id,
    }).lean();
    if (!session) return res.status(404).json({ message: "Session not found" });

    const html = generateReportHTML(session);
    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

function generateReportHTML(session) {
  const score = session.overallScore ?? 0;
  const scoreColor = score >= 8 ? "#22c55e" : score >= 6 ? "#6366f1" : score >= 4 ? "#f59e0b" : "#ef4444";
  const date = session.completedAt ? new Date(session.completedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "In Progress";

  const qs = (session.questions || []).map((q, i) => `
    <div class="question">
      <div class="q-header">
        <span class="q-num">Q${i + 1}</span>
        ${q.isFollowup ? '<span class="badge followup">Follow-up</span>' : ""}
        ${q.type ? `<span class="badge type">${q.type}</span>` : ""}
        ${q.targetSkill ? `<span class="badge skill">${q.targetSkill}</span>` : ""}
        ${q.score != null ? `<span class="q-score" style="color:${q.score >= 8 ? "#22c55e" : q.score >= 6 ? "#6366f1" : q.score >= 4 ? "#f59e0b" : "#ef4444"}">${q.score}/10</span>` : ""}
      </div>
      <p class="q-text">${q.question}</p>
      ${q.dimensions ? `
        <div class="dims">
          ${["relevance","structure","depth","communication"].map(d => `
            <div class="dim"><span>${d}</span><div class="bar"><div style="width:${(q.dimensions[d]||0)*10}%;background:${(q.dimensions[d]||0)>=7?"#22c55e":"#6366f1"}"></div></div><span>${q.dimensions[d]||0}/10</span></div>
          `).join("")}
        </div>
      ` : ""}
      ${q.userAnswer ? `<div class="answer"><strong>Answer:</strong> ${q.userAnswer}</div>` : ""}
      ${q.strength ? `<div class="strength">✓ ${q.strength}</div>` : ""}
      ${q.improvement ? `<div class="improvement">⚠ ${q.improvement}</div>` : ""}
      ${q.aiFeedback ? `<div class="feedback">${q.aiFeedback}</div>` : ""}
    </div>
  `).join("");

  const report = session.report || {};
  const strengths = (report.strengths || []).map(s => `<li>${s}</li>`).join("");
  const improvements = (report.improvements || []).map(s => `<li>${s}</li>`).join("");
  const resources = (report.suggestedResources || []).map(s => `<li>${s}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><title>Interview Report – ${session.title || "Mock Interview"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a;background:#fff;padding:40px;max-width:860px;margin:auto}
  h1{font-size:1.8rem;font-weight:700;margin-bottom:4px}
  .meta{color:#64748b;font-size:.85rem;margin-bottom:32px}
  .score-hero{display:flex;align-items:center;gap:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px}
  .score-circle{width:80px;height:80px;border-radius:50%;border:4px solid ${scoreColor};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
  .score-circle .num{font-size:1.6rem;font-weight:700;color:${scoreColor}}
  .score-circle .denom{font-size:.7rem;color:#94a3b8}
  .recommendation{font-size:.85rem;color:#475569;margin-top:8px;line-height:1.5}
  h2{font-size:1rem;font-weight:600;margin:24px 0 12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px}
  .box ul{padding-left:16px;font-size:.82rem;color:#475569;line-height:1.8}
  .question{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px}
  .q-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
  .q-num{font-size:.75rem;font-weight:600;color:#94a3b8}
  .badge{font-size:.65rem;padding:2px 8px;border-radius:999px;font-weight:500}
  .badge.followup{background:#fef3c7;color:#92400e}
  .badge.type{background:#ede9fe;color:#5b21b6}
  .badge.skill{background:#f1f5f9;color:#475569}
  .q-score{margin-left:auto;font-weight:700;font-size:.85rem}
  .q-text{font-size:.9rem;font-weight:500;margin-bottom:10px;line-height:1.5}
  .dims{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
  .dim{display:flex;align-items:center;gap:6px;font-size:.72rem;color:#64748b}
  .dim span:first-child{width:80px;text-transform:capitalize}
  .bar{flex:1;height:5px;background:#e2e8f0;border-radius:999px;overflow:hidden}
  .bar div{height:100%;border-radius:999px}
  .dim span:last-child{width:28px;text-align:right}
  .answer{font-size:.8rem;color:#475569;background:#f8fafc;border-radius:6px;padding:10px;margin-bottom:8px;line-height:1.5}
  .strength{font-size:.8rem;color:#15803d;background:#f0fdf4;border-radius:6px;padding:8px 10px;margin-bottom:6px}
  .improvement{font-size:.8rem;color:#b45309;background:#fffbeb;border-radius:6px;padding:8px 10px;margin-bottom:6px}
  .feedback{font-size:.8rem;color:#475569;line-height:1.5;margin-top:6px}
  @media print{body{padding:20px}.score-circle{border-width:3px}button{display:none}}
</style>
</head>
<body>
<h1>${session.title || "Mock Interview"}</h1>
<p class="meta">Role: ${session.role || "—"} · Persona: ${session.persona || "mixed"} · Completed: ${date}</p>

<div class="score-hero">
  <div class="score-circle"><span class="num">${score}</span><span class="denom">/10</span></div>
  <div>
    <strong>Overall Score: ${score} / 10</strong>
    ${report.recommendation ? `<p class="recommendation">${report.recommendation}</p>` : ""}
  </div>
</div>

${strengths || improvements ? `
<div class="two-col">
  ${strengths ? `<div class="box"><h2 style="margin-top:0">What You Did Well</h2><ul>${strengths}</ul></div>` : ""}
  ${improvements ? `<div class="box"><h2 style="margin-top:0">Areas to Improve</h2><ul>${improvements}</ul></div>` : ""}
</div>` : ""}

<h2>Question-by-Question Feedback</h2>
${qs}

${resources ? `<h2>Next Steps</h2><div class="box"><ul>${resources}</ul></div>` : ""}

<p style="font-size:.75rem;color:#94a3b8;margin-top:32px;text-align:center">Generated by InterMate · ${new Date().toLocaleDateString()}</p>
</body>
</html>`;
}

export default router;
