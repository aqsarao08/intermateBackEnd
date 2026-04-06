import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/auth.js";
import resumeRoutes from "./routes/resumeContext.js";
import interviewRoutes from "./routes/interview.js";
import careerQuestRoutes from "./routes/careerQuest.js";
import peerReviewRoutes from "./routes/peerReviews.js";
import learnModeRoutes from "./routes/learnMode.js";
import jobPreparationRoutes from "./routes/jobPreps.js";

dotenv.config();

const app = express();

// middlewares
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/resume-context", resumeRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/career-quest", careerQuestRoutes);
app.use("/api/peer-reviews", peerReviewRoutes);
app.use("/api/learn-mode", learnModeRoutes);
app.use("/api/jobs", jobPreparationRoutes);

// health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// start
const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
  });
});
