// src/models/JobPreparation.js
import mongoose from "mongoose";

const JobPreparationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  jobTitle: { type: String, required: false },   // what user typed
  company: { type: String, required: false },
  jdText: { type: String, required: false },     // job description
  resumeFileName: { type: String, required: false },
  aiInsights: { type: mongoose.Schema.Types.Mixed }, // store AI result (ats_score, rewrites, keywords...)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: false } // optional: mark current active job
});

JobPreparationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.JobPreparation || mongoose.model("JobPreparation", JobPreparationSchema);
