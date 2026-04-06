import mongoose from "mongoose";

const topicResultSchema = new mongoose.Schema(
  {
    topicId: String,
    topicName: String,
    lastScore: Number,
    attempts: Number,
  },
  { _id: false }
);

const learnModeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    topics: [topicResultSchema],
  },
  { timestamps: true }
);

export default mongoose.model("LearnModeProgress", learnModeSchema);
