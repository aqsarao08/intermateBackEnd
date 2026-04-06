import mongoose from "mongoose";

const resumeContextSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    jobDescription: { type: String, required: true },
    resumeFileName: { type: String, required: true },
    resumeUrl: String,   // S3/Firebase path
    resumeText: String,  // optional parsed text
  },
  { timestamps: true }
);

export default mongoose.model("ResumeContext", resumeContextSchema);
