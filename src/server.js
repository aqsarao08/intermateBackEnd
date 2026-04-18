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
import gamificationRoutes from "./routes/gamification.js";

dotenv.config();

const app = express();
const defaultClientOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
const configuredClientOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URLS,
]
  .filter(Boolean)
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultClientOrigins, ...configuredClientOrigins])];

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools and same-machine server calls without an Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
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
app.use("/api/gamification", gamificationRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 4000;

connectDB(process.env.MONGODB_URI).then(() => {
  const server = app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Stop the existing process or change PORT in .env.`);
      return;
    }

    console.error("Server startup error:", err.message);
  });
});
