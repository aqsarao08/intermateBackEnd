import mongoose from "mongoose";

const sourceSignalSchema = new mongoose.Schema(
  {
    sourceType: { type: String, default: "" },
    sourceId: { type: String, default: "" },
    category: { type: String, default: "general" },
    skill: { type: String, default: "" },
    signalType: { type: String, default: "" },
    weight: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    roleRelevance: { type: Number, default: 0 },
    evidence: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const weaknessSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    category: { type: String, default: "general" },
    label: { type: String, default: "" },
    severity: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    urgency: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    confidence: { type: Number, default: 0 },
    roleRelevance: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    sourceSignals: { type: [sourceSignalSchema], default: [] },
    missingSkills: { type: [String], default: [] },
    explanation: { type: String, default: "" },
  },
  { _id: false }
);

const objectiveSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: "" },
    category: { type: String, default: "general" },
    priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    linkedWeaknessKeys: { type: [String], default: [] },
    successCriteria: { type: [String], default: [] },
  },
  { _id: false }
);

const moduleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, default: "" },
    objective: { type: String, default: "" },
    whyItMatters: { type: String, default: "" },
    category: { type: String, default: "general" },
    priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    estimatedMinutes: { type: Number, default: 0 },
    prerequisites: { type: [String], default: [] },
    outcomes: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "needs_review"],
      default: "not_started",
    },
    orderIndex: { type: Number, default: 0 },
    resources: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false }
);

const progressSchema = new mongoose.Schema(
  {
    completedModules: { type: Number, default: 0 },
    totalModules: { type: Number, default: 0 },
    readinessScore: { type: Number, default: 0 },
    nextBestActions: { type: [String], default: [] },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const learningPlanSchema = new mongoose.Schema(
  {
    userId: {
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
    targetRole: { type: String, default: "" },
    roleFocus: { type: String, default: "general" },
    diagnosis: {
      weaknesses: { type: [weaknessSchema], default: [] },
      strengths: { type: [String], default: [] },
      generatedAt: { type: Date, default: Date.now },
    },
    objectives: { type: [objectiveSchema], default: [] },
    modules: { type: [moduleSchema], default: [] },
    progress: { type: progressSchema, default: () => ({}) },
    normalizedSignals: { type: [sourceSignalSchema], default: [] },
    sourceSnapshots: {
      resumeAnalysis: { type: mongoose.Schema.Types.Mixed, default: {} },
      interviewFeedback: { type: [mongoose.Schema.Types.Mixed], default: [] },
      quizResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
      codingLabResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

learningPlanSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export default mongoose.model("LearningPlan", learningPlanSchema);
