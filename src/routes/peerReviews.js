import express from "express";
import { requireAuth } from "../middleware/auth.js";
import PeerReview from "../models/PeerReview.js";
import { awardXP } from "../services/gamification.js";

const router = express.Router();

// POST /api/peer-reviews
router.post("/", requireAuth, async (req, res) => {
  try {
    const { targetUserId, recordingUrl, comments, rating } = req.body;

    const review = await PeerReview.create({
      author: req.user.userId,
      target: targetUserId,
      recordingUrl,
      comments,
      rating,
    });

    // Award XP to reviewer (min 50 chars to prevent spam)
    if ((comments || "").trim().length >= 50) {
      awardXP(req.user.userId, "peer_review_given", { reviewId: String(review._id) }, "Submitted peer review").catch(() => {});
    }
    // Award XP to the person who received the review
    if (targetUserId) {
      awardXP(targetUserId, "peer_review_received", { reviewId: String(review._id) }, "Received a peer review").catch(() => {});
    }

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
