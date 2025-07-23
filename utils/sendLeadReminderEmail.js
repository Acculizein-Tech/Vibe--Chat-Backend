import nodemailer from 'nodemailer';

export const sendLeadReminderEmail = async (to, leadName, followUpDate) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"BizListing" <${process.env.EMAIL_USER}>`,
    to,
    subject: '⏰ Follow-Up Reminder',
    html: `
      <p>Hello,</p>
      <p>This is a gentle reminder to follow up with:</p>
      <ul>
        <li><strong>Name:</strong> ${leadName}</li>
        <li><strong>Follow-Up Date:</strong> ${new Date(followUpDate).toLocaleString()}</li>
      </ul>
      <p>Regards,<br>BizListing Sales System</p>
    `
  };

  await transporter.sendMail(mailOptions);
};
