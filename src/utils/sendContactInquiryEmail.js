import { getMailer } from "./mailer.js";

export async function sendContactInquiryEmail({
  fullName,
  email,
  category,
  subject,
  message,
}) {
  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is missing in .env");
  }

  const transporter = getMailer();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: "intermate.ai.fyp@gmail.com",
    replyTo: email,
    subject: `[Contact Form] ${subject}`,
    text: `
New contact inquiry received

Full Name: ${fullName}
Email: ${email}
Category: ${category || "Not provided"}
Subject: ${subject}

Message:
${message}
    `,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2>New Contact Inquiry</h2>
        <p><strong>Full Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Category:</strong> ${category || "Not provided"}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <div style="white-space: pre-wrap; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px;">
          ${message}
        </div>
      </div>
    `,
  });
}