import mongoose from "mongoose";

const COMMENT_CATEGORIES = [
  "positive", "suggestion", "technical",
  "communication", "confidence", "behavioral", "structure",
];

const timestampCommentSchema = new mongoose.Schema(
  {
    authorId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    timestamp: { type: Number, required: true, min: 0 },
    text:      { type: String, required: true, maxlength: 1000 },
    category:  { type: String, enum: COMMENT_CATEGORIES, default: "suggestion" },
  },
  { timestamps: true }
);

const chatMessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text:     { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

const suggestionSchema = new mongoose.Schema({
  text:               { type: String, required: true, maxlength: 500 },
  appliedByRequester: { type: Boolean, default: false },
  appliedAt:          { type: Date, default: null },
});

const feedbackSchema = new mongoose.Schema(
  {
    strengths:       { type: [String], default: [] },
    weaknesses:      { type: [String], default: [] },
    suggestions:     { type: [suggestionSchema], default: [] },
    overallComments: { type: String, default: "", maxlength: 3000 },
    rating:          { type: Number, min: 1, max: 5, default: null },
    summary:         { type: String, default: "", maxlength: 2000 },
    submittedAt:     { type: Date, default: null },
  },
  { _id: false }
);

const peerReviewSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    interviewSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterviewSession",
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    title:          { type: String, default: "Mock Interview Review" },
    recordingUrl:   { type: String, default: "" },
    requestMessage: { type: String, default: "", maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "completed"],
      default: "pending",
      index: true,
    },
    feedback:           { type: feedbackSchema, default: () => ({}) },
    timestampComments:  { type: [timestampCommentSchema], default: [] },
    chatMessages:       { type: [chatMessageSchema], default: [] },
    requestedAt:        { type: Date, default: Date.now },
    acceptedAt:         { type: Date, default: null },
    completedAt:        { type: Date, default: null },
    declinedReason:     { type: String, default: "" },
  },
  { timestamps: true }
);

peerReviewSchema.index({ status: 1, createdAt: -1 });
peerReviewSchema.index({ requester: 1, status: 1 });
peerReviewSchema.index({ reviewer: 1, status: 1 });

export default mongoose.model("PeerReview", peerReviewSchema);
