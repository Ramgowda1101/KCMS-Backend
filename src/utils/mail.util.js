// src/utils/mail.util.js
const nodemailer = require("nodemailer");

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendMailIfConfigured({ to, subject, text, html }) {
  if (!to) throw new Error("No recipient");
  if (!transporter) {
    // dev fallback
    console.log("📧 [MAIL_DEV] To:", to, "Subject:", subject, "Body:", text || html);
    return { dev: true };
  }
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
  return info;
}

module.exports = { sendMailIfConfigured };
