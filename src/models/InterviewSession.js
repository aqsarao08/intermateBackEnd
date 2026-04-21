import mongoose from "mongoose";

const dimensionSchema = new mongoose.Schema(
  {
    relevance:     { type: Number, default: 0 },
    structure:     { type: Number, default: 0 },
    depth:         { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
  },
  { _id: false }
);

const deliveryMetricsSchema = new mongoose.Schema(
  {
    answerDurationSec: { type: Number, default: 0 },
    responseLatencySec: { type: Number, default: 0 },
    wordsPerMinute: { type: Number, default: 0 },
    averagePauseSec: { type: Number, default: 0 },
    longSilenceCount: { type: Number, default: 0 },
    fillerWordsCount: { type: Number, default: 0 },
    repeatedWordsCount: { type: Number, default: 0 },
    transcriptWordCount: { type: Number, default: 0 },
    transcriptFluencyScore: { type: Number, default: 0 },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    question:    { type: String, default: "" },
    type:        { type: String, default: "behavioral" }, // behavioral | technical | situational | motivational
    targetSkill: { type: String, default: "" },
    isFollowup:  { type: Boolean, default: false },
    orderIndex:  { type: Number, default: 0 },
    userAnswer:  { type: String, default: "" },
    aiFeedback:  { type: String, default: "" },
    strength:    { type: String, default: "" },
    improvement: { type: String, default: "" },
    score:       { type: Number, default: 0 },
    dimensions:  { type: dimensionSchema, default: () => ({}) },
    deliveryMetrics: { type: deliveryMetricsSchema, default: null },
    deliveryFeedback: { type: [String], default: [] },
  },
  { _id: false }
);

const reportSchema = new mongoose.Schema(
  {
    strengths:          { type: [String], default: [] },
    improvements:       { type: [String], default: [] },
    suggestedResources: { type: [String], default: [] },
    recommendation:     { type: String, default: "" },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    role:         { type: String, default: "" },
    title:        { type: String, default: "Mock Interview" },
    persona: { type: String, enum: ["friendly", "strict", "technical", "behavioral", "mixed"], default: "mixed" },
    questions:    { type: [questionSchema], default: [] },
    overallScore:  { type: Number, default: 0 },
    followupCount: { type: Number, default: 0 },
    report:        { type: reportSchema, default: () => ({}) },
    startedAt:    { type: Date, default: Date.now },
    completedAt:  { type: Date, default: null },
    isPublic:     { type: Boolean, default: false },
  },
  { timestamps: true }
);

const InterviewSession = mongoose.model("InterviewSession", interviewSessionSchema);

export default InterviewSession;
