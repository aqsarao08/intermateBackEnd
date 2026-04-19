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

const quizQuestionSchema = new mongoose.Schema(
  {
    id:             { type: String, required: true },
    question:       { type: String, default: "" },
    options:        { type: [String], default: [] },
    correctIndex:   { type: Number, default: 0 },
    explanation:    { type: String, default: "" },
    difficulty:     { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    conceptTested:  { type: String, default: "" },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    attemptedAt: { type: Date, default: Date.now },
    score:       { type: Number, default: 0 },
    answers:     { type: [Number], default: [] },
    passed:      { type: Boolean, default: false },
  },
  { _id: false }
);

const resourceSchema = new mongoose.Schema(
  {
    label:    { type: String, default: "" },
    url:      { type: String, default: "" },
    platform: { type: String, default: "" },
    type:     { type: String, enum: ["docs", "video", "course", "practice", "article"], default: "article" },
  },
  { _id: false }
);

const targetedResourceSchema = new mongoose.Schema(
  {
    concept:       { type: String, default: "" },
    label:         { type: String, default: "" },
    url:           { type: String, default: "" },
    platform:      { type: String, default: "" },
    type:          { type: String, enum: ["docs", "video", "course", "article", "practice"], default: "article" },
    whyThisHelps:  { type: String, default: "" },
  },
  { _id: false }
);

const conceptDiagnosisSchema = new mongoose.Schema(
  {
    skillLevel:        { type: String, enum: ["beginner", "intermediate", "advanced"], default: "beginner" },
    scorePct:          { type: Number, default: 0 },
    conceptsKnown:     { type: [String], default: [] },
    conceptsWeak:      { type: [String], default: [] },
    targetedResources: { type: [targetedResourceSchema], default: [] },
    summary:           { type: String, default: "" },
    diagnosedAt:       { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectRecommendationSchema = new mongoose.Schema(
  {
    title:               { type: String, default: "" },
    description:         { type: String, default: "" },
    difficulty:          { type: String, enum: ["beginner", "intermediate", "advanced"], default: "intermediate" },
    estimatedHours:      { type: Number, default: 20 },
    primarySkill:        { type: String, default: "" },
    relatedSkills:       { type: [String], default: [] },
    whyThisProject:      { type: String, default: "" },
    steps:               { type: [String], default: [] },
    weakAreasAddressed:  { type: [String], default: [] },
  },
  { _id: false }
);

const moduleSchema = new mongoose.Schema(
  {
    id:               { type: String, required: true },
    title:            { type: String, default: "" },
    objective:        { type: String, default: "" },
    whyItMatters:     { type: String, default: "" },
    category:         { type: String, default: "general" },
    priority:         { type: String, enum: ["high", "medium", "low"], default: "medium" },
    estimatedMinutes: { type: Number, default: 0 },
    prerequisites:    { type: [String], default: [] },
    outcomes:         { type: [String], default: [] },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "needs_review"],
      default: "not_started",
    },
    orderIndex:       { type: Number, default: 0 },
    resources:        { type: [resourceSchema], default: [] },
    quiz:             { type: [quizQuestionSchema], default: [] },
    quizAttempts:     { type: [quizAttemptSchema], default: [] },
    bestQuizScore:    { type: Number, default: null },
    conceptDiagnosis: { type: conceptDiagnosisSchema, default: null },
    labSpec: {
      title:         { type: String, default: "" },
      description:   { type: String, default: "" },
      starterPrompt: { type: String, default: "" },
      difficulty:    { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
      platformHint:  { type: String, default: "" },
      completed:     { type: Boolean, default: false },
    },
    enriched: { type: Boolean, default: false },
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
    projectRecommendations: { type: [projectRecommendationSchema], default: [] },
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

learningPlanSchema.index({ userId: 1, projectId: 1 }, { unique: true });

export default mongoose.model("LearningPlan", learningPlanSchema);
