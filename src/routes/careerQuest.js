import express from "express";
import { requireAuth } from "../middleware/auth.js";
import CareerQuestProgress from "../models/CareerQuestProgress.js";

const router = express.Router();

// GET /api/career-quest
router.get("/", requireAuth, async (req, res) => {
  let doc = await CareerQuestProgress.findOne({ user: req.user._id }).lean();
  if (!doc) {
    // initialize 5 locked stages, stage 1 in-progress
    doc = await CareerQuestProgress.create({
      user: req.user._id,
      stages: Array.from({ length: 5 }).map((_, i) => ({
        stageNumber: i + 1,
        title: `Stage ${i + 1}`,
        status: i === 0 ? "in-progress" : "locked",
        score: 0,
      })),
    });
  }
  res.json(doc);
});

// POST /api/career-quest/complete-stage
router.post("/complete-stage", requireAuth, async (req, res) => {
  const { stageNumber, score } = req.body;

  const doc = await CareerQuestProgress.findOne({ user: req.user._id });
  if (!doc) return res.status(404).json({ error: "Progress not found" });

  const stage = doc.stages.find((s) => s.stageNumber === stageNumber);
  if (!stage) return res.status(400).json({ error: "Invalid stage number" });

  stage.status = "completed";
  stage.score = score ?? stage.score;

  const next = doc.stages.find((s) => s.stageNumber === stageNumber + 1);
  if (next && next.status === "locked") {
    next.status = "in-progress";
  }

  await doc.save();
  res.json(doc);
});

export default router;
