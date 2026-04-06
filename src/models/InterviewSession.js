import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    question: String,
    userAnswer: String,
    aiFeedback: String,
    score: Number,
    orderIndex: Number,
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: String,
    title: String,
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    overallScore: Number,
    questions: [questionSchema],
  },
  { timestamps: true }
);

export default mongoose.model("InterviewSession", interviewSessionSchema);
