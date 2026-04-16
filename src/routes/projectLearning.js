import express from "express";
import { requireAuth } from "../middleware/auth.js";
import Project from "../models/Project.js";
import InterviewSession from "../models/InterviewSession.js";
import LearningPlan from "../models/LearningPlan.js";
import { generateLearningPlan } from "../utils/learningServiceClient.js";

const router = express.Router();

function mapInterviewSessionsToFeedback(sessions = []) {
  return sessions.flatMap((session) =>
    (session.questions || [])
      .filter((question) => question.aiFeedback || question.score)
      .map((question, index) => ({
        id: `${session._id}-${index}`,
        sessionId: String(session._id),
        skill: session.role || "behavioral communication",
        category: "behavioral",
        score:
          typeof question.score === "number" && question.score <= 10
            ? question.score / 10
            : question.score || 0,
        feedback: question.aiFeedback || "",
        evidence: question.question || "",
      }))
  );
}

async function findOwnedProject(projectId, userId) {
  return Project.findOne({
    _id: projectId,
    userId,
    status: "active",
  });
}

router.get("/:id/learning/plan", requireAuth, async (req, res) => {
  try {
    const plan = await LearningPlan.findOne({
      projectId: req.params.id,
      userId: req.user.userId,
    }).lean();

    if (!plan) {
      return res.status(404).json({ message: "Learning plan not found" });
    }

    return res.json(plan);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/learning/plan/generate", requireAuth, async (req, res) => {
  try {
    const project = await findOwnedProject(req.params.id, req.user.userId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const interviewSessions = await InterviewSession.find({
      user: req.user.userId,
      projectId: project._id,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const interviewFeedback =
      Array.isArray(req.body.interviewFeedback) && req.body.interviewFeedback.length
        ? req.body.interviewFeedback
        : mapInterviewSessionsToFeedback(interviewSessions);

    const learningPayload = {
      project_id: String(project._id),
      target_role: req.body.targetRole || project.jobRole || project.title || "",
      jd_text: req.body.jdText || project.jobDescription || "",
      resume_analysis: req.body.resumeAnalysis || project.aiInsights || {},
      interview_feedback: interviewFeedback,
      quiz_results: Array.isArray(req.body.quizResults) ? req.body.quizResults : [],
      coding_lab_results: Array.isArray(req.body.codingLabResults)
        ? req.body.codingLabResults
        : [],
      additional_signals: Array.isArray(req.body.additionalSignals)
        ? req.body.additionalSignals
        : [],
    };

    const planResult = await generateLearningPlan(learningPayload);

    const savedPlan = await LearningPlan.findOneAndUpdate(
      {
        projectId: project._id,
        userId: req.user.userId,
      },
      {
        $set: {
          targetRole: planResult.targetRole,
          roleFocus: planResult.roleFocus,
          diagnosis: {
            weaknesses: planResult.weaknesses,
            strengths: project.aiInsights?.resumeStrengths || [],
            generatedAt: new Date(),
          },
          objectives: planResult.objectives,
          modules: planResult.modules,
          progress: {
            ...planResult.progress,
            lastUpdatedAt: new Date(),
          },
          normalizedSignals: planResult.normalizedSignals,
          sourceSnapshots: {
            resumeAnalysis: learningPayload.resume_analysis,
            interviewFeedback: learningPayload.interview_feedback,
            quizResults: learningPayload.quiz_results,
            codingLabResults: learningPayload.coding_lab_results,
          },
        },
        $inc: { version: 1 },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json(savedPlan);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
