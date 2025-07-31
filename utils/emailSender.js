import nodemailer from 'nodemailer';

const sendEmail = async ({ to, subject, text }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,      // email-smtp.us-east-1.amazonaws.com
    port: 587,
    secure: false, // TLS
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
