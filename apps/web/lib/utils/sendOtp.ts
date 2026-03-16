import nodemailer from "nodemailer";

function getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!user || !pass) {
        throw new Error("SMTP credentials are not configured");
    }

    return nodemailer.createTransport({
        host: host || "smtp.gmail.com",
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
    const transporter = getTransporter();

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER,
        to: email,
        subject: "Your verification code",
        text: `Your OTP is ${otp}. It expires in 5 minutes.`,
        html: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    });
}
