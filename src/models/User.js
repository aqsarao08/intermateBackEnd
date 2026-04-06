import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: { type: String, default: "" },        // e.g. "Student", "Junior Developer"
    targetRole: { type: String, default: "" },  // optional, you already use this in UI
    location: { type: String, default: "" },    // e.g. "Lahore, PK"
    education: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);


const User = mongoose.model("User", userSchema);

export default User;
