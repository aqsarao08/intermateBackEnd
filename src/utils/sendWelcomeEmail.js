import { getMailer } from "./mailer.js";

export async function sendWelcomeEmail({ to, name }) {
  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is missing in .env");
  }

  const transporter = getMailer();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Welcome to InterMate 🎉",
    text: `Hello ${name},

Welcome to InterMate!

Your account has been created successfully.
You can now log in and start preparing for interviews.

Best wishes,
The InterMate Team`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2>Welcome to InterMate 🎉</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your account has been created successfully.</p>
        <p>You can now log in and start your interview preparation journey.</p>
        <p style="margin-top: 24px;">Best wishes,<br />The InterMate Team</p>
      </div>
    `,
  });
}