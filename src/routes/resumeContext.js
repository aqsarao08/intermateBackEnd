import express from "express";
import { requireAuth } from "../middleware/auth.js";
import ResumeContext from "../models/ResumeContext.js";

const router = express.Router();

// save or create a new context
router.post("/", requireAuth, async (req, res) => {
  try {
    const { jobDescription, resumeFileName, resumeUrl, resumeText } = req.body;

    const ctx = await ResumeContext.create({
      user: req.user._id,
      jobDescription,
      resumeFileName,
      resumeUrl: resumeUrl || null,
      resumeText: resumeText || null,
    });

    res.status(201).json(ctx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// get latest context for current user
router.get("/latest", requireAuth, async (req, res) => {
  const latest = await ResumeContext.findOne({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  res.json(latest || null);
});

export default router;
