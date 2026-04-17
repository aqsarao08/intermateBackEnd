/**
 * File: src/routes/projects.js
 * Project CRUD routes backed by the FastAPI resume analyzer.
 */

import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import { requireAuth } from "../middleware/auth.js";
import { analyzeDocuments, analyzeStoredTexts } from "../utils/resumeAnalyzerClient.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are accepted"));
  },
});

function toAiInsights(result) {
  return {
    resumeMatchScore: result.atsScore || 0,
    atsScore: result.atsScore || 0,
    matchLevel: result.matchLevel || "weak",
    matchedKeywords: result.matchedKeywords || [],
    missingKeywords: result.missingKeywords || [],
    hardRequirementsMatched: result.hardRequirementsMatched || [],
    hardRequirementsMissing: result.hardRequirementsMissing || [],
    preferredRequirementsMissing: result.preferredRequirementsMissing || [],
    resumeStrengths: result.strengths || [],
    resumeWeaknesses: result.weaknesses || [],
    atsSuggestions: result.atsSuggestions || [],
    improvementSuggestions: result.improvementSuggestions || [],
    missingSkillGroups: result.missingSkillGroups || {},
    skillRecommendations: result.skillRecommendations || [],
    learningPriority: result.learningPriority || {},
    resumeActionPlan: result.resumeActionPlan || [],
    projectSuggestions: result.projectSuggestions || [],
    bulletRewrites: result.bulletRewrites || [],
    optimizedSummary: result.optimizedSummary || "",
    structureSuggestions: result.structureSuggestions || [],
    sectionScores: result.sectionScores || [],
    analysisMeta: result.analysisMeta || {},
    scoreBreakdown: result.scoreBreakdown || {},
    jdKeywords: result.jdKeywords || [],
    jdRequiredSkills: result.jdRequiredSkills || [],
    jdNiceToHave: result.jdNiceToHave || [],
    jdSeniority: result.jdSeniority || "",
    skillsToLearn: (result.skillRecommendations || [])
      .filter((item) => item.actionLabel !== "Add now")
      .map((item) => item.skill),
    suggestedProjects: (result.projectSuggestions || []).map((item) => ({
      title: item.title,
      description: item.description,
      skills: item.skillsCovered || [],
      skillsCovered: item.skillsCovered || [],
      whyItHelps: item.whyItHelps || "",
      roleFit: item.roleFit || "",
      resumeValue: item.resumeValue || "",
      difficulty: item.difficulty || "intermediate",
    })),
    careerCoachSummary: result.optimizedSummary || "",
    processingStatus: "done",
    processedAt: new Date(),
  };
}

function buildProject(project) {
  return {
    id: project._id.toString(),
    title: project.title,
    companyName: project.companyName,
    jobRole: project.jobRole,
    jobDescription: project.jobDescription,
    resumeFileUrl: project.resumeFileUrl || "",
    resumeText: project.resumeText,
    aiInsights: project.aiInsights || {},
    outcome: project.outcome || {},
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const projects = await Project.find({
      userId: req.user.userId,
      status: "active",
    })
      .select("-resumeText -jobDescription -aiInsights.bulletRewrites -aiInsights.skillRecommendations -aiInsights.suggestedProjects -aiInsights.projectSuggestions -aiInsights.improvementSuggestions -aiInsights.resumeActionPlan -aiInsights.atsSuggestions -aiInsights.structureSuggestions -aiInsights.missingSkillGroups -aiInsights.analysisMeta -aiInsights.topicWeaknessMap")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json(projects.map(buildProject));
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({ message: "Server error while getting projects" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      status: "active",
    }).lean();

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.status(200).json(buildProject(project));
  } catch (error) {
    console.error("Get project error:", error);
    return res.status(500).json({ message: "Server error while getting project" });
  }
});

router.post("/", requireAuth, upload.single("resume"), async (req, res) => {
  try {
    const { title, companyName = "", jobRole = "", jobDescription = "" } = req.body;

    const cleanTitle = String(title || "").trim();
    const cleanJD = String(jobDescription || "").trim();

    if (!cleanTitle) return res.status(400).json({ message: "Project title is required" });
    if (!cleanJD) return res.status(400).json({ message: "Job description is required" });
    if (!req.file) return res.status(400).json({ message: "Resume PDF is required" });

    const analysisResult = await analyzeDocuments({
      resumeFile: req.file,
      jdText: cleanJD,
    });

    const project = await Project.create({
      userId: req.user.userId,
      title: cleanTitle,
      companyName: String(companyName || "").trim(),
      jobRole: String(jobRole || "").trim(),
      jobDescription: cleanJD,
      resumeText: analysisResult.resumeText || "",
      resumeFileUrl: "",
      aiInsights: toAiInsights(analysisResult),
      outcome: {
        status: "applied",
        notes: "",
        updatedAt: new Date(),
      },
    });

    return res.status(201).json({
      message: "Project created successfully",
      project: buildProject(project),
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({ message: error.message || "Server error while creating project" });
  }
});

router.put("/:id", requireAuth, upload.single("resume"), async (req, res) => {
  try {
    const current = await Project.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!current) {
      return res.status(404).json({ message: "Project not found" });
    }

    const update = {};
    if (typeof req.body.title === "string") update.title = req.body.title.trim();
    if (typeof req.body.companyName === "string") update.companyName = req.body.companyName.trim();
    if (typeof req.body.jobRole === "string") update.jobRole = req.body.jobRole.trim();
    if (typeof req.body.jobDescription === "string") update.jobDescription = req.body.jobDescription.trim();
    if (typeof req.body.status === "string") update.status = req.body.status;

    const finalJD = (update.jobDescription !== undefined ? update.jobDescription : current.jobDescription) || "";
    const finalResumeText = current.resumeText || "";

    if (req.file && finalJD) {
      const analysisResult = await analyzeDocuments({
        resumeFile: req.file,
        jdText: finalJD,
      });
      update.resumeText = analysisResult.resumeText || finalResumeText;
      update.aiInsights = toAiInsights(analysisResult);
    } else if (finalResumeText && finalJD) {
      const analysisResult = await analyzeStoredTexts({
        resumeText: finalResumeText,
        jdText: finalJD,
      });
      update.aiInsights = toAiInsights(analysisResult);
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: update },
      { new: true }
    );

    return res.status(200).json({
      message: "Project updated successfully",
      project: buildProject(project),
    });
  } catch (error) {
    console.error("Update project error:", error);
    return res.status(500).json({ message: error.message || "Server error while updating project" });
  }
});

router.post("/:id/process", requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      status: "active",
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!project.resumeText) {
      return res.status(400).json({ message: "No resume text available. Upload a resume PDF first." });
    }

    const analysisResult = await analyzeStoredTexts({
      resumeText: project.resumeText,
      jdText: project.jobDescription || "",
    });

    project.aiInsights = toAiInsights(analysisResult);
    await project.save();

    return res.status(200).json({
      message: "Project processed successfully",
      project: buildProject(project),
    });
  } catch (error) {
    console.error("Process project error:", error);
    return res.status(500).json({ message: error.message || "Server error while processing project" });
  }
});

router.get("/:id/status", requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      status: "active",
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.status(200).json({
      processingStatus: project.aiInsights?.processingStatus || "pending",
      processedAt: project.aiInsights?.processedAt || null,
    });
  } catch (error) {
    console.error("Get project status error:", error);
    return res.status(500).json({ message: "Server error while getting project status" });
  }
});

router.patch("/:id/outcome", requireAuth, async (req, res) => {
  try {
    const { status, notes = "" } = req.body;
    const allowedStatuses = ["applied", "interviewing", "offer", "rejected", "accepted", "withdrawn"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid outcome status" });
    }

    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.userId,
        status: "active",
      },
      {
        $set: {
          outcome: {
            status,
            notes: String(notes || "").trim(),
            updatedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.status(200).json({
      message: "Outcome updated successfully",
      project: buildProject(project),
    });
  } catch (error) {
    console.error("Update outcome error:", error);
    return res.status(500).json({ message: "Server error while updating outcome" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.userId,
      },
      { $set: { status: "archived" } },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.status(200).json({ message: "Project archived successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    return res.status(500).json({ message: "Server error while deleting project" });
  }
});

export default router;
