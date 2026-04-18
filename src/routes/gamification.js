import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/auth.js";
import {
  getProfile,
  useStreakFreeze,
  recordBossBattle,
  computeNextBestActions,
  fallbackCoachMessage,
  BADGE_DEFINITIONS,
  QUEST_STAGES,
  LEVELS,
} from "../services/gamification.js";
import GamificationProfile from "../models/GamificationProfile.js";
import LearningPlan from "../models/LearningPlan.js";

function calcReadiness(modules = []) {
  const total = modules.length;
  if (total === 0) return 0;
  const completed = modules.filter(m => m.status === "completed").length;
  const quizzed   = modules.filter(m => m.bestQuizScore != null);
  const quizAvg   = quizzed.length ? quizzed.reduce((s, m) => s + m.bestQuizScore, 0) / quizzed.length : 0;
  const labsDone  = modules.filter(m => m.labSpec?.completed).length;
  return Math.round((completed / total) * 50 + (quizAvg / 100) * 35 + (labsDone / total) * 15);
}

let _anthropic = null;
function getAI() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const router = express.Router();

// GET /api/gamification/profile
// Full gamification profile: XP, level, badges, streaks, missions, quest, stats
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.userId);
    return res.json(profile);
  } catch (err) {
    console.error("GET /gamification/profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/summary
// Lightweight dashboard widget data — XP, level, streak, next action
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const raw = await GamificationProfile.findOne({ userId: req.user.userId })
      .select("xp level levelName streaks missions.daily.missions missions.daily.bonusClaimed careerQuest.currentStage badges")
      .lean();

    if (!raw) return res.json({ xp: 0, level: 1, levelName: "Intern", streak: 0, badges: 0 });

    const next = LEVELS.find(l => l.level === raw.level + 1);
    return res.json({
      xp:               raw.xp?.total        || 0,
      todayXP:          raw.xp?.todayXP      || 0,
      level:            raw.level            || 1,
      levelName:        raw.levelName        || "Intern",
      xpToNextLevel:    next ? next.minXP - (raw.xp?.total || 0) : 0,
      nextLevelName:    next?.name           || null,
      learningStreak:   raw.streaks?.learning?.current || 0,
      practiceStreak:   raw.streaks?.practice?.current || 0,
      badgeCount:       (raw.badges || []).length,
      careerQuestStage: raw.careerQuest?.currentStage  || 1,
      dailyMissions:    raw.missions?.daily?.missions  || [],
      allDailyDone:     raw.missions?.daily?.bonusClaimed || false,
    });
  } catch (err) {
    console.error("GET /gamification/summary error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/missions
router.get("/missions", requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.userId);
    return res.json({
      daily:  profile.missions?.daily  || {},
      weekly: profile.missions?.weekly || {},
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/badges
// Returns earned badges + all badge definitions (for badge wall)
router.get("/badges", requireAuth, async (req, res) => {
  try {
    const raw = await GamificationProfile.findOne({ userId: req.user.userId })
      .select("badges")
      .lean();
    const earned = raw?.badges || [];
    const earnedIds = new Set(earned.map(b => b.id));
    return res.json({
      earned,
      all: BADGE_DEFINITIONS.map(def => ({
        ...def,
        isEarned: earnedIds.has(def.id),
        earnedAt: earned.find(b => b.id === def.id)?.earnedAt || null,
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/career-quest
router.get("/career-quest", requireAuth, async (req, res) => {
  try {
    const profile = await getProfile(req.user.userId);
    return res.json({
      currentStage: profile.careerQuest?.currentStage || 1,
      stages:       profile.careerQuest?.stages       || [],
      definitions:  QUEST_STAGES,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/skill-tree
router.get("/skill-tree", requireAuth, async (req, res) => {
  try {
    const raw = await GamificationProfile.findOne({ userId: req.user.userId })
      .select("skillTree")
      .lean();
    return res.json(raw?.skillTree || {});
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// PATCH /api/gamification/skill-tree/:category/:nodeId
router.patch("/skill-tree/:category/:nodeId", requireAuth, async (req, res) => {
  try {
    const { category, nodeId } = req.params;
    const { status } = req.body;
    const validStatuses = ["locked", "unlocked", "in_progress", "completed", "mastered"];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const profile = await GamificationProfile.findOne({ userId: req.user.userId });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const tree = profile.skillTree[category];
    if (!Array.isArray(tree)) return res.status(400).json({ message: "Invalid category" });

    let node = tree.find(n => n.nodeId === nodeId);
    if (!node) { tree.push({ nodeId, status }); node = tree[tree.length - 1]; }
    else        { node.status = status; }

    if (status === "completed")  node.completedAt = new Date();
    if (status === "mastered")   node.masteredAt  = new Date();

    await profile.save();
    return res.json({ nodeId, category, status });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/streaks
router.get("/streaks", requireAuth, async (req, res) => {
  try {
    const raw = await GamificationProfile.findOne({ userId: req.user.userId })
      .select("streaks")
      .lean();
    return res.json(raw?.streaks || {});
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/gamification/streak/freeze
router.post("/streak/freeze", requireAuth, async (req, res) => {
  try {
    const result = await useStreakFreeze(req.user.userId);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// POST /api/gamification/boss-battle/:stageId/attempt
router.post("/boss-battle/:stageId/attempt", requireAuth, async (req, res) => {
  try {
    const stageId = parseInt(req.params.stageId, 10);
    const { passed } = req.body;
    if (typeof passed !== "boolean") return res.status(400).json({ message: "passed (boolean) is required" });
    const result = await recordBossBattle(req.user.userId, stageId, passed);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
});

// GET /api/gamification/xp-log?limit=20
router.get("/xp-log", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
    const raw = await GamificationProfile.findOne({ userId: req.user.userId })
      .select("xpLog")
      .lean();
    return res.json({ log: (raw?.xpLog || []).slice(0, limit) });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/leaderboard
router.get("/leaderboard", requireAuth, async (req, res) => {
  try {
    const top = await GamificationProfile.find({})
      .select("userId xp.total level levelName badges")
      .sort({ "xp.total": -1 })
      .limit(20)
      .populate("userId", "name")
      .lean();

    return res.json({
      leaderboard: top.map((p, i) => ({
        rank:      i + 1,
        name:      p.userId?.name || "Unknown",
        xp:        p.xp?.total   || 0,
        level:     p.level       || 1,
        levelName: p.levelName   || "Intern",
        badgeCount: (p.badges || []).length,
      })),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/readiness
// Aggregates readiness score across ALL user projects' learning plans
router.get("/readiness", requireAuth, async (req, res) => {
  try {
    const plans = await LearningPlan.find({ userId: req.user.userId })
      .select("projectId targetRole modules")
      .lean();

    if (plans.length === 0) return res.json({ globalReadiness: 0, projects: [] });

    const projects = plans.map(p => {
      const modules = p.modules || [];
      const readiness = calcReadiness(modules);
      return {
        projectId:  String(p.projectId),
        targetRole: p.targetRole || "Unknown Role",
        readiness,
        completed:  modules.filter(m => m.status === "completed").length,
        total:      modules.length,
      };
    });

    const globalReadiness = Math.round(
      projects.reduce((s, p) => s + p.readiness, 0) / projects.length
    );

    return res.json({ globalReadiness, projects });
  } catch (err) {
    console.error("GET /gamification/readiness error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/next-best-action
router.get("/next-best-action", requireAuth, async (req, res) => {
  try {
    const raw = await GamificationProfile.findOne({ userId: req.user.userId })
      .select("stats missions streaks")
      .lean();
    if (!raw) return res.json({ actions: [] });
    const actions = computeNextBestActions(raw.stats, raw.missions?.daily, raw.streaks);
    return res.json({ actions });
  } catch (err) {
    console.error("GET /gamification/next-best-action error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/coach
// Returns AI-generated coaching text, cached 24 h in the profile document
router.get("/coach", requireAuth, async (req, res) => {
  try {
    const profile = await GamificationProfile.findOne({ userId: req.user.userId })
      .select("stats level levelName aiCoach streaks");
    if (!profile) return res.json({ message: fallbackCoachMessage({}, 0), suggestions: [], cached: false });

    const CACHE_TTL = 24 * 60 * 60 * 1000;
    const now       = Date.now();
    const cached    = profile.aiCoach?.lastGeneratedAt
      && (now - new Date(profile.aiCoach.lastGeneratedAt).getTime()) < CACHE_TTL
      && profile.aiCoach.encouragement;

    if (cached) {
      return res.json({
        message:     profile.aiCoach.encouragement,
        suggestions: profile.aiCoach.suggestions ?? [],
        cached:      true,
      });
    }

    const s      = profile.stats;
    const streak = profile.streaks?.learning?.current ?? 0;
    let message      = fallbackCoachMessage(s, streak);
    let suggestions  = [];

    const ai = getAI();
    if (ai) {
      const ctx = `Level ${profile.level} (${profile.levelName}). Modules: ${s.modulesCompleted}. Quizzes passed: ${s.quizzesPassed}. Interviews: ${s.interviewsCompleted}. Streak: ${streak} days. Peer reviews: ${s.peerReviewsGiven}.`;
      try {
        const [encResp, sugResp] = await Promise.all([
          ai.messages.create({
            model:      "claude-haiku-4-5-20251001",
            max_tokens: 120,
            messages:   [{ role: "user", content: `You are a supportive career coach for an interview-prep app. Write exactly 2 sentences of personalized encouragement for this user. Be specific and motivating. User stats: ${ctx}. Output ONLY the 2 sentences, nothing else.` }],
          }),
          ai.messages.create({
            model:      "claude-haiku-4-5-20251001",
            max_tokens: 100,
            messages:   [{ role: "user", content: `Based on: ${ctx} — give exactly 2 short next-step suggestions (max 8 words each) for this user. Reply ONLY with a JSON array of 2 strings, e.g. ["do X", "try Y"].` }],
          }),
        ]);
        message = encResp.content[0]?.text?.trim() || message;
        try { suggestions = JSON.parse(sugResp.content[0]?.text?.trim() ?? "[]"); } catch (_) {}
      } catch (_) { /* keep fallback */ }
    }

    profile.aiCoach = { lastGeneratedAt: new Date(), encouragement: message, suggestions };
    await profile.save();

    return res.json({ message, suggestions, cached: false });
  } catch (err) {
    console.error("GET /gamification/coach error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/contributions
// XP breakdown by action type from xpLog
router.get("/contributions", requireAuth, async (req, res) => {
  try {
    const raw = await GamificationProfile.findOne({ userId: req.user.userId })
      .select("xpLog")
      .lean();

    const log = raw?.xpLog ?? [];
    const byAction = {};
    for (const e of log) {
      byAction[e.action] = (byAction[e.action] ?? 0) + e.xp;
    }

    // Sort descending by XP
    const ranked = Object.entries(byAction)
      .map(([action, xp]) => ({ action, xp }))
      .sort((a, b) => b.xp - a.xp);

    return res.json({ byAction: ranked, totalEntries: log.length });
  } catch (err) {
    console.error("GET /gamification/contributions error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/gamification/stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const raw = await GamificationProfile.findOne({ userId: req.user.userId })
      .select("stats xp level levelName")
      .lean();
    const empty = {
      modulesCompleted: 0, quizzesPassed: 0, quizPerfectScores: 0,
      interviewsCompleted: 0, labsCompleted: 0, peerReviewsGiven: 0,
      highestAtsScore: 0, bestInterviewScore: 0, resumeUploads: 0,
      projectsCreated: 0, hadQuizRetryPass: false,
    };
    return res.json({
      stats:     raw?.stats     || empty,
      xp:        raw?.xp        || { total: 0, todayXP: 0, weekXP: 0 },
      level:     raw?.level     || 1,
      levelName: raw?.levelName || "Intern",
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
