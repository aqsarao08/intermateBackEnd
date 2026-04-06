// src/routes/interview.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import InterviewSession from "../models/InterviewSession.js";

const router = express.Router();

// POST /api/interview/start
router.post("/start", requireAuth, async (req, res) => {
  try {
    const { role, title } = req.body;

    const questions = [
      "Tell me about yourself.",
      "Describe a project you are proud of.",
      "What are your strengths and weaknesses?",
    ];

    const session = await InterviewSession.create({
      user: req.user.userId,
      role: role || "",
      title: title || "Mock Interview",
      questions: questions.map((q, i) => ({
        question: q,
        orderIndex: i,
      })),
    });

    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/interview/:id/answer
router.patch("/:id/answer", requireAuth, async (req, res) => {
  try {
    const { index, answer, isLast } = req.body;

    const session = await InterviewSession.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!session.questions[index]) {
      return res.status(400).json({ error: "Invalid question index" });
    }

    session.questions[index].userAnswer = answer || "";

    // placeholder AI feedback logic
    session.questions[index].aiFeedback = "AI feedback placeholder";
    session.questions[index].score = 7;

    if (isLast) {
      session.completedAt = new Date();
      session.overallScore = 7; // later: compute real average
    }

    await session.save();
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/interview/history
router.get("/history", requireAuth, async (req, res) => {
  try {
    const sessions = await InterviewSession.find({
      user: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
