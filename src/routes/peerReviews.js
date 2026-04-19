import express from "express";
import { requireAuth } from "../middleware/auth.js";
import PeerReview from "../models/PeerReview.js";
import InterviewSession from "../models/InterviewSession.js";
import Project from "../models/Project.js";
import { awardXP } from "../services/gamification.js";

const router = express.Router();

// Works whether `requester`/`reviewer` are ObjectIds or populated objects
function extractId(field) {
  if (!field) return null;
  if (field._id) return field._id.toString();
  return field.toString();
}

function isParticipant(review, userId) {
  const reqId = extractId(review.requester);
  const revId = extractId(review.reviewer);
  return reqId === userId || (revId && revId === userId);
}

// ── GET /api/peer-reviews/available-sessions
// Returns the current user's completed interview sessions for the request modal
router.get("/available-sessions", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessions = await InterviewSession.find({
      user: userId,
      completedAt: { $ne: null },
    })
      .select("_id title role overallScore completedAt projectId")
      .sort({ completedAt: -1 })
      .limit(50)
      .lean();

    const projectIds = [...new Set(sessions.map(s => s.projectId?.toString()).filter(Boolean))];
    const projects = await Project.find({ _id: { $in: projectIds } })
      .select("_id title companyName jobRole")
      .lean();
    const projectMap = Object.fromEntries(projects.map(p => [p._id.toString(), p]));

    const result = sessions.map(s => ({
      _id: s._id,
      title: s.title || "Mock Interview",
      role: s.role || "",
      overallScore: s.overallScore || 0,
      completedAt: s.completedAt,
      projectTitle: projectMap[s.projectId?.toString()]?.title || "",
      companyName: projectMap[s.projectId?.toString()]?.companyName || "",
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/peer-reviews/request
router.post("/request", requireAuth, async (req, res) => {
  try {
    const { interviewSessionId, recordingUrl, requestMessage } = req.body;
    const userId = req.user.userId;

    if (!interviewSessionId) {
      return res.status(400).json({ message: "Interview session is required" });
    }

    const session = await InterviewSession.findOne({
      _id: interviewSessionId,
      user: userId,
    }).lean();

    if (!session) {
      return res.status(404).json({ message: "Interview session not found" });
    }

    if (!session.completedAt) {
      return res.status(400).json({ message: "Only completed interview sessions can be reviewed" });
    }

    const pendingCount = await PeerReview.countDocuments({
      requester: userId,
      status: "pending",
    });

    if (pendingCount >= 3) {
      return res.status(429).json({
        message: "You have 3 pending requests already. Wait for one to be accepted before creating more.",
      });
    }

    const existing = await PeerReview.findOne({
      requester: userId,
      interviewSessionId,
      status: { $in: ["pending", "accepted"] },
    });

    if (existing) {
      return res.status(409).json({ message: "A review request for this session already exists" });
    }

    const review = await PeerReview.create({
      requester: userId,
      interviewSessionId,
      projectId: session.projectId || null,
      title: session.title || "Mock Interview Review",
      recordingUrl: String(recordingUrl || "").trim(),
      requestMessage: String(requestMessage || "").trim().slice(0, 500),
    });

    return res.status(201).json({ message: "Review request created", review });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/peer-reviews/incoming
// Open requests from others that the current user can accept
router.get("/incoming", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const reviews = await PeerReview.find({
      status: "pending",
      requester: { $ne: userId },
      interviewSessionId: { $exists: true, $ne: null }, // exclude old-schema docs
    })
      .populate("requester", "name email")
      .select("-chatMessages -timestampComments -feedback.suggestions")
      .sort({ requestedAt: -1 })
      .limit(50)
      .lean();

    return res.json(reviews);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/peer-reviews/outgoing
// My requests (I am requester)
router.get("/outgoing", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const reviews = await PeerReview.find({
      requester: userId,
      interviewSessionId: { $exists: true, $ne: null },
    })
      .populate("requester", "name email")
      .populate("reviewer", "name email")
      .select("-chatMessages -timestampComments")
      .sort({ requestedAt: -1 })
      .lean();

    return res.json(reviews);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/peer-reviews/given
// Reviews I am giving (I am reviewer)
router.get("/given", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const reviews = await PeerReview.find({
      reviewer: userId,
      interviewSessionId: { $exists: true, $ne: null },
    })
      .populate("requester", "name email")
      .select("-chatMessages -timestampComments")
      .sort({ acceptedAt: -1 })
      .lean();

    return res.json(reviews);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/peer-reviews/:id/accept
router.patch("/:id/accept", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const review = await PeerReview.findById(req.params.id);

    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.requester.toString() === userId) {
      return res.status(403).json({ message: "You cannot review your own session" });
    }
    if (review.status !== "pending") {
      return res.status(409).json({ message: "This request has already been handled" });
    }

    review.reviewer = userId;
    review.status = "accepted";
    review.acceptedAt = new Date();
    await review.save();

    return res.json({ message: "Review accepted", review });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/peer-reviews/:id/decline
router.patch("/:id/decline", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reason } = req.body;
    const review = await PeerReview.findById(req.params.id);

    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.status === "completed") {
      return res.status(409).json({ message: "Cannot decline a completed review" });
    }
    if (review.status === "accepted" && review.reviewer?.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (review.status === "pending" && review.requester.toString() === userId) {
      return res.status(403).json({ message: "You cannot decline your own request" });
    }

    review.status = "declined";
    review.declinedReason = String(reason || "").trim().slice(0, 200);
    review.reviewer = null;
    await review.save();

    return res.json({ message: "Review declined" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/peer-reviews/:id
// Full review thread — participants only
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const review = await PeerReview.findById(req.params.id)
      .populate("requester", "name email")
      .populate("reviewer", "name email")
      .lean();

    if (!review) return res.status(404).json({ message: "Review not found" });

    // For pending reviews, allow the requester and any authenticated user to read basic info
    // but restrict chat/feedback to participants only
    const participant = isParticipant(review, userId);

    if (!participant && review.status !== "pending") {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Only participants see chat messages
    if (!participant) {
      review.chatMessages = [];
    }

    const session = await InterviewSession.findById(review.interviewSessionId)
      .select("title role questions overallScore report completedAt persona")
      .lean();

    return res.json({ review, session });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/peer-reviews/:id/comments
router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { timestamp, text, category } = req.body;

    const review = await PeerReview.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (!isParticipant(review, userId)) return res.status(403).json({ message: "Not authorized" });
    if (review.status !== "accepted") {
      return res.status(409).json({ message: "Comments can only be added to active reviews" });
    }

    if (typeof timestamp !== "number" || timestamp < 0) {
      return res.status(400).json({ message: "Valid timestamp in seconds is required" });
    }
    if (!text || String(text).trim().length < 2) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    review.timestampComments.push({
      authorId: userId,
      timestamp,
      text: String(text).trim().slice(0, 1000),
      category: category || "suggestion",
    });
    await review.save();

    const added = review.timestampComments[review.timestampComments.length - 1];
    return res.status(201).json({ comment: added });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE /api/peer-reviews/:id/comments/:commentId
router.delete("/:id/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const review = await PeerReview.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    const comment = review.timestampComments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.authorId.toString() !== userId) return res.status(403).json({ message: "Not authorized" });

    comment.deleteOne();
    await review.save();
    return res.json({ message: "Comment deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/peer-reviews/:id/messages
router.get("/:id/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const review = await PeerReview.findById(req.params.id)
      .select("requester reviewer chatMessages status")
      .lean();

    if (!review) return res.status(404).json({ message: "Review not found" });
    if (!isParticipant(review, userId)) return res.status(403).json({ message: "Not authorized" });

    return res.json({ messages: review.chatMessages ?? [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── POST /api/peer-reviews/:id/messages
router.post("/:id/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { text } = req.body;

    const review = await PeerReview.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (!isParticipant(review, userId)) return res.status(403).json({ message: "Not authorized" });
    if (!["accepted", "completed"].includes(review.status)) {
      return res.status(409).json({ message: "Chat is only available on active or completed reviews" });
    }
    if (!text || String(text).trim().length === 0) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    review.chatMessages.push({
      senderId: userId,
      text: String(text).trim().slice(0, 2000),
    });
    await review.save();

    const msg = review.chatMessages[review.chatMessages.length - 1];
    return res.status(201).json({ message: msg });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/peer-reviews/:id/feedback
// Reviewer saves/updates feedback (can call multiple times before completing)
router.patch("/:id/feedback", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { strengths, weaknesses, suggestions, overallComments, rating, summary } = req.body;

    const review = await PeerReview.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (!review.reviewer || review.reviewer.toString() !== userId) {
      return res.status(403).json({ message: "Only the assigned reviewer can submit feedback" });
    }
    if (review.status !== "accepted") {
      return res.status(409).json({ message: "Feedback can only be added to active reviews" });
    }

    if (Array.isArray(strengths)) {
      review.feedback.strengths = strengths.map(s => String(s).trim()).filter(Boolean);
    }
    if (Array.isArray(weaknesses)) {
      review.feedback.weaknesses = weaknesses.map(s => String(s).trim()).filter(Boolean);
    }
    if (Array.isArray(suggestions)) {
      review.feedback.suggestions = suggestions.map(s => ({
        text: String(typeof s === "string" ? s : s.text || "").trim(),
        appliedByRequester: false,
        appliedAt: null,
      })).filter(s => s.text);
    }
    if (overallComments !== undefined) {
      review.feedback.overallComments = String(overallComments).trim().slice(0, 3000);
    }
    if (rating !== undefined && rating !== null) {
      review.feedback.rating = Math.min(5, Math.max(1, Number(rating)));
    }
    if (summary !== undefined) {
      review.feedback.summary = String(summary).trim().slice(0, 2000);
    }
    review.feedback.submittedAt = new Date();

    await review.save();
    return res.json({ message: "Feedback saved", feedback: review.feedback });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/peer-reviews/:id/complete
router.patch("/:id/complete", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const review = await PeerReview.findById(req.params.id);

    if (!review) return res.status(404).json({ message: "Review not found" });
    if (!review.reviewer || review.reviewer.toString() !== userId) {
      return res.status(403).json({ message: "Only the assigned reviewer can complete the review" });
    }
    if (review.status !== "accepted") {
      return res.status(409).json({ message: "Review is not in an active state" });
    }
    if (!review.feedback.rating) {
      return res.status(400).json({ message: "Please add a rating before completing" });
    }
    if (!review.feedback.summary?.trim()) {
      return res.status(400).json({ message: "Please add a summary before completing" });
    }

    review.status = "completed";
    review.completedAt = new Date();
    await review.save();

    // Award XP — quality threshold: at least 3 feedback items or 2 timestamp comments
    const commentCount = review.timestampComments.filter(c => c.authorId.toString() === userId).length;
    const feedbackItems =
      review.feedback.strengths.length +
      review.feedback.weaknesses.length +
      review.feedback.suggestions.length;

    if (feedbackItems >= 3 || commentCount >= 2 || review.feedback.overallComments.length >= 100) {
      awardXP(userId, "peer_review_given", { reviewId: String(review._id) }, "Completed peer review").catch(() => {});
    }
    awardXP(
      review.requester.toString(),
      "peer_review_received",
      { reviewId: String(review._id) },
      "Received a completed peer review"
    ).catch(() => {});

    return res.json({ message: "Review completed", review });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /api/peer-reviews/:id/suggestions/:suggestionId/apply
router.patch("/:id/suggestions/:suggestionId/apply", requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { applied } = req.body;

    const review = await PeerReview.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.requester.toString() !== userId) {
      return res.status(403).json({ message: "Only the requester can mark suggestions as applied" });
    }

    const suggestion = review.feedback.suggestions.id(req.params.suggestionId);
    if (!suggestion) return res.status(404).json({ message: "Suggestion not found" });

    suggestion.appliedByRequester = Boolean(applied);
    suggestion.appliedAt = applied ? new Date() : null;
    await review.save();

    return res.json({ message: "Updated", suggestion });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
