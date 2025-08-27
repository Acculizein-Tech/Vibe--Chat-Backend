import nodemailer from 'nodemailer';

const sendEmail = async ({ to, subject, text }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,      // your gmail
      pass: process.env.EMAIL_PASS       // app password (not your Gmail password)
    }
  });

  const mailOptions = {
    from: `"Bizvility" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;



// import nodemailer from 'nodemailer';

// const sendEmail = async ({ to, subject, text }) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       host: process.env.EMAIL_HOST, // e.g. email-smtp.ap-south-1.amazonaws.com
//       port: 587, // or 587
//       secure: false, // true for 465, false for 587
//       auth: {
//         user: process.env.AWS_SMTP_USER, // SMTP username from IAM
//         pass: process.env.AWS_SMTP_PASS, // SMTP password from IAM
//       },
//     });

//     // Debug check
//     console.log("SMTP USER:", process.env.AWS_SMTP_USER);

//     const mailOptions = {
//       from: `"Bizvility" <${process.env.EMAIL_USER}>`, 
//       // from me hamesha SES verified email/domain ka hi use hoga
//       to,
//       subject,
//       text,
//     };

//     const info = await transporter.sendMail(mailOptions);
//     console.log("✅ Email sent successfully:", info.messageId);

//   } catch (err) {
//     console.error("❌ Email sending failed:", err);
//   }
// };

// export default sendEmail;
