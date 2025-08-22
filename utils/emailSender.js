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

const sendEmail = async ({ to, subject, text }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST, // e.g. smtp.mail.us-east-1.awsapps.com
    port: 465,                    // 465 (secure) ya 587 (TLS) use hota h
    secure: true,                 // port 465 => true, port 587 => false
    auth: {
      user: process.env.EMAIL_USER,  // AWS WorkMail/SES SMTP user
      pass: process.env.EMAIL_PASS   // SMTP password
    }
  });

  const mailOptions = {
    from: `"Bizvility" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  };

  await transporter.sendMail(mailOptions);
};

export default sendEmail;
