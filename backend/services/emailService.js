const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("GMail Services connection failed");
  } else {
    console.log("GMail connected successfully and ready to send email");
  }
});

const sendOtpToEmail = async (email, otp) => {
  const html = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #2e2e2e; line-height: 1.7; background: #f8f9fb; padding: 25px; border-radius: 12px; max-width: 600px; margin: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="color: #007bff; margin: 0; font-size: 28px; letter-spacing: 1px;">
        🚀 NexChat Account Verification
      </h2>
      <p style="color: #555; margin-top: 5px;">Secure. Fast. Connected.</p>
    </div>

    <div style="background: #ffffff; padding: 25px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
      <p>Hi there 👋,</p>

      <p>We received a request to verify your <strong>NexChat Web</strong> account.</p>

      <p>Your One-Time Password (OTP) is:</p>

      <h1 style="background: linear-gradient(90deg, #00bcd4, #007bff); color: #fff; padding: 12px 24px; display: inline-block; border-radius: 8px; letter-spacing: 3px; box-shadow: 0 4px 10px rgba(0,123,255,0.3);">
        ${otp}
      </h1>

      <p style="margin-top: 15px;"><strong>This OTP is valid for 5 minutes.</strong></p>
      <p>Please <span style="color: #d32f2f;">do not share</span> this code with anyone — even if they claim to be from NexChat.</p>

      <p>If you didn’t request this verification, you can safely ignore this email.</p>

      <p style="margin-top: 25px;">Best wishes,<br/><strong>The NexChat Security Team 💬</strong></p>
    </div>

    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />

    <small style="display: block; color: #777; text-align: center;">
      🔒 This is an automated message from NexChat. Please do not reply.
    </small>
  </div>
`;
  await transporter.sendMail({
    from: `"NexChat" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your NexChat Verification Code",
    html: html,
  });
};

module.exports = sendOtpToEmail;
