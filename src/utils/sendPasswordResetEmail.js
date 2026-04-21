import { getMailer } from "./mailer.js";

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is missing in .env");
  }

  const transporter = getMailer();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Reset your InterMate password",
    text: `Hello ${name},

We received a request to reset your InterMate password.

Use the link below to choose a new password:
${resetUrl}

This link will expire in 1 hour.

If you did not request this, you can ignore this email.

Best wishes,
The InterMate Team`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2>Reset your InterMate password</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>We received a request to reset your InterMate password.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 18px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px;">
            Reset password
          </a>
        </p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <p style="margin-top: 24px;">Best wishes,<br />The InterMate Team</p>
      </div>
    `,
  });
}
