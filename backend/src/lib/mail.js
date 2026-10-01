import nodemailer from "nodemailer";

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    throw new Error(
      "Email service configuration missing. Please ensure EMAIL_USER and EMAIL_PASS are set in backend .env."
    );
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    pool: true, // Reuse open connection pool for fast subsequent dispatches
    maxConnections: 3,
    maxMessages: 50,
    auth: {
      user: emailUser.trim(),
      pass: emailPass.replace(/\s+/g, ""),
    },
  });

  return transporter;
};

export const sendOtpEmail = async (email, otp) => {
  const mailTransporter = getTransporter();
  const emailUser = process.env.EMAIL_USER?.trim();

  const mailOptions = {
    from: `"Speako" <${emailUser}>`,
    to: email,
    subject: "Your Speako Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded-lg; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #16a34a; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">Speako</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Language & Communication Community</p>
        </div>
        <div style="padding: 20px; background-color: #f8fafc; border-radius: 8px; text-align: center; margin-bottom: 24px;">
          <p style="color: #334155; font-size: 15px; margin-bottom: 16px;">Use the following 6-digit verification code to complete your registration:</p>
          <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0f172a; margin: 16px 0; font-family: monospace;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 16px;">This code will expire in <strong>10 minutes</strong>.</p>
        </div>
        <div style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
          <p style="margin: 0;">If you did not request this verification code, please ignore this email.</p>
          <p style="margin: 4px 0 0 0;">Never share your verification code with anyone.</p>
        </div>
      </div>
    `,
  };

  await mailTransporter.sendMail(mailOptions);
};
