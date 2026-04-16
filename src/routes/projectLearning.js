import express from "express";
import { requireAuth } from "../middleware/auth.js";
import Project from "../models/Project.js";

const router = express.Router();

// GET /api/projects/:id/learning/plan
router.get("/:id/learning/plan", requireAuth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      status: "active",
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const weaknessTopics = project.aiInsights?.topicWeaknessMap || [];
    const modules = weaknessTopics.map((topic, index) => ({
      moduleId: `${req.params.id}-${index + 1}`,
      title: `Improve ${topic}`,
      type: "lesson",
      status: "pending",
      estimatedMinutes: 20,
    }));

    res.json({
      objectives: weaknessTopics.length
        ? weaknessTopics
        : ["Understand the role requirements", "Improve interview confidence"],
      modules,
      overallProgress: 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;