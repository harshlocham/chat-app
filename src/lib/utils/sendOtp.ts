// lib/sendOtpEmail.ts
import nodemailer from "nodemailer";

export const sendOtpEmail = async (to: string, otp: string) => {
  // ✅ Configure your SMTP transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,         // e.g. smtp.gmail.com
    port: Number(process.env.SMTP_PORT), // e.g. 465 for SSL or 587 for TLS
    secure: true,                        // true for port 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // 📩 Email HTML template
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; background: #fff; padding: 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
      <h2 style="color:#333;">Verify Your Email Address</h2>
      <p>Hello 👋,</p>
      <p>Thank you for signing up for <strong>${process.env.APP_NAME || "Our App"}</strong>.<br/>
      Use the following verification code to complete your registration:</p>
      <div style="font-size: 24px; font-weight: bold; letter-spacing: 6px; color: #2d6cdf; background: #f0f4ff; padding: 12px 0; border-radius: 6px; text-align: center; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code will expire in <strong>10 minutes</strong>. If you didn’t request this, you can safely ignore this email.</p>
      <div style="font-size: 12px; color: #888; margin-top: 20px; text-align: center;">
        © ${process.env.APP_NAME || "Our App"} · Do not share this code with anyone.
      </div>
    </div>
  `;

  // 📨 Send the email
  await transporter.sendMail({
    from: `"${process.env.APP_NAME || "Our App"}" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your Verification Code",
    html,
  });
};