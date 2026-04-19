import express from "express";
import { sendContactInquiryEmail } from "../utils/sendContactInquiryEmail.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { fullName, email, category, subject, message } = req.body;

    const trimmedName = String(fullName || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const trimmedCategory = String(category || "").trim();
    const trimmedSubject = String(subject || "").trim();
    const trimmedMessage = String(message || "").trim();

    if (!trimmedName || !normalizedEmail || !trimmedSubject || !trimmedMessage) {
      return res.status(400).json({
        message: "Full name, email, subject, and message are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    await sendContactInquiryEmail({
      fullName: trimmedName,
      email: normalizedEmail,
      category: trimmedCategory,
      subject: trimmedSubject,
      message: trimmedMessage,
    });

    return res.status(200).json({
      success: true,
      message: "Inquiry sent successfully",
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send inquiry",
    });
  }
});

export default router;