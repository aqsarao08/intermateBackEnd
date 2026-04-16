import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./config/db.safe.js";

import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import projectInterviewRoutes from "./routes/projectInterview.js";
import projectResumeRoutes from "./routes/projectResume.js";
import projectLearningRoutes from "./routes/projectLearning.js";
import careerQuestRoutes from "./routes/careerQuest.js";
import peerReviewRoutes from "./routes/peerReviews.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", projectInterviewRoutes);
app.use("/api/projects", projectResumeRoutes);
app.use("/api/projects", projectLearningRoutes);
app.use("/api/career-quest", careerQuestRoutes);
app.use("/api/peer-reviews", peerReviewRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
  });
});
