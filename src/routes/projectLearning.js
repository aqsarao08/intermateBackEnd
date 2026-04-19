import express from "express";
import { requireAuth } from "../middleware/auth.js";
import Project from "../models/Project.js";
import InterviewSession from "../models/InterviewSession.js";
import LearningPlan from "../models/LearningPlan.js";
import {
  generateLearningPlan,
  generateQuiz,
  diagnoseQuizConcepts,
  recommendProjects,
} from "../utils/learningServiceClient.js";
import { awardXP } from "../services/gamification.js";

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcReadinessScore(modules = []) {
  const total = modules.length;
  if (total === 0) return 0;
  const completed = modules.filter(m => m.status === "completed").length;
  const quizzed   = modules.filter(m => m.bestQuizScore !== null && m.bestQuizScore !== undefined);
  const quizAvg   = quizzed.length ? quizzed.reduce((s, m) => s + m.bestQuizScore, 0) / quizzed.length : 0;
  const labsDone  = modules.filter(m => m.labSpec?.completed).length;
  return Math.round((completed / total) * 50 + (quizAvg / 100) * 35 + (labsDone / total) * 15);
}

function deriveNextActions(modules = []) {
  const actions     = [];
  const inProgress  = modules.find(m => m.status === "in_progress");
  const needsReview = modules.filter(m => m.status === "needs_review");
  const noQuiz      = modules.filter(m => m.status === "completed" && (m.bestQuizScore === null || m.bestQuizScore === undefined));
  const notStarted  = modules.filter(m => m.status === "not_started").sort((a, b) => a.orderIndex - b.orderIndex);
  if (inProgress)     actions.push(`Continue: ${inProgress.title}`);
  if (needsReview[0]) actions.push(`Re-study: ${needsReview[0].title} (low quiz score)`);
  if (noQuiz[0])      actions.push(`Take quiz for: ${noQuiz[0].title}`);
  if (!inProgress && notStarted[0]) actions.push(`Start next: ${notStarted[0].title}`);
  return actions.slice(0, 3);
}

function scoreQuizAttempt(questions, answers) {
  const correct = answers.filter((ans, i) => ans === questions[i].correctIndex).length;
  const score   = Math.round((correct / questions.length) * 100);
  return {
    score, correct, total: questions.length, passed: score >= 60,
    feedback: questions.map((q, i) => ({
      question: q.question, yourAnswer: q.options[answers[i]] ?? "—",
      correctAnswer: q.options[q.correctIndex], correct: answers[i] === q.correctIndex,
      explanation: q.explanation,
    })),
  };
}

function mapInterviewSessionsToFeedback(sessions = []) {
  return sessions.flatMap((session) =>
    (session.questions || []).filter((q) => q.aiFeedback || q.score).map((q, i) => ({
      id: `${session._id}-${i}`, sessionId: String(session._id),
      skill: session.role || "behavioral communication", category: "behavioral",
      score: typeof q.score === "number" && q.score <= 10 ? q.score / 10 : q.score || 0,
      feedback: q.aiFeedback || "", evidence: q.question || "",
    }))
  );
}

async function findOwnedProject(projectId, userId) {
  return Project.findOne({ _id: projectId, userId, status: "active" });
}

// ── GET plan ──────────────────────────────────────────────────────────────────

router.get("/:id/learning/plan", requireAuth, async (req, res) => {
  try {
    const plan = await LearningPlan.findOne({ projectId: req.params.id, userId: req.user.userId }).lean();
    if (!plan) return res.status(404).json({ message: "No learning plan yet. Generate one first." });
    return res.json(plan);
  } catch (err) {
    console.error("Get plan error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST generate plan ────────────────────────────────────────────────────────

router.post("/:id/learning/plan/generate", requireAuth, async (req, res) => {
  try {
    const project = await findOwnedProject(req.params.id, req.user.userId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const sessions = await InterviewSession.find({ user: req.user.userId, projectId: project._id })
      .sort({ createdAt: -1 }).limit(5).lean();

    const interviewFeedback =
      Array.isArray(req.body.interviewFeedback) && req.body.interviewFeedback.length
        ? req.body.interviewFeedback : mapInterviewSessionsToFeedback(sessions);

    const payload = {
      project_id: String(project._id),
      target_role: req.body.targetRole || project.jobRole || project.title || "",
      jd_text: req.body.jdText || project.jobDescription || "",
      resume_analysis: req.body.resumeAnalysis || project.aiInsights || {},
      interview_feedback: interviewFeedback,
      quiz_results: Array.isArray(req.body.quizResults) ? req.body.quizResults : [],
      coding_lab_results: Array.isArray(req.body.codingLabResults) ? req.body.codingLabResults : [],
      additional_signals: Array.isArray(req.body.additionalSignals) ? req.body.additionalSignals : [],
    };

    const planResult = await generateLearningPlan(payload);

    const saved = await LearningPlan.findOneAndUpdate(
      { projectId: project._id, userId: req.user.userId },
      {
        $set: {
          targetRole: planResult.targetRole, roleFocus: planResult.roleFocus,
          diagnosis: { weaknesses: planResult.weaknesses, strengths: project.aiInsights?.resumeStrengths || [], generatedAt: new Date() },
          objectives: planResult.objectives, modules: planResult.modules,
          progress: { ...planResult.progress, lastUpdatedAt: new Date() },
          normalizedSignals: planResult.normalizedSignals,
          sourceSnapshots: { resumeAnalysis: payload.resume_analysis, interviewFeedback: payload.interview_feedback, quizResults: payload.quiz_results, codingLabResults: payload.coding_lab_results },
        },
        $inc: { version: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json(saved);
  } catch (err) {
    console.error("Generate plan error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

// ── PATCH module status ───────────────────────────────────────────────────────

router.patch("/:id/learning/modules/:moduleId", requireAuth, async (req, res) => {
  const { status } = req.body;
  const valid = ["not_started", "in_progress", "completed", "needs_review"];
  if (!valid.includes(status)) return res.status(400).json({ message: `status must be one of: ${valid.join(", ")}` });
  try {
    const plan = await LearningPlan.findOne({ projectId: req.params.id, userId: req.user.userId }).lean();
    if (!plan) return res.status(404).json({ message: "Learning plan not found" });
    const mod = plan.modules.find(m => m.id === req.params.moduleId);
    if (!mod)  return res.status(404).json({ message: "Module not found" });

    const updatedModules = plan.modules.map(m => m.id === req.params.moduleId ? { ...m, status } : m);
    const newProgress = {
      completedModules: updatedModules.filter(m => m.status === "completed").length,
      readinessScore:   calcReadinessScore(updatedModules),
      nextBestActions:  deriveNextActions(updatedModules),
      lastUpdatedAt:    new Date(),
    };

    await LearningPlan.updateOne(
      { _id: plan._id, "modules.id": req.params.moduleId },
      {
        $set: {
          "modules.$.status": status,
          "progress.completedModules": newProgress.completedModules,
          "progress.readinessScore":   newProgress.readinessScore,
          "progress.nextBestActions":  newProgress.nextBestActions,
          "progress.lastUpdatedAt":    newProgress.lastUpdatedAt,
        },
      }
    );

    if (status === "completed") {
      awardXP(req.user.userId, "module_complete", { moduleId: req.params.moduleId, priority: mod.priority, resourceId: req.params.moduleId }, `Completed module: ${mod.title}`).catch(() => {});
    }

    return res.json({ module: { ...mod, status }, progress: { ...plan.progress, ...newProgress } });
  } catch (err) {
    console.error("Update status error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET progress ──────────────────────────────────────────────────────────────

router.get("/:id/learning/progress", requireAuth, async (req, res) => {
  try {
    const plan = await LearningPlan.findOne({ projectId: req.params.id, userId: req.user.userId }).lean();
    if (!plan) return res.status(404).json({ message: "Learning plan not found" });
    const modules = plan.modules || [];
    const weaknessByCategory = {};
    for (const w of plan.diagnosis?.weaknesses || []) {
      if (!weaknessByCategory[w.category]) weaknessByCategory[w.category] = { count: 0, maxSeverity: "low" };
      weaknessByCategory[w.category].count++;
      if (w.severity === "high") weaknessByCategory[w.category].maxSeverity = "high";
      else if (w.severity === "medium" && weaknessByCategory[w.category].maxSeverity !== "high")
        weaknessByCategory[w.category].maxSeverity = "medium";
    }
    return res.json({
      readinessScore:   calcReadinessScore(modules),
      completedModules: modules.filter(m => m.status === "completed").length,
      totalModules:     modules.length,
      quizScores:       modules.filter(m => m.bestQuizScore !== null && m.bestQuizScore !== undefined).map(m => ({ moduleId: m.id, title: m.title, score: m.bestQuizScore })),
      nextBestActions:  deriveNextActions(modules),
      weaknessByCategory,
    });
  } catch (err) {
    console.error("Get progress error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET quiz (generate on-demand) ─────────────────────────────────────────────

router.get("/:id/learning/quiz/:moduleId", requireAuth, async (req, res) => {
  try {
    const plan = await LearningPlan.findOne({ projectId: req.params.id, userId: req.user.userId }).lean();
    if (!plan) return res.status(404).json({ message: "Learning plan not found" });
    const mod = plan.modules.find(m => m.id === req.params.moduleId);
    if (!mod)  return res.status(404).json({ message: "Module not found" });

    let questions = mod.quiz;

    if (!questions || questions.length === 0) {
      const linkedKey = plan.objectives?.find(o => mod.objective?.includes(o.title))?.linkedWeaknessKeys?.[0];
      const weakness  = plan.diagnosis?.weaknesses?.find(w => w.key === linkedKey);
      questions = await generateQuiz({
        moduleId: mod.id, skill: mod.title, category: mod.category,
        targetRole: plan.targetRole, severity: weakness?.severity || "medium",
      });

      // Atomic update — avoids version conflict
      await LearningPlan.updateOne(
        { _id: plan._id, "modules.id": mod.id },
        { $set: { "modules.$.quiz": questions } }
      );
    }

    const safe = questions.map(({ id, question, options, difficulty, conceptTested }) => ({
      id, question, options, difficulty, conceptTested,
    }));
    return res.json({ questions: safe, attemptCount: mod.quizAttempts.length, bestScore: mod.bestQuizScore });
  } catch (err) {
    console.error("Get quiz error:", err);
    return res.status(500).json({ message: err.message || "Failed to load quiz" });
  }
});

// ── POST submit quiz ──────────────────────────────────────────────────────────

router.post("/:id/learning/quiz/:moduleId/submit", requireAuth, async (req, res) => {
  const { answers } = req.body;
  if (!Array.isArray(answers)) return res.status(400).json({ message: "answers must be an array of selected indices" });
  try {
    const plan = await LearningPlan.findOne({ projectId: req.params.id, userId: req.user.userId }).lean();
    if (!plan) return res.status(404).json({ message: "Learning plan not found" });
    const mod = plan.modules.find(m => m.id === req.params.moduleId);
    if (!mod)  return res.status(404).json({ message: "Module not found" });
    if (!mod.quiz?.length) return res.status(400).json({ message: "No quiz available. Load quiz first." });

    const previousFailed = mod.quizAttempts.some(a => !a.passed);
    const result  = scoreQuizAttempt(mod.quiz, answers);
    const attempt = { attemptedAt: new Date(), score: result.score, answers, passed: result.passed };
    const newBest = (mod.bestQuizScore === null || mod.bestQuizScore === undefined)
      ? result.score
      : Math.max(mod.bestQuizScore, result.score);
    const newStatus = !result.passed && mod.status === "in_progress" ? "needs_review" : mod.status;

    // ── Concept-level diagnosis (runs in parallel with DB write) ──────────────
    let conceptDiagnosis = null;
    try {
      const project = await Project.findOne({ _id: req.params.id, userId: req.user.userId })
        .select("jobRole").lean();
      conceptDiagnosis = await diagnoseQuizConcepts({
        skill:    mod.title,
        category: mod.category || "general",
        role:     plan.targetRole || project?.jobRole || "",
        questions: mod.quiz.map(q => ({
          id: q.id, question: q.question,
          correctIndex: q.correctIndex, conceptTested: q.conceptTested || "",
        })),
        answers,
      });
    } catch (err) {
      console.warn("Concept diagnosis failed (non-fatal):", err.message);
    }

    const updatedModules = plan.modules.map(m =>
      m.id === req.params.moduleId
        ? { ...m, status: newStatus, bestQuizScore: newBest, quizAttempts: [...m.quizAttempts, attempt] }
        : m
    );
    const newReadiness   = calcReadinessScore(updatedModules);
    const newNextActions = deriveNextActions(updatedModules);

    const dbUpdate = {
      $push: { "modules.$.quizAttempts": attempt },
      $set: {
        "modules.$.bestQuizScore":  newBest,
        "modules.$.status":         newStatus,
        "progress.readinessScore":  newReadiness,
        "progress.nextBestActions": newNextActions,
        "progress.lastUpdatedAt":   new Date(),
      },
    };
    if (conceptDiagnosis) {
      dbUpdate.$set["modules.$.conceptDiagnosis"] = conceptDiagnosis;
    }

    await LearningPlan.updateOne({ _id: plan._id, "modules.id": req.params.moduleId }, dbUpdate);

    if (result.passed) {
      const xpAction = previousFailed ? "quiz_retry_pass" : "quiz_pass";
      awardXP(req.user.userId, xpAction, { moduleId: req.params.moduleId, score: result.score, resourceId: req.params.moduleId }, `Quiz: ${mod.title}`).catch(() => {});
    }

    return res.json({
      ...result,
      conceptDiagnosis,
      module:   { id: mod.id, status: newStatus, bestQuizScore: newBest, attemptCount: mod.quizAttempts.length + 1 },
      progress: { ...plan.progress, readinessScore: newReadiness, nextBestActions: newNextActions },
    });
  } catch (err) {
    console.error("Submit quiz error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH lab complete ────────────────────────────────────────────────────────

router.patch("/:id/learning/lab/:moduleId/complete", requireAuth, async (req, res) => {
  try {
    const plan = await LearningPlan.findOne({ projectId: req.params.id, userId: req.user.userId }).lean();
    if (!plan) return res.status(404).json({ message: "Learning plan not found" });
    const mod = plan.modules.find(m => m.id === req.params.moduleId);
    if (!mod)  return res.status(404).json({ message: "Module not found" });

    const wasCompleted  = mod.labSpec?.completed;
    const nowCompleted  = Boolean(req.body.completed);
    const updatedModules = plan.modules.map(m =>
      m.id === req.params.moduleId ? { ...m, labSpec: { ...m.labSpec, completed: nowCompleted } } : m
    );
    const newReadiness   = calcReadinessScore(updatedModules);
    const newNextActions = deriveNextActions(updatedModules);

    await LearningPlan.updateOne(
      { _id: plan._id, "modules.id": req.params.moduleId },
      {
        $set: {
          "modules.$.labSpec.completed": nowCompleted,
          "progress.readinessScore":     newReadiness,
          "progress.nextBestActions":    newNextActions,
          "progress.lastUpdatedAt":      new Date(),
        },
      }
    );

    if (!wasCompleted && nowCompleted) {
      awardXP(req.user.userId, "lab_complete", { moduleId: req.params.moduleId, difficulty: mod.labSpec?.difficulty, resourceId: `lab:${req.params.moduleId}` }, `Lab complete: ${mod.title}`).catch(() => {});
    }

    return res.json({
      module:   { ...mod, labSpec: { ...mod.labSpec, completed: nowCompleted } },
      progress: { ...plan.progress, readinessScore: newReadiness, nextBestActions: newNextActions },
    });
  } catch (err) {
    console.error("Lab complete error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/projects/:id/learning/projects ──────────────────────────────────

router.post("/:id/learning/projects", requireAuth, async (req, res) => {
  try {
    const [plan, project] = await Promise.all([
      LearningPlan.findOne({ projectId: req.params.id, userId: req.user.userId }).lean(),
      Project.findOne({ _id: req.params.id, userId: req.user.userId }).select("jobRole jobDescription").lean(),
    ]);
    if (!plan) return res.status(404).json({ message: "Learning plan not found" });

    // Build weak-skills list from modules that have concept diagnosis
    const weakSkills = (plan.modules || [])
      .filter(m => m.conceptDiagnosis?.conceptsWeak?.length > 0)
      .map(m => ({
        skill:        m.title,
        category:     m.category,
        conceptsWeak: m.conceptDiagnosis.conceptsWeak,
      }));

    if (weakSkills.length === 0) {
      return res.status(400).json({ message: "Complete at least one quiz first so the system can detect your weak concepts." });
    }

    const result = await recommendProjects({
      role:      plan.targetRole || project?.jobRole || "",
      weakSkills,
      jdText:    project?.jobDescription || "",
    });

    // Persist to plan
    await LearningPlan.updateOne(
      { _id: plan._id },
      { $set: { projectRecommendations: result.projects } }
    );

    return res.json({ projects: result.projects });
  } catch (err) {
    console.error("Project recommendations error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
