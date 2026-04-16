/**
 * File: src/routes/projectResume.js
 * Resume analyzer routes backed by the FastAPI microservice.
 */

import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import Project from "../models/Project.js";
import { analyzeDocuments } from "../utils/resumeAnalyzerClient.js";

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

router.post("/:id/resume/upload", requireAuth, upload.single("resume"), async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      status: "active",
    });

    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!req.file) return res.status(400).json({ message: "No PDF file uploaded" });

    const jobDescription = String(req.body.jdText || project.jobDescription || "").trim();

    project.aiInsights = {
      ...(project.aiInsights?.toObject?.() || {}),
      processingStatus: "processing",
    };
    await project.save();

    const analysisResult = await analyzeDocuments({
      resumeFile: req.file,
      jdText: jobDescription,
    });

    project.resumeText = analysisResult.resumeText || "";
    project.aiInsights = toAiInsights(analysisResult);
    await project.save();

    return res.status(200).json({
      message: "Resume analysed successfully",
      analysis: analysisResult,
      resumeText: project.resumeText,
    });
  } catch (err) {
    console.error("Resume upload error:", err);
    return res.status(500).json({ message: err.message || "Server error during resume analysis" });
  }
});

router.get("/:id/resume/report", requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      status: "active",
    });

    if (!project) return res.status(404).json({ message: "Project not found" });

    const i = project.aiInsights || {};

    return res.json({
      hasAnalysis: i.processingStatus === "done",
      processingStatus: i.processingStatus || "pending",
      matchScore: i.atsScore || i.resumeMatchScore || 0,
      atsScore: i.atsScore || i.resumeMatchScore || 0,
      matchLevel: i.matchLevel || "weak",
      scoreBreakdown: i.scoreBreakdown || {},
      jdKeywords: i.jdKeywords || [],
      jdRequiredSkills: i.jdRequiredSkills || [],
      jdNiceToHave: i.jdNiceToHave || [],
      jdSeniority: i.jdSeniority || "",
      matchedKeywords: i.matchedKeywords || [],
      missingKeywords: i.missingKeywords || [],
      hardRequirementsMatched: i.hardRequirementsMatched || [],
      hardRequirementsMissing: i.hardRequirementsMissing || [],
      preferredRequirementsMissing: i.preferredRequirementsMissing || [],
      sectionScores: i.sectionScores || [],
      resumeStrengths: i.resumeStrengths || [],
      resumeWeaknesses: i.resumeWeaknesses || [],
      strengths: i.resumeStrengths || [],
      weaknesses: i.resumeWeaknesses || [],
      atsSuggestions: i.atsSuggestions || [],
      improvementSuggestions: i.improvementSuggestions || [],
      bulletRewrites: i.bulletRewrites || [],
      skillsToLearn: i.skillsToLearn || [],
      suggestedCertifications: i.suggestedCertifications || [],
      suggestedProjects: i.suggestedProjects || [],
      projectSuggestions: i.projectSuggestions || i.suggestedProjects || [],
      missingSkillGroups: i.missingSkillGroups || {},
      skillRecommendations: i.skillRecommendations || [],
      learningPriority: i.learningPriority || {},
      resumeActionPlan: i.resumeActionPlan || [],
      optimizedSummary: i.optimizedSummary || "",
      structureSuggestions: i.structureSuggestions || [],
      careerCoachSummary: i.careerCoachSummary || i.optimizedSummary || "",
      analysisMeta: i.analysisMeta || {},
      suggestions: i.atsSuggestions || [],
      resumeText: project.resumeText || "",
      resumeFileUrl: project.resumeFileUrl || "",
      processedAt: i.processedAt || null,
      jobDescription: project.jobDescription || "",
      jobRole: project.jobRole || "",
      companyName: project.companyName || "",
    });
  } catch (err) {
    console.error("Resume report error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
