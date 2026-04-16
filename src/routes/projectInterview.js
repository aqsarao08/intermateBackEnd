import express from "express";
import { requireAuth } from "../middleware/auth.js";
import InterviewSession from "../models/InterviewSession.js";
import Project from "../models/Project.js";

const router = express.Router();

// POST /api/projects/:id/interview/start
router.post("/:id/interview/start", requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      status: "active",
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const role = project.jobRole || "this role";
    const skills = project.aiInsights?.jdRequiredSkills || [];

    const questions = [
      `Tell me about yourself and why you are a fit for the ${role} role.`,
      `Why do you want to work at ${project.companyName || "this company"}?`,
      `How have you used ${skills[0] || "your technical skills"} in a real project?`,
      `Describe a challenge you solved that is relevant to this role.`,
      `What makes your resume a strong match for this job?`,
    ];

    const session = await InterviewSession.create({
      user: req.user.userId,
      projectId: project._id,
      role,
      title: `${project.title} Interview`,
      questions: questions.map((q, i) => ({
        question: q,
        orderIndex: i,
      })),
    });

    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/projects/:id/interview/history
router.get("/:id/interview/history", requireAuth, async (req, res) => {
  try {
    const sessions = await InterviewSession.find({
      user: req.user.userId,
      projectId: req.params.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/projects/:id/interview/:sessionId/answer
router.patch("/:id/interview/:sessionId/answer", requireAuth, async (req, res) => {
  try {
    const { index, answer, isLast } = req.body;

    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      user: req.user.userId,
      projectId: req.params.id,
    });

    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!session.questions[index]) {
      return res.status(400).json({ message: "Invalid question index" });
    }

    session.questions[index].userAnswer = answer || "";
    session.questions[index].aiFeedback =
      "Good answer. Add more structure, specific examples, and measurable results.";
    session.questions[index].score = 7;

    if (isLast) {
      session.completedAt = new Date();
      const scores = session.questions.map((q) => q.score || 0);
      session.overallScore =
        scores.length > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : 0;
    }

    await session.save();
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;