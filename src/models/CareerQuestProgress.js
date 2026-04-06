import mongoose from "mongoose";

const stageSchema = new mongoose.Schema(
  {
    stageNumber: Number,
    title: String,
    status: { type: String, enum: ["locked", "in-progress", "completed"], default: "locked" },
    score: Number,
  },
  { _id: false }
);

const careerQuestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stages: [stageSchema],
  },
  { timestamps: true }
);

export default mongoose.model("CareerQuestProgress", careerQuestSchema);
