import express from "express";
import { requireAuth } from "../middleware/auth.js";
import LearnModeProgress from "../models/LearnModeProgress.js";

const router = express.Router();

// GET /api/learn-mode
router.get("/", requireAuth, async (req, res) => {
  let doc = await LearnModeProgress.findOne({ user: req.user._id }).lean();
  if (!doc) {
    doc = await LearnModeProgress.create({
      user: req.user._id,
      topics: [],
    });
  }
  res.json(doc);
});

// POST /api/learn-mode/record-result
router.post("/record-result", requireAuth, async (req, res) => {
  const { topicId, topicName, score } = req.body;

  const doc = await LearnModeProgress.findOne({ user: req.user._id });
  if (!doc) return res.status(404).json({ error: "Progress not found" });

  let topic = doc.topics.find((t) => t.topicId === topicId);
  if (!topic) {
    topic = { topicId, topicName, lastScore: score, attempts: 1 };
    doc.topics.push(topic);
  } else {
    topic.lastScore = score;
    topic.attempts += 1;
  }

  await doc.save();
  res.json(doc);
});

export default router;
