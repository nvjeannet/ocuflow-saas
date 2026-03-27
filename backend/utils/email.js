const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  if (!process.env.SMTP_USER) {
    console.warn('⚠️ SMTP non configuré. Email non envoyé à:', to);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"OcuFlow" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email envoyé à ${to}`);
  } catch (err) {
    console.error(`❌ Erreur envoi email à ${to}:`, err.message);
  }
};

module.exports = { sendEmail };
