import express from "express";
import { requireAuth } from "../middleware/auth.js";
import PeerReview from "../models/PeerReview.js";

const router = express.Router();

// POST /api/peer-reviews
router.post("/", requireAuth, async (req, res) => {
  try {
    const { targetUserId, recordingUrl, comments, rating } = req.body;

    const review = await PeerReview.create({
      author: req.user._id,
      target: targetUserId,
      recordingUrl,
      comments,
      rating,
    });

    res.status(201).json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/peer-reviews/my
router.get("/my", requireAuth, async (req, res) => {
  const reviews = await PeerReview.find({ target: req.user._id })
    .populate("author", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.json(reviews);
});

export default router;
