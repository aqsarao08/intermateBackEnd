import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { sendWelcomeEmail } from "../utils/sendWelcomeEmail.js";

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function buildUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    targetRole: user.targetRole,
    location: user.location,
    education: user.education,
    username: user.username || "",
    headline: user.headline || "",
    website: user.website || "",
    bio: user.bio || "",
    accountStatus: user.accountStatus || "active",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function getDefaultSettings(user) {
  return {
    profile: {
      fullName: user.name || "",
      username: user.username || "",
      headline: user.headline || "",
      location: user.location || "",
      website: user.website || "",
      bio: user.bio || "",
      education: user.education || "",
    },
    notifications: {
      mentions: user.notifications?.mentions ?? true,
      weeklyDigest: user.notifications?.weeklyDigest ?? true,
      productUpdates: user.notifications?.productUpdates ?? false,
      securityAlerts: user.notifications?.securityAlerts ?? true,
      interviewReminders: user.notifications?.interviewReminders ?? true,
      desktopPush: user.notifications?.desktopPush ?? false,
    },
    privacy: {
      profileVisible: user.privacy?.profileVisible ?? true,
      activityStatus: user.privacy?.activityStatus ?? true,
      peerReviewOptIn: user.privacy?.peerReviewOptIn ?? true,
      aiPersonalization: user.privacy?.aiPersonalization ?? false,
    },
    security: {
      twoFactor: user.security?.twoFactor ?? true,
      trustedDevices: user.security?.trustedDevices ?? true,
      sessionAlerts: user.security?.sessionAlerts ?? true,
    },
    meta: {
      email: user.email,
      accountStatus: user.accountStatus || "active",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

function normalizeWebsite(value) {
  const website = String(value || "").trim();
  if (!website) return "";
  return website;
}

function sanitizeBooleanMap(source, allowedKeys) {
  const next = {};
  for (const key of allowedKeys) {
    if (typeof source?.[key] === "boolean") {
      next[key] = source[key];
    }
  }
  return next;
}

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const trimmedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");

    if (!trimmedName || !normalizedEmail || !rawPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (trimmedName.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }

    if (rawPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
    });

    try {
      await sendWelcomeEmail({
        to: user.email,
        name: user.name,
      });
    } catch (emailError) {
      console.error("Welcome email error:", emailError.message);
    }

    return res.status(201).json({
      message: "Signup successful. Please log in.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Server error during signup" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
    const rawPassword = String(req.body.password || "");

    if (!normalizedEmail || !rawPassword) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(rawPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.accountStatus === "deactivated") {
      return res.status(403).json({ message: "This account is deactivated. Please contact support to restore access." });
    }

    const token = createToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: buildUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
});

// GET CURRENT USER
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(buildUser(user));
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({ message: "Server error while getting profile" });
  }
});

router.get("/settings", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(getDefaultSettings(user));
  } catch (error) {
    console.error("Get settings error:", error);
    return res.status(500).json({ message: "Server error while getting settings" });
  }
});

router.put("/settings/profile", requireAuth, async (req, res) => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const username = String(req.body.username || "").trim();
    const headline = String(req.body.headline || "").trim();
    const location = String(req.body.location || "").trim();
    const website = normalizeWebsite(req.body.website);
    const bio = String(req.body.bio || "").trim();
    const education = String(req.body.education || "").trim();

    if (fullName.length < 2) {
      return res.status(400).json({ message: "Full name must be at least 2 characters" });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ message: "Username must be 3-20 characters and use letters, numbers, or underscores only" });
    }

    if (headline.length < 4) {
      return res.status(400).json({ message: "Headline must be at least 4 characters" });
    }

    if (location.length < 2) {
      return res.status(400).json({ message: "Location is required" });
    }

    if (website && !/^https?:\/\/.+/i.test(website)) {
      return res.status(400).json({ message: "Website must start with http:// or https://" });
    }

    if (bio.length < 20 || bio.length > 220) {
      return res.status(400).json({ message: "Bio must be between 20 and 220 characters" });
    }

    const existingUsername = await User.findOne({
      _id: { $ne: req.user.userId },
      username: username.toLowerCase(),
    }).lean();

    if (existingUsername) {
      return res.status(409).json({ message: "That username is already taken" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          name: fullName,
          username: username.toLowerCase(),
          headline,
          location,
          website,
          bio,
          education,
        },
      },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      user: buildUser(user),
      settings: getDefaultSettings(user),
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Server error while updating profile" });
  }
});

router.put("/settings/preferences", requireAuth, async (req, res) => {
  try {
    const notifications = sanitizeBooleanMap(req.body.notifications, [
      "mentions",
      "weeklyDigest",
      "productUpdates",
      "securityAlerts",
      "interviewReminders",
      "desktopPush",
    ]);
    const privacy = sanitizeBooleanMap(req.body.privacy, [
      "profileVisible",
      "activityStatus",
      "peerReviewOptIn",
      "aiPersonalization",
    ]);
    const security = sanitizeBooleanMap(req.body.security, [
      "twoFactor",
      "trustedDevices",
      "sessionAlerts",
    ]);

    const updates = {};

    if (Object.keys(notifications).length > 0) {
      for (const [key, value] of Object.entries(notifications)) {
        updates[`notifications.${key}`] = value;
      }
    }

    if (Object.keys(privacy).length > 0) {
      for (const [key, value] of Object.entries(privacy)) {
        updates[`privacy.${key}`] = value;
      }
    }

    if (Object.keys(security).length > 0) {
      for (const [key, value] of Object.entries(security)) {
        updates[`security.${key}`] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid preference changes were provided" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Preferences updated successfully",
      settings: getDefaultSettings(user),
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    return res.status(500).json({ message: "Server error while updating preferences" });
  }
});

router.put("/settings/email", requireAuth, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const confirmEmail = String(req.body.confirmEmail || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !confirmEmail || !password) {
      return res.status(400).json({ message: "Email, confirmation, and current password are required" });
    }

    if (email !== confirmEmail) {
      return res.status(400).json({ message: "Email addresses do not match" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const existingUser = await User.findOne({ _id: { $ne: user._id }, email }).lean();
    if (existingUser) {
      return res.status(409).json({ message: "That email is already in use" });
    }

    user.email = email;
    await user.save();

    return res.status(200).json({
      message: "Email updated successfully",
      user: buildUser(user),
      settings: getDefaultSettings(user),
    });
  } catch (error) {
    console.error("Update email error:", error);
    return res.status(500).json({ message: "Server error while updating email" });
  }
});

router.put("/settings/password", requireAuth, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "Current password, new password, and confirmation are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (newPassword.length < 12 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json({ message: "New password must be at least 12 characters and include uppercase, lowercase, and numeric characters" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Update password error:", error);
    return res.status(500).json({ message: "Server error while updating password" });
  }
});

router.post("/settings/deactivate", requireAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { accountStatus: "deactivated" } },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Account deactivated successfully",
      user: buildUser(user),
      settings: getDefaultSettings(user),
    });
  } catch (error) {
    console.error("Deactivate account error:", error);
    return res.status(500).json({ message: "Server error while deactivating account" });
  }
});

router.delete("/settings/account", requireAuth, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.user.userId).lean();

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ message: "Server error while deleting account" });
  }
});

export default router;
