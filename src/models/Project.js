/**
 * File: src/models/Project.js
 *
 * MongoDB model for job-preparation projects.
 * Enhanced: deep AI analysis fields including section scores,
 * bullet-point rewrites, suggested projects/skills, and career coaching.
 */

import mongoose from "mongoose";

/* ── Sub-schemas ───────────────────────────────────────────────────────────── */

const sectionScoreSchema = new mongoose.Schema(
  {
    section: { type: String, default: "" },           // e.g. "Contact Info", "Summary", "Experience", "Skills", "Education", "Projects"
    score: { type: Number, default: 0 },              // 0–100
    status: { type: String, enum: ["excellent", "good", "needs_improvement", "poor", "missing"], default: "good" },
    feedback: { type: String, default: "" },           // 1–2 sentence explanation
  },
  { _id: false }
);

const bulletRewriteSchema = new mongoose.Schema(
  {
    originalBullet: { type: String, default: "" },
    rewrittenBullet: { type: String, default: "" },
    reason: { type: String, default: "" },            // why the rewrite is better
  },
  { _id: false }
);

const suggestedProjectSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    skills: { type: [String], default: [] },          // legacy alias
    skillsCovered: { type: [String], default: [] },
    whyItHelps: { type: String, default: "" },
    roleFit: { type: String, default: "" },
    resumeValue: { type: String, default: "" },
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "intermediate" },
  },
  { _id: false }
);

const skillRecommendationSchema = new mongoose.Schema(
  {
    skill: { type: String, default: "" },
    category: { type: String, default: "" },
    priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    reason: { type: String, default: "" },
    actionLabel: { type: String, enum: ["Add now", "Learn first", "Build project first"], default: "Learn first" },
    whyItMatters: { type: String, default: "" },
    whereToAppear: { type: String, default: "" },
    evidence: { type: [String], default: [] },
    canAddNow: { type: Boolean, default: false },
  },
  { _id: false }
);

const resumeActionItemSchema = new mongoose.Schema(
  {
    priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    action: { type: String, default: "" },
    rationale: { type: String, default: "" },
  },
  { _id: false }
);

const improvementSuggestionSchema = new mongoose.Schema(
  {
    section: { type: String, default: "" },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
    },
    text: { type: String, default: "" },
  },
  { _id: false }
);

/* ── Main AI insights schema ───────────────────────────────────────────────── */

const aiInsightsSchema = new mongoose.Schema(
  {
    // ── Core ATS matching ──
    jdKeywords: { type: [String], default: [] },
    jdRequiredSkills: { type: [String], default: [] },
    jdNiceToHave: { type: [String], default: [] },
    jdSeniority: { type: String, default: "" },
    resumeMatchScore: { type: Number, default: 0 },
    atsScore: { type: Number, default: 0 },
    matchLevel: { type: String, enum: ["strong", "moderate", "weak"], default: "weak" },
    missingKeywords: { type: [String], default: [] },
    matchedKeywords: { type: [String], default: [] },
    hardRequirementsMatched: { type: [String], default: [] },
    hardRequirementsMissing: { type: [String], default: [] },
    preferredRequirementsMissing: { type: [String], default: [] },

    // ── Section-by-section scoring ──
    sectionScores: { type: [sectionScoreSchema], default: [] },

    // ── Strengths & weaknesses (detailed) ──
    resumeStrengths: { type: [String], default: [] },
    resumeWeaknesses: { type: [String], default: [] },

    // ── ATS formatting suggestions ──
    atsSuggestions: { type: [String], default: [] },

    // ── Section-level improvement suggestions ──
    improvementSuggestions: { type: [improvementSuggestionSchema], default: [] },

    // ── AI bullet-point rewrites ──
    bulletRewrites: { type: [bulletRewriteSchema], default: [] },

    // ── Skills gap analysis ──
    skillsToLearn: { type: [String], default: [] },         // specific skills to acquire
    suggestedCertifications: { type: [String], default: [] },

    // ── Suggested projects to build ──
    suggestedProjects: { type: [suggestedProjectSchema], default: [] },
    projectSuggestions: { type: [suggestedProjectSchema], default: [] },
    missingSkillGroups: { type: mongoose.Schema.Types.Mixed, default: {} },
    skillRecommendations: { type: [skillRecommendationSchema], default: [] },
    learningPriority: { type: mongoose.Schema.Types.Mixed, default: {} },
    resumeActionPlan: { type: [resumeActionItemSchema], default: [] },
    optimizedSummary: { type: String, default: "" },
    structureSuggestions: { type: [String], default: [] },
    analysisMeta: { type: mongoose.Schema.Types.Mixed, default: {} },

    // ── Career coaching summary ──
    careerCoachSummary: { type: String, default: "" },       // 3–5 sentence narrative advice

    // ── Score breakdown ──
    scoreBreakdown: {
      keywordMatch: { type: Number, default: 0 },
      hardRequirementCoverage: { type: Number, default: 0 },
      semanticSimilarity: { type: Number, default: 0 },
      experienceAlignment: { type: Number, default: 0 },
      projectRelevance: { type: Number, default: 0 },
      formattingSectionQuality: { type: Number, default: 0 },
      experienceRelevance: { type: Number, default: 0 },
      formatting: { type: Number, default: 0 },
      completeness: { type: Number, default: 0 },
    },

    // ── Tracking ──
    topicWeaknessMap: { type: [String], default: [] },
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "done", "failed"],
      default: "pending",
    },
    processedAt: { type: Date, default: null },
  },
  { _id: false }
);

/* ── Outcome schema ────────────────────────────────────────────────────────── */

const outcomeSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["applied", "interviewing", "offer", "rejected", "accepted", "withdrawn"],
      default: "applied",
    },
    notes: { type: String, default: "" },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

/* ── Project schema ────────────────────────────────────────────────────────── */

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    companyName: { type: String, default: "", trim: true },
    jobRole: { type: String, default: "", trim: true },
    jobDescription: { type: String, default: "" },
    resumeFileUrl: { type: String, default: "" },
    resumeText: { type: String, default: "" },
    aiInsights: { type: aiInsightsSchema, default: () => ({}) },
    outcome: { type: outcomeSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

export default Project;
