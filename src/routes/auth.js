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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
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

export default router;