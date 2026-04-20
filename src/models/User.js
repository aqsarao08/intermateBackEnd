import mongoose from "mongoose";

const notificationSettingsSchema = new mongoose.Schema(
  {
    mentions: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: true },
    productUpdates: { type: Boolean, default: false },
    securityAlerts: { type: Boolean, default: true },
    interviewReminders: { type: Boolean, default: true },
    desktopPush: { type: Boolean, default: false },
  },
  { _id: false }
);

const privacySettingsSchema = new mongoose.Schema(
  {
    profileVisible: { type: Boolean, default: true },
    activityStatus: { type: Boolean, default: true },
    peerReviewOptIn: { type: Boolean, default: true },
    aiPersonalization: { type: Boolean, default: false },
  },
  { _id: false }
);

const securitySettingsSchema = new mongoose.Schema(
  {
    twoFactor: { type: Boolean, default: true },
    trustedDevices: { type: Boolean, default: true },
    sessionAlerts: { type: Boolean, default: true },
  },
  { _id: false }
);

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
    role: {
      type: String,
      default: "",
    },
    targetRole: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    education: {
      type: String,
      default: "",
    },
    username: {
      type: String,
      default: "",
      trim: true,
    },
    headline: {
      type: String,
      default: "",
      trim: true,
    },
    website: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      default: "",
      trim: true,
    },
    accountStatus: {
      type: String,
      enum: ["active", "deactivated"],
      default: "active",
    },
    notifications: {
      type: notificationSettingsSchema,
      default: () => ({}),
    },
    privacy: {
      type: privacySettingsSchema,
      default: () => ({}),
    },
    security: {
      type: securitySettingsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
