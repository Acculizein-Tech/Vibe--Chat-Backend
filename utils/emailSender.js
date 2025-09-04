// import nodemailer from 'nodemailer';

// const sendEmail = async ({ to, subject, text }) => {
//   const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//       user: process.env.EMAIL_USER,      // your gmail
//       pass: process.env.EMAIL_PASS       // app password (not your Gmail password)
//     }
//   });

//   const mailOptions = {
//     from: `"Bizvility" <${process.env.EMAIL_USER}>`,
//     to,
//     subject,
//     text
//   };

//   await transporter.sendMail(mailOptions);
// };

// export default sendEmail;



import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, // WorkMail SMTP host
      port: process.env.EMAIL_PORT, // 465 or 587
      secure: process.env.EMAIL_SECURE === "true", // "true" ya "false" string compare hoga
      auth: {
        user: process.env.EMAIL_USER, // WorkMail full email (verify@bizvility.com)
        pass: process.env.EMAIL_PASS, // WorkMail SMTP password
      },
    });

    // Debug
    console.log("📧 Sending email from:", process.env.EMAIL_USER);

    const mailOptions = {
      from: `"Bizvility" <${process.env.EMAIL_USER}>`, // Always verified domain email
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);

    return info;
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    throw err;
  }
};

export default sendEmail;
