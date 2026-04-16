import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    question: String,
    orderIndex: Number,
    userAnswer: { type: String, default: "" },
    aiFeedback: { type: String, default: "" },
    score: { type: Number, default: 0 },
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
    role: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      default: "Mock Interview",
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
    overallScore: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const InterviewSession = mongoose.model("InterviewSession", interviewSessionSchema);

export default InterviewSession;