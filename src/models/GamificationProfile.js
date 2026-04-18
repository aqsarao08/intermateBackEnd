import mongoose from "mongoose";

const badgeSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true },
    name:        { type: String, default: "" },
    category:    { type: String, default: "general" },
    description: { type: String, default: "" },
    earnedAt:    { type: Date,   default: Date.now },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const missionSchema = new mongoose.Schema(
  {
    id:        { type: String, required: true },
    title:     { type: String, default: "" },
    type:      { type: String, default: "general" },
    target:    { type: Number, default: 1 },
    current:   { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    xpReward:  { type: Number, default: 25 },
    claimedAt: { type: Date,   default: null },
  },
  { _id: false }
);

const streakSchema = new mongoose.Schema(
  {
    current:          { type: Number, default: 0 },
    longest:          { type: Number, default: 0 },
    lastActivityDate: { type: String, default: "" }, // YYYY-MM-DD
    freezesAvailable: { type: Number, default: 1 },
  },
  { _id: false }
);

const xpLogSchema = new mongoose.Schema(
  {
    action:      { type: String, default: "" },
    xp:          { type: Number, default: 0 },
    description: { type: String, default: "" },
    timestamp:   { type: Date,   default: Date.now },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const cooldownSchema = new mongoose.Schema(
  {
    key:           { type: String, required: true },
    count:         { type: Number, default: 1 },
    date:          { type: String, default: "" }, // YYYY-MM-DD
    lastAwardedAt: { type: Date,   default: Date.now },
  },
  { _id: false }
);

const questTaskSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true },
    description: { type: String, default: "" },
    current:     { type: Number, default: 0 },
    target:      { type: Number, default: 1 },
    completed:   { type: Boolean, default: false },
  },
  { _id: false }
);

const questStageSchema = new mongoose.Schema(
  {
    stage:       { type: Number, required: true },
    name:        { type: String, default: "" },
    status:      { type: String, enum: ["locked", "in_progress", "completed"], default: "locked" },
    tasks:       { type: [questTaskSchema], default: [] },
    startedAt:   { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const skillNodeSchema = new mongoose.Schema(
  {
    nodeId:      { type: String, required: true },
    status:      { type: String, enum: ["locked", "unlocked", "in_progress", "completed", "mastered"], default: "locked" },
    completedAt: { type: Date, default: null },
    masteredAt:  { type: Date, default: null },
  },
  { _id: false }
);

const statsSchema = new mongoose.Schema(
  {
    modulesCompleted:       { type: Number,  default: 0 },
    quizzesPassed:          { type: Number,  default: 0 },
    quizPerfectScores:      { type: Number,  default: 0 },
    quizConsecutivePasses:  { type: Number,  default: 0 },
    interviewsCompleted:    { type: Number,  default: 0 },
    labsCompleted:          { type: Number,  default: 0 },
    peerReviewsGiven:       { type: Number,  default: 0 },
    peerReviewsReceived:    { type: Number,  default: 0 },
    projectsCreated:        { type: Number,  default: 0 },
    highestAtsScore:        { type: Number,  default: 0 },
    bestInterviewScore:     { type: Number,  default: 0 },
    hadQuizRetryPass:       { type: Boolean, default: false },
    resumeUploads:          { type: Number,  default: 0 },
    interviewsImproved:     { type: Number,  default: 0 },
    dailyMissionSetsCompleted: { type: Number, default: 0 },
  },
  { _id: false }
);

const bossBattleSchema = new mongoose.Schema(
  {
    stageId:       { type: Number, required: true },
    attempts:      { type: Number, default: 0 },
    dailyAttempts: { type: Number, default: 0 },
    attemptDate:   { type: String, default: "" },
    passed:        { type: Boolean, default: false },
    completedAt:   { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
  },
  { _id: false }
);

const gamificationProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    xp: {
      total:     { type: Number, default: 0 },
      todayXP:   { type: Number, default: 0 },
      todayDate: { type: String, default: "" },
      weekXP:    { type: Number, default: 0 },
      weekStart: { type: String, default: "" },
    },
    level:     { type: Number, default: 1 },
    levelName: { type: String, default: "Intern" },
    badges:    { type: [badgeSchema], default: [] },
    streaks: {
      learning: { type: streakSchema, default: () => ({}) },
      practice: { type: streakSchema, default: () => ({}) },
    },
    missions: {
      daily: {
        date:         { type: String,        default: "" },
        missions:     { type: [missionSchema], default: [] },
        bonusClaimed: { type: Boolean,       default: false },
      },
      weekly: {
        weekStart: { type: String,        default: "" },
        missions:  { type: [missionSchema], default: [] },
      },
    },
    cooldowns:   { type: [cooldownSchema],  default: [] },
    xpLog:       { type: [xpLogSchema],     default: [] },
    careerQuest: {
      currentStage: { type: Number,           default: 1 },
      stages:       { type: [questStageSchema], default: [] },
    },
    bossBattles: { type: [bossBattleSchema], default: [] },
    skillTree: {
      frontend:        { type: [skillNodeSchema], default: [] },
      backend:         { type: [skillNodeSchema], default: [] },
      databases:       { type: [skillNodeSchema], default: [] },
      dsa:             { type: [skillNodeSchema], default: [] },
      cloud_devops:    { type: [skillNodeSchema], default: [] },
      testing:         { type: [skillNodeSchema], default: [] },
      behavioral:      { type: [skillNodeSchema], default: [] },
      cs_fundamentals: { type: [skillNodeSchema], default: [] },
    },
    stats: { type: statsSchema, default: () => ({}) },
    aiCoach: {
      lastGeneratedAt: { type: Date,     default: null },
      encouragement:   { type: String,   default: "" },
      suggestions:     { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

export default mongoose.model("GamificationProfile", gamificationProfileSchema);
