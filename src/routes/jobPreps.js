import express from "express";
import { requireAuth } from "../middleware/auth.js";
import JobPreparation from "../models/JobPreparation.js";

const router = express.Router();

// very simple text extraction: grab bullets and a few keywords
function extractCoreInfo(resumeText = "", jdText = "") {
const normalize = (t) =>
t
.split("\n")
.map((line) => line.trim())
.filter(Boolean);

const resumeLines = normalize(resumeText);
const jdLines = normalize(jdText);

const jdBullets = jdLines.filter((l) => /^[-•]/.test(l));
const resumeBullets = resumeLines.filter((l) => /^[-•]/.test(l));

const summaryLines = [jdLines[0], jdLines[1]].filter(Boolean);
const summary = summaryLines.join(" ");

const allText = (resumeText + " " + jdText)
.toLowerCase()
.replace(/[^a-z0-9\s]/g, " ");
const words = allText.split(/\s+/).filter((w) => w.length > 3);

const stopwords = new Set([
"with",
"this",
"that",
"have",
"from",
"your",
"will",
"role",
"work",
"team",
"developer",
"engineer",
]);

const freq = new Map();
for (const w of words) {
if (stopwords.has(w)) continue;
freq.set(w, (freq.get(w) || 0) + 1);
}

const keySkills = Array.from(freq.entries())
.sort((a, b) => b[1] - a[1])
.slice(0, 8)
.map(([w]) => w);

return {
summary,
jdHighlights: jdBullets.slice(0, 5),
resumeHighlights: resumeBullets.slice(0, 5),
keySkills,
};
}

// GET /api/jobs/my → list latest job preps for current user
router.get("/my", requireAuth, async (req, res) => {
try {
const jobs = await JobPreparation.find({
user: req.user.userId,
isArchived: false,
})
.sort({ updatedAt: -1 })
.limit(3)
.lean();

res.json(jobs);


} catch (err) {
console.error("GET /jobs/my error", err);
res.status(500).json({ message: "Server error." });
}
});

// POST /api/jobs → create new job prep and extract info
router.post("/", requireAuth, async (req, res) => {
try {
const { jobTitle, company, resumeText, jdText } = req.body;

if (!jobTitle || !resumeText || !jdText) {
  return res.status(400).json({ message: "Missing required fields." });
}

const extracted = extractCoreInfo(resumeText, jdText);

const job = await JobPreparation.create({
  user: req.user.userId,
  jobTitle,
  company,
  resumeText,
  jdText,
  summary: extracted.summary,
  jdHighlights: extracted.jdHighlights,
  resumeHighlights: extracted.resumeHighlights,
  keySkills: extracted.keySkills,
});

res.status(201).json(job);


} catch (err) {
console.error("POST /jobs error", err);
res.status(500).json({ message: "Server error." });
}
});

// PATCH /api/jobs/:id/progress → update completion percentage
router.patch("/:id/progress", requireAuth, async (req, res) => {
try {
const { hasDoneResumeAnalysis, hasDoneMockInterview, hasDoneLearningMode } =
req.body;

const job = await JobPreparation.findOne({
  _id: req.params.id,
  user: req.user.userId,
});

if (!job) {
  return res.status(404).json({ message: "Job prep not found." });
}

if (typeof hasDoneResumeAnalysis === "boolean") {
  job.hasDoneResumeAnalysis = hasDoneResumeAnalysis;
}
if (typeof hasDoneMockInterview === "boolean") {
  job.hasDoneMockInterview = hasDoneMockInterview;
}
if (typeof hasDoneLearningMode === "boolean") {
  job.hasDoneLearningMode = hasDoneLearningMode;
}

const steps = [
  job.hasDoneResumeAnalysis,
  job.hasDoneMockInterview,
  job.hasDoneLearningMode,
];
const doneCount = steps.filter(Boolean).length;
job.completionPercent = Math.round((doneCount / steps.length) * 100);

await job.save();
res.json(job);


} catch (err) {
console.error("PATCH /jobs/:id/progress error", err);
res.status(500).json({ message: "Server error." });
}
});
// Create job (called after AI microservice returns insights)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { jobTitle, company, jdText, resumeFileName, aiInsights } = req.body;
    const job = new JobPreparation({
      userId: mongoose.Types.ObjectId(req.user.id),
      jobTitle,
      company,
      jdText,
      resumeFileName,
      aiInsights,
      isActive: true,
    });

    // Optionally set other jobs by same user isActive = false
    await JobPreparation.updateMany({ userId: req.user.id }, { isActive: false });

    await job.save();
    res.json(job);
  } catch (err) {
    console.error("Create jobPrep error", err);
    res.status(500).json({ message: "Failed to create job preparation.", error: err.message });
  }
});

// List jobs for the logged-in user
router.get("/", requireAuth, async (req, res) => {
  try {
    const jobs = await JobPreparation.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    res.json(jobs);
  } catch (err) {
    console.error("List jobPreps error", err);
    res.status(500).json({ message: "Failed to fetch jobs." });
  }
});

// Get a single job by id (must belong to user)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const job = await JobPreparation.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!job) return res.status(404).json({ message: "Job not found." });
    res.json(job);
  } catch (err) {
    console.error("Get jobPrep error", err);
    res.status(500).json({ message: "Failed to fetch job." });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const update = req.body;
    const job = await JobPreparation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      update,
      { new: true }
    ).lean();
    if (!job) return res.status(404).json({ message: "Job not found." });
    res.json(job);
  } catch (err) {
    console.error("Update jobPrep error", err);
    res.status(500).json({ message: "Failed to update job." });
  }
});


export default router;