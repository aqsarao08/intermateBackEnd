import GamificationProfile from "../models/GamificationProfile.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAILY_XP_CAP = 500;

const LEVELS = [
  { level: 1,  name: "Intern",             minXP: 0      },
  { level: 2,  name: "Junior Applicant",   minXP: 150    },
  { level: 3,  name: "Resume Builder",     minXP: 350    },
  { level: 4,  name: "Interview Novice",   minXP: 650    },
  { level: 5,  name: "Skill Seeker",       minXP: 1100   },
  { level: 6,  name: "Certified Learner",  minXP: 1700   },
  { level: 7,  name: "Tech Explorer",      minXP: 2500   },
  { level: 8,  name: "Code Crafter",       minXP: 3500   },
  { level: 9,  name: "Interview Ready",    minXP: 5000   },
  { level: 10, name: "Problem Solver",     minXP: 7000   },
  { level: 11, name: "Career Navigator",   minXP: 9500   },
  { level: 12, name: "Junior Dev",         minXP: 12500  },
  { level: 13, name: "Rising Engineer",    minXP: 16500  },
  { level: 14, name: "Full Stack Learner", minXP: 21000  },
  { level: 15, name: "Tech Specialist",    minXP: 27000  },
  { level: 16, name: "Senior Applicant",   minXP: 34000  },
  { level: 17, name: "Career Accelerator", minXP: 43000  },
  { level: 18, name: "Offer Machine",      minXP: 54000  },
  { level: 19, name: "Industry Ready",     minXP: 67000  },
  { level: 20, name: "Career Champion",    minXP: 82000  },
];

const QUEST_STAGES = [
  {
    stage: 1, name: "Foundation", xpReward: 250,
    tasks: [
      { id: "create_project",  description: "Create a job application project", target: 1, triggers: ["project_create"]                     },
      { id: "upload_resume",   description: "Upload your resume",               target: 1, triggers: ["resume_upload"]                      },
      { id: "first_interview", description: "Complete a mock interview",        target: 1, triggers: ["interview_complete"]                  },
    ],
  },
  {
    stage: 2, name: "Skill Builder", xpReward: 300,
    tasks: [
      { id: "modules_5",  description: "Complete 5 learning modules", target: 5, triggers: ["module_complete"]                              },
      { id: "quizzes_3",  description: "Pass 3 quizzes",              target: 3, triggers: ["quiz_pass", "quiz_retry_pass"]                 },
      { id: "ats_50",     description: "Reach ATS score ≥ 50",        target: 1, triggers: ["resume_upload"], atsThreshold: 50              },
    ],
  },
  {
    stage: 3, name: "Interview Prep", xpReward: 400,
    tasks: [
      { id: "interviews_5",  description: "Complete 5 mock interviews",   target: 5, triggers: ["interview_complete"]                       },
      { id: "score_improve", description: "Improve your interview score", target: 1, triggers: ["interview_improve"]                        },
    ],
  },
  {
    stage: 4, name: "Resume Pro", xpReward: 500,
    tasks: [
      { id: "ats_70",   description: "Reach ATS score ≥ 70",     target: 1, triggers: ["resume_upload"], atsThreshold: 70                  },
      { id: "refine_3", description: "Re-upload resume 3 times", target: 3, triggers: ["resume_upload"]                                    },
    ],
  },
  {
    stage: 5, name: "Tech Deep Dive", xpReward: 600,
    tasks: [
      { id: "modules_10", description: "Complete 10 learning modules", target: 10, triggers: ["module_complete"]                            },
      { id: "quizzes_5",  description: "Pass 5 quizzes",              target: 5,  triggers: ["quiz_pass", "quiz_retry_pass"]                },
      { id: "labs_2",     description: "Complete 2 coding labs",      target: 2,  triggers: ["lab_complete"]                               },
    ],
  },
  {
    stage: 6, name: "Boss Battle", xpReward: 800,
    tasks: [
      { id: "boss_pass", description: "Pass the Boss Battle challenge", target: 1, triggers: ["boss_battle_pass"]                          },
    ],
  },
  {
    stage: 7, name: "Offer Ready", xpReward: 1000,
    tasks: [
      { id: "ats_80",       description: "Reach ATS score ≥ 80",   target: 1, triggers: ["resume_upload"], atsThreshold: 80               },
      { id: "peer_review",  description: "Submit a peer review",    target: 1, triggers: ["peer_review_given"]                            },
    ],
  },
];

const DAILY_MISSION_POOL = [
  { id: "dm_module",    title: "Complete a learning module",  type: "module_complete",    target: 1, xpReward: 50 },
  { id: "dm_quiz",      title: "Pass a quiz",                 type: "quiz_pass",          target: 1, xpReward: 40 },
  { id: "dm_interview", title: "Complete a mock interview",   type: "interview_complete", target: 1, xpReward: 60 },
  { id: "dm_lab",       title: "Complete a coding lab",       type: "lab_complete",       target: 1, xpReward: 50 },
  { id: "dm_peer",      title: "Submit a peer review",        type: "peer_review_given",  target: 1, xpReward: 40 },
  { id: "dm_2modules",  title: "Complete 2 learning modules", type: "module_complete",    target: 2, xpReward: 75 },
];

const WEEKLY_MISSION_POOL = [
  { id: "wm_5modules",    title: "Complete 5 learning modules", type: "module_complete",    target: 5, xpReward: 200 },
  { id: "wm_3quizzes",    title: "Pass 3 quizzes",              type: "quiz_pass",          target: 3, xpReward: 150 },
  { id: "wm_3interviews", title: "Complete 3 mock interviews",  type: "interview_complete", target: 3, xpReward: 200 },
  { id: "wm_2labs",       title: "Complete 2 coding labs",      type: "lab_complete",       target: 2, xpReward: 150 },
];

const BADGE_DEFINITIONS = [
  // Resume
  { id: "first_upload",      name: "First Upload",           category: "resume",      description: "Uploaded your first resume"                   },
  { id: "ats_starter",       name: "ATS Starter",            category: "resume",      description: "Reached ATS score of 50+"                     },
  { id: "ats_optimizer",     name: "ATS Optimizer",          category: "resume",      description: "Reached ATS score of 70+"                     },
  { id: "ats_master",        name: "ATS Master",             category: "resume",      description: "Reached ATS score of 90+"                     },
  // Learning
  { id: "first_module",      name: "First Step",             category: "learning",    description: "Completed your first learning module"         },
  { id: "modules_5",         name: "Quick Learner",          category: "learning",    description: "Completed 5 learning modules"                  },
  { id: "modules_25",        name: "Knowledge Hoarder",      category: "learning",    description: "Completed 25 total modules"                    },
  // Quiz
  { id: "first_quiz",        name: "Quiz Taker",             category: "quiz",        description: "Passed your first quiz"                        },
  { id: "quiz_perfect",      name: "Sharp Mind",             category: "quiz",        description: "Scored 100% on a quiz"                         },
  { id: "quiz_retry",        name: "Second Chance",          category: "quiz",        description: "Failed, then passed the same quiz"             },
  { id: "quiz_10",           name: "Quiz Champion",          category: "quiz",        description: "Passed 10 quizzes"                             },
  // Interview
  { id: "first_interview",   name: "First Interview",        category: "interview",   description: "Completed your first mock interview"           },
  { id: "interviews_10",     name: "Practice Makes Perfect", category: "interview",   description: "Completed 10 mock interviews"                  },
  { id: "interviews_25",     name: "Interview Marathon",     category: "interview",   description: "Completed 25 mock interviews"                  },
  { id: "score_booster",     name: "Score Booster",          category: "interview",   description: "Improved interview score by 20%+"              },
  // Streaks
  { id: "streak_3",          name: "3-Day Streak",           category: "streak",      description: "3 consecutive learning days"                   },
  { id: "streak_7",          name: "Week Warrior",           category: "streak",      description: "7-day learning streak"                         },
  { id: "streak_30",         name: "Month Master",           category: "streak",      description: "30-day learning streak"                        },
  { id: "streak_60",         name: "Unbreakable",            category: "streak",      description: "60-day learning streak"                        },
  // Peer review
  { id: "first_peer",        name: "Helpful Peer",           category: "peer_review", description: "Submitted your first peer review"              },
  { id: "peer_5",            name: "Community Contributor",  category: "peer_review", description: "Submitted 5 peer reviews"                      },
  // CareerQuest stages
  { id: "quest_s1",          name: "Foundation Complete",    category: "quest",       description: "Completed the Foundation stage"                },
  { id: "quest_s2",          name: "Skill Builder",          category: "quest",       description: "Completed the Skill Builder stage"             },
  { id: "quest_s3",          name: "Interview Prepped",      category: "quest",       description: "Completed the Interview Prep stage"            },
  { id: "quest_s4",          name: "Resume Pro",             category: "quest",       description: "Completed the Resume Pro stage"                },
  { id: "quest_s5",          name: "Tech Specialist",        category: "quest",       description: "Completed the Tech Deep Dive stage"            },
  { id: "quest_s6",          name: "Boss Slayer",            category: "quest",       description: "Passed the Boss Battle"                        },
  { id: "quest_s7",          name: "Career Champion",        category: "quest",       description: "Completed all CareerQuest stages"              },
  // Levels
  { id: "level_5",           name: "Skill Seeker",           category: "level",       description: "Reached Level 5"                               },
  { id: "level_10",          name: "Problem Solver",         category: "level",       description: "Reached Level 10"                              },
  { id: "level_20",          name: "Career Champion",        category: "level",       description: "Reached Level 20"                              },
  // Labs
  { id: "first_lab",         name: "Lab Rat",                category: "learning",    description: "Completed your first coding lab"               },
  { id: "labs_5",            name: "Code Crafter",           category: "learning",    description: "Completed 5 coding labs"                       },
  // More quiz badges
  { id: "perfectionist",  name: "Perfectionist",       category: "quiz",        description: "Scored 100% on 3 separate quizzes"      },
  { id: "quiz_25",        name: "Quiz Addict",          category: "quiz",        description: "Passed 25 quizzes"                       },
  // More interview badges
  { id: "comeback_kid",   name: "Comeback Kid",         category: "interview",   description: "Improved your interview score by 20%+"   },
  { id: "communication_pro", name: "Communication Pro", category: "interview",   description: "Scored 90%+ on a mock interview"         },
  // More peer badges
  { id: "peer_mentor",    name: "Community Mentor",     category: "peer_review", description: "Submitted 10 peer reviews"               },
  // More resume badges
  { id: "resume_reviser", name: "Resume Reviser",       category: "resume",      description: "Re-uploaded your resume 5 times"         },
  // More streak badges
  { id: "streak_14",      name: "Fortnight Fighter",    category: "streak",      description: "Maintained a 14-day learning streak"     },
];

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartStr() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

// ── Level helpers ─────────────────────────────────────────────────────────────

function getLevelForXP(xp) {
  let result = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXP) result = lvl;
    else break;
  }
  return result;
}

export function getLevelInfo(xp) {
  const current = getLevelForXP(xp);
  const next = LEVELS.find(l => l.level === current.level + 1) || null;
  return {
    level: current.level,
    levelName: current.name,
    xpForNext: next ? next.minXP - xp : 0,
    nextLevelName: next?.name || null,
    progressPercent: next
      ? Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100)
      : 100,
  };
}

// ── Cooldown ──────────────────────────────────────────────────────────────────

function checkCooldown(profile, key, maxCount = 1) {
  const today = todayStr();
  const existing = profile.cooldowns.find(c => c.key === key && c.date === today);
  return !existing || existing.count < maxCount;
}

function recordCooldown(profile, key) {
  const today = todayStr();
  const existing = profile.cooldowns.find(c => c.key === key && c.date === today);
  if (existing) {
    existing.count += 1;
    existing.lastAwardedAt = new Date();
  } else {
    profile.cooldowns.push({ key, count: 1, date: today, lastAwardedAt: new Date() });
  }
  // Prune entries older than 60 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  profile.cooldowns = profile.cooldowns.filter(c => new Date(c.date) > cutoff);
}

// ── XP calculation ────────────────────────────────────────────────────────────

function calculateXP(action, metadata = {}) {
  switch (action) {
    case "module_complete":
      return metadata.priority === "high" ? 75 : 50;
    case "quiz_pass":
      if (metadata.score >= 100) return 75;
      if (metadata.score >= 80)  return 50;
      return 30;
    case "quiz_retry_pass":
      return 40;
    case "lab_complete":
      return metadata.difficulty === "hard" ? 90 : 60;
    case "interview_complete":
      return 80;
    case "interview_improve":
      return 25;
    case "resume_upload": {
      const { newAtsScore = 0, previousAtsScore = 0 } = metadata;
      if (newAtsScore >= 90 && previousAtsScore < 90) return 200;
      if (newAtsScore >= 70 && previousAtsScore < 70) return 100;
      if (newAtsScore > previousAtsScore + 4)         return 30;
      return 10; // base reward just for uploading
    }
    case "peer_review_given":   return 40;
    case "peer_review_received": return 20;
    case "project_create":      return 50;
    case "boss_battle_pass":    return 175;
    default:                    return 0;
  }
}

// ── Daily XP cap tracker ──────────────────────────────────────────────────────

function addXP(profile, amount) {
  if (amount <= 0) return 0;
  const today = todayStr();
  if (profile.xp.todayDate !== today) {
    profile.xp.todayXP  = 0;
    profile.xp.todayDate = today;
  }
  const remaining = Math.max(0, DAILY_XP_CAP - profile.xp.todayXP);
  const actual    = Math.min(amount, remaining);
  if (actual <= 0) return 0;
  profile.xp.todayXP += actual;
  profile.xp.total   += actual;
  // Week XP
  const ws = weekStartStr();
  if (profile.xp.weekStart !== ws) { profile.xp.weekXP = 0; profile.xp.weekStart = ws; }
  profile.xp.weekXP += actual;
  return actual;
}

function logXP(profile, action, xp, description, metadata = {}) {
  if (xp <= 0) return;
  profile.xpLog.unshift({ action, xp, description, timestamp: new Date(), metadata });
  if (profile.xpLog.length > 100) profile.xpLog = profile.xpLog.slice(0, 100);
}

// ── Level up ──────────────────────────────────────────────────────────────────

function applyLevelUp(profile) {
  const lvl = getLevelForXP(profile.xp.total);
  const didLevel = lvl.level > profile.level;
  profile.level     = lvl.level;
  profile.levelName = lvl.name;
  return didLevel;
}

// ── Streaks ───────────────────────────────────────────────────────────────────

function tickStreak(streakData) {
  const today = todayStr();
  if (streakData.lastActivityDate === today) return false; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (streakData.lastActivityDate === yesterdayStr) {
    streakData.current += 1;
  } else if (streakData.lastActivityDate) {
    const last   = new Date(streakData.lastActivityDate);
    const diffMs = Date.now() - last.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 2 && streakData.freezesAvailable > 0) {
      streakData.freezesAvailable -= 1;
      streakData.current += 1;
    } else {
      streakData.current = 1;
    }
  } else {
    streakData.current = 1;
  }

  if (streakData.current > streakData.longest) streakData.longest = streakData.current;
  streakData.lastActivityDate = today;
  return true; // ticked
}

// ── Missions ──────────────────────────────────────────────────────────────────

function ensureDailyMissions(profile) {
  const today = todayStr();
  if (profile.missions.daily.date === today) return false;
  const seed   = parseInt(today.replace(/-/g, ""), 10);
  const sorted = [...DAILY_MISSION_POOL].sort((a, b) => {
    const ha = (seed * (a.id.charCodeAt(0) + 1)) % 1000;
    const hb = (seed * (b.id.charCodeAt(0) + 1)) % 1000;
    return ha - hb;
  });
  profile.missions.daily = {
    date:         today,
    missions:     sorted.slice(0, 3).map(m => ({ ...m, current: 0, completed: false, claimedAt: null })),
    bonusClaimed: false,
  };
  return true;
}

function ensureWeeklyMissions(profile) {
  const ws = weekStartStr();
  if (profile.missions.weekly.weekStart === ws) return false;
  const seed   = parseInt(ws.replace(/-/g, ""), 10);
  const sorted = [...WEEKLY_MISSION_POOL].sort((a, b) => {
    const ha = (seed * (a.id.charCodeAt(0) + 1)) % 1000;
    const hb = (seed * (b.id.charCodeAt(0) + 1)) % 1000;
    return ha - hb;
  });
  profile.missions.weekly = {
    weekStart: ws,
    missions:  sorted.slice(0, 2).map(m => ({ ...m, current: 0, completed: false, claimedAt: null })),
  };
  return true;
}

function progressMissions(profile, action) {
  let bonus = 0;
  const match = (mType) =>
    mType === action ||
    (action === "quiz_retry_pass" && mType === "quiz_pass");

  for (const m of profile.missions.daily.missions) {
    if (m.completed) continue;
    if (!match(m.type)) continue;
    m.current = Math.min(m.current + 1, m.target);
    if (m.current >= m.target) { m.completed = true; m.claimedAt = new Date(); bonus += m.xpReward; }
  }

  const allDone = profile.missions.daily.missions.every(m => m.completed);
  if (allDone && !profile.missions.daily.bonusClaimed) {
    profile.missions.daily.bonusClaimed = true;
    bonus += 75;
    profile.stats.dailyMissionSetsCompleted += 1;
  }

  for (const m of profile.missions.weekly.missions) {
    if (m.completed) continue;
    if (!match(m.type)) continue;
    m.current = Math.min(m.current + 1, m.target);
    if (m.current >= m.target) { m.completed = true; m.claimedAt = new Date(); bonus += m.xpReward; }
  }

  return bonus;
}

// ── CareerQuest ───────────────────────────────────────────────────────────────

function initCareerQuest(profile) {
  if (profile.careerQuest.stages.length > 0) return;
  profile.careerQuest.stages = QUEST_STAGES.map((s, i) => ({
    stage:       s.stage,
    name:        s.name,
    status:      i === 0 ? "in_progress" : "locked",
    startedAt:   i === 0 ? new Date() : null,
    completedAt: null,
    tasks: s.tasks.map(t => ({ id: t.id, description: t.description, target: t.target, current: 0, completed: false })),
  }));
  profile.careerQuest.currentStage = 1;
}

function progressCareerQuest(profile, action, metadata) {
  const completed = [];
  const stage = profile.careerQuest.stages.find(s => s.status === "in_progress");
  if (!stage) return completed;

  const stageCfg = QUEST_STAGES.find(s => s.stage === stage.stage);
  if (!stageCfg) return completed;

  let changed = false;
  for (const task of stage.tasks) {
    if (task.completed) continue;
    const cfg = stageCfg.tasks.find(t => t.id === task.id);
    if (!cfg) continue;

    // ATS threshold tasks
    if (cfg.atsThreshold && cfg.triggers.includes("resume_upload") && action === "resume_upload") {
      if ((metadata.newAtsScore || 0) >= cfg.atsThreshold) {
        task.current = task.target;
        task.completed = true;
        changed = true;
      }
      continue;
    }

    if (cfg.triggers.includes(action) || (action === "quiz_retry_pass" && cfg.triggers.includes("quiz_pass"))) {
      task.current = Math.min(task.current + 1, task.target);
      if (task.current >= task.target) { task.completed = true; changed = true; }
    }
  }

  if (!changed) return completed;

  if (stage.tasks.every(t => t.completed)) {
    stage.status      = "completed";
    stage.completedAt = new Date();
    completed.push({ stage: stage.stage, xpReward: stageCfg.xpReward });

    const next = profile.careerQuest.stages.find(s => s.stage === stage.stage + 1);
    if (next) {
      next.status     = "in_progress";
      next.startedAt  = new Date();
      profile.careerQuest.currentStage = next.stage;
    }
  }

  return completed;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function updateStats(profile, action, metadata) {
  const s = profile.stats;
  switch (action) {
    case "module_complete":   s.modulesCompleted++;                                                        break;
    case "quiz_pass":
      s.quizzesPassed++;
      if ((metadata.score || 0) >= 100) s.quizPerfectScores++;
      s.quizConsecutivePasses++;
      break;
    case "quiz_retry_pass":
      s.quizzesPassed++;
      s.hadQuizRetryPass = true;
      s.quizConsecutivePasses = 0;
      break;
    case "lab_complete":      s.labsCompleted++;                                                           break;
    case "interview_complete":
      s.interviewsCompleted++;
      if ((metadata.score || 0) > s.bestInterviewScore) s.bestInterviewScore = metadata.score;
      break;
    case "interview_improve":
      s.interviewsImproved = (s.interviewsImproved || 0) + 1;
      break;
    case "resume_upload":
      s.resumeUploads++;
      if ((metadata.newAtsScore || 0) > s.highestAtsScore) s.highestAtsScore = metadata.newAtsScore;
      break;
    case "peer_review_given":    s.peerReviewsGiven++;                                                     break;
    case "peer_review_received": s.peerReviewsReceived++;                                                  break;
    case "project_create":       s.projectsCreated++;                                                      break;
  }
}

// ── Badges ────────────────────────────────────────────────────────────────────

function evaluateBadges(profile, action, metadata) {
  const earned = new Set(profile.badges.map(b => b.id));
  const newBadges = [];

  const earn = (id) => {
    if (earned.has(id)) return;
    const def = BADGE_DEFINITIONS.find(b => b.id === id);
    if (!def) return;
    const badge = { ...def, earnedAt: new Date(), metadata };
    profile.badges.push(badge);
    earned.add(id);
    newBadges.push(badge);
  };

  const s = profile.stats;

  // Resume
  if (s.resumeUploads >= 1)                       earn("first_upload");
  if (s.highestAtsScore >= 50)                    earn("ats_starter");
  if (s.highestAtsScore >= 70)                    earn("ats_optimizer");
  if (s.highestAtsScore >= 90)                    earn("ats_master");

  // Learning
  if (s.modulesCompleted >= 1)                    earn("first_module");
  if (s.modulesCompleted >= 5)                    earn("modules_5");
  if (s.modulesCompleted >= 25)                   earn("modules_25");

  // Labs
  if (s.labsCompleted >= 1)                       earn("first_lab");
  if (s.labsCompleted >= 5)                       earn("labs_5");

  // Quiz
  if (s.quizzesPassed >= 1)                       earn("first_quiz");
  if (s.quizPerfectScores >= 1)                   earn("quiz_perfect");
  if (s.hadQuizRetryPass)                         earn("quiz_retry");
  if (s.quizzesPassed >= 10)                      earn("quiz_10");

  // Interview
  if (s.interviewsCompleted >= 1)                 earn("first_interview");
  if (s.interviewsCompleted >= 10)                earn("interviews_10");
  if (s.interviewsCompleted >= 25)                earn("interviews_25");
  if (action === "interview_improve" && (metadata.improvement || 0) >= 20) earn("score_booster");

  // Streaks
  const ls = profile.streaks.learning.current;
  if (ls >= 3)                                    earn("streak_3");
  if (ls >= 7)                                    earn("streak_7");
  if (ls >= 30)                                   earn("streak_30");
  if (ls >= 60)                                   earn("streak_60");

  // Peer review
  if (s.peerReviewsGiven >= 1)                    earn("first_peer");
  if (s.peerReviewsGiven >= 5)                    earn("peer_5");
  if (s.peerReviewsGiven >= 10)                   earn("peer_mentor");

  // Resume
  if (s.resumeUploads >= 5)                        earn("resume_reviser");

  // Quiz mastery
  if (s.quizPerfectScores >= 3)                    earn("perfectionist");
  if (s.quizzesPassed >= 25)                       earn("quiz_25");

  // Interview mastery
  if ((s.interviewsImproved || 0) >= 1)            earn("comeback_kid");
  if (s.bestInterviewScore >= 90)                  earn("communication_pro");

  // Streaks extended
  if (ls >= 14)                                    earn("streak_14");

  // CareerQuest
  for (const st of profile.careerQuest.stages) {
    if (st.status === "completed") earn(`quest_s${st.stage}`);
  }

  // Levels
  if (profile.level >= 5)                         earn("level_5");
  if (profile.level >= 10)                        earn("level_10");
  if (profile.level >= 20)                        earn("level_20");

  return newBadges;
}

// ── Profile init ──────────────────────────────────────────────────────────────

async function getOrCreate(userId) {
  let profile = await GamificationProfile.findOne({ userId });
  if (!profile) {
    profile = new GamificationProfile({ userId });
    initCareerQuest(profile);
    ensureDailyMissions(profile);
    ensureWeeklyMissions(profile);
    await profile.save();
  }
  return profile;
}

// ── Main awardXP ──────────────────────────────────────────────────────────────

export async function awardXP(userId, action, metadata = {}, description = "") {
  try {
    const profile = await getOrCreate(userId);

    // Refresh missions for today/this week
    ensureDailyMissions(profile);
    ensureWeeklyMissions(profile);

    // Daily cap guard
    const today = todayStr();
    if (profile.xp.todayDate === today && profile.xp.todayXP >= DAILY_XP_CAP) {
      updateStats(profile, action, metadata);
      progressCareerQuest(profile, action, metadata);
      progressMissions(profile, action);
      await profile.save();
      return { xpEarned: 0, capped: true, leveledUp: false, newBadges: [] };
    }

    // Cooldown check
    const cooldownKey = metadata.resourceId ? `${action}:${metadata.resourceId}` : action;
    const maxCount    = { interview_complete: 3, peer_review_given: 3, peer_review_received: 3 }[action] || 1;
    const eligible    = checkCooldown(profile, cooldownKey, maxCount);

    let totalXP = 0;

    if (eligible) {
      let base = calculateXP(action, metadata);
      // 14-day streak multiplier: +10% for learning actions
      const LEARNING_ACTIONS_SET = new Set(["module_complete", "quiz_pass", "quiz_retry_pass", "lab_complete"]);
      if (profile.streaks.learning.current >= 14 && LEARNING_ACTIONS_SET.has(action)) {
        base = Math.round(base * 1.1);
      }
      const earned = addXP(profile, base);
      if (earned > 0) {
        recordCooldown(profile, cooldownKey);
        logXP(profile, action, earned, description || action, metadata);
        totalXP += earned;
      }
    }

    // Always update stats and quest/missions regardless of cooldown
    updateStats(profile, action, metadata);

    // Streak tick for learning actions
    const LEARNING_ACTIONS = ["module_complete", "quiz_pass", "quiz_retry_pass", "lab_complete"];
    const PRACTICE_ACTIONS = ["interview_complete"];
    if (LEARNING_ACTIONS.includes(action)) {
      const ticked = tickStreak(profile.streaks.learning);
      if (ticked) {
        const streakKey = `daily_streak:${today}`;
        if (checkCooldown(profile, streakKey, 1)) {
          const sxp = addXP(profile, 15);
          if (sxp > 0) {
            recordCooldown(profile, streakKey);
            logXP(profile, "daily_streak", sxp, "Daily learning streak bonus", {});
            totalXP += sxp;
          }
        }
      }
    }
    if (PRACTICE_ACTIONS.includes(action)) tickStreak(profile.streaks.practice);

    // Missions
    const missionXP = progressMissions(profile, action);
    if (missionXP > 0) {
      const mx = addXP(profile, missionXP);
      if (mx > 0) {
        logXP(profile, "mission_reward", mx, "Mission reward", {});
        totalXP += mx;
      }
    }

    // CareerQuest
    const completedStages = progressCareerQuest(profile, action, metadata);
    for (const { stage: stageNum, xpReward } of completedStages) {
      const sx = addXP(profile, xpReward);
      if (sx > 0) {
        logXP(profile, "career_quest_stage", sx, `CareerQuest Stage ${stageNum} complete`, { stage: stageNum });
        totalXP += sx;
      }
    }

    // Level up
    const oldLevel  = profile.level;
    const leveledUp = applyLevelUp(profile);

    // Badges
    const newBadges = evaluateBadges(profile, action, metadata);

    await profile.save();

    return {
      xpEarned: totalXP,
      capped: false,
      leveledUp,
      oldLevel,
      newLevel: profile.level,
      newLevelName: profile.levelName,
      newBadges,
      completedStages,
    };
  } catch (err) {
    console.error("gamification.awardXP error:", err.message);
    return { xpEarned: 0, capped: false, leveledUp: false, newBadges: [], completedStages: [] };
  }
}

// ── Public read API ───────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const profile = await getOrCreate(userId);
  const refreshed = ensureDailyMissions(profile) || ensureWeeklyMissions(profile);
  if (refreshed) await profile.save();
  const info = getLevelInfo(profile.xp.total);
  return { ...profile.toObject(), ...info };
}

export async function useStreakFreeze(userId) {
  const profile = await GamificationProfile.findOne({ userId });
  if (!profile) throw new Error("Profile not found");
  if (profile.streaks.learning.freezesAvailable <= 0) throw new Error("No streak freezes available");
  profile.streaks.learning.freezesAvailable -= 1;
  await profile.save();
  return { freezesRemaining: profile.streaks.learning.freezesAvailable };
}

export async function recordBossBattle(userId, stageId, passed) {
  const profile = await GamificationProfile.findOne({ userId });
  if (!profile) throw new Error("Profile not found");

  let battle = profile.bossBattles.find(b => b.stageId === stageId);
  if (!battle) {
    profile.bossBattles.push({ stageId, attempts: 0, dailyAttempts: 0, attemptDate: "", passed: false });
    battle = profile.bossBattles[profile.bossBattles.length - 1];
  }

  const today = todayStr();
  if (battle.attemptDate !== today) {
    battle.dailyAttempts = 0;
    battle.attemptDate   = today;
  }
  if (battle.dailyAttempts >= 3) throw new Error("Boss battle attempt limit reached. Try again tomorrow.");

  battle.dailyAttempts += 1;
  battle.attempts      += 1;
  battle.lastAttemptAt  = new Date();

  if (passed && !battle.passed) {
    battle.passed      = true;
    battle.completedAt = new Date();
    await profile.save();
    return awardXP(userId, "boss_battle_pass", { stageId }, "Boss Battle passed!");
  }

  await profile.save();
  return { passed: false, attemptsToday: battle.dailyAttempts };
}

// ── Next best action (deterministic, no DB) ───────────────────────────────────

export function computeNextBestActions(stats, dailyMissions, streaks) {
  const today   = todayStr();
  const actions = [];

  // High: streak at risk today
  const ls = streaks?.learning;
  if (ls?.current > 0 && ls?.lastActivityDate !== today) {
    actions.push({
      priority:    "high",
      type:        "streak_preserve",
      label:       `Keep your ${ls.current}-day streak alive`,
      description: "Complete any learning activity today before midnight.",
      hrefType:    "learning",
    });
  }

  // High: first incomplete daily mission
  const pending = (dailyMissions?.missions ?? []).filter(m => !m.completed);
  if (pending.length > 0) {
    const m = pending[0];
    const left = pending.length;
    actions.push({
      priority:    "high",
      type:        m.type,
      label:       m.title,
      description: `+${m.xpReward} XP · ${left} mission${left > 1 ? "s" : ""} remaining today`,
      hrefType:    m.type === "peer_review_given"  ? "peer_review"
                 : m.type === "interview_complete" ? "interview"
                 : "learning",
    });
  }

  // Medium: first quiz after completing a module
  if (stats.quizzesPassed === 0 && stats.modulesCompleted > 0) {
    actions.push({
      priority:    "medium",
      type:        "quiz_pass",
      label:       "Take your first quiz",
      description: "Test your knowledge — +30–75 XP and badge unlock waiting.",
      hrefType:    "learning",
    });
  }

  // Medium: interview practice if below 3
  if (stats.interviewsCompleted < 3) {
    actions.push({
      priority:    "medium",
      type:        "interview_complete",
      label:       "Practice a mock interview",
      description: `${stats.interviewsCompleted}/3 done — build confidence with each session. +80 XP.`,
      hrefType:    "interview",
    });
  }

  // Low: peer review
  if (stats.peerReviewsGiven === 0) {
    actions.push({
      priority:    "low",
      type:        "peer_review_given",
      label:       "Give your first peer review",
      description: "+40 XP and unlock the Helpful Peer badge.",
      hrefType:    "peer_review",
    });
  }

  // Low: resume never uploaded
  if (stats.resumeUploads === 0) {
    actions.push({
      priority:    "low",
      type:        "resume_upload",
      label:       "Upload your resume",
      description: "Get your ATS score and unlock personalized learning prep.",
      hrefType:    "resume",
    });
  }

  return actions.slice(0, 3);
}

// ── Fallback coach message (no AI needed) ─────────────────────────────────────

export function fallbackCoachMessage(stats, learningStreak) {
  if (learningStreak >= 14) return `${learningStreak}-day streak — you're unstoppable. Keep the momentum going.`;
  if (learningStreak >= 7)  return `7 consecutive days of practice. Interviewers notice candidates who never stop improving.`;
  if (stats.modulesCompleted >= 10) return `${stats.modulesCompleted} modules completed. You're building real depth — keep connecting the dots.`;
  if (stats.interviewsCompleted >= 5) return `${stats.interviewsCompleted} interviews practiced. Each one sharpens your edge — push through another today.`;
  if (stats.quizzesPassed >= 5) return `Strong quiz performance! Pair that knowledge with consistent interview practice.`;
  if (stats.resumeUploads === 0) return `Start with your resume — upload it to get a personalized ATS score and a tailored learning plan.`;
  return `Every expert was once a beginner. Consistency beats talent — show up today and keep going.`;
}

export { BADGE_DEFINITIONS, QUEST_STAGES, LEVELS };
