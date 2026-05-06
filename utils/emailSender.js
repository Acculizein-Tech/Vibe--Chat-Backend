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



import dotenv from "dotenv";
dotenv.config();

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const sesClient = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim(),
  },
});

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    // 🔍 DEBUG LOGS
    console.log("📧 EMAIL DEBUG START -------------------");
    console.log("FROM:", process.env.EMAIL_FROM);
    console.log("TO:", to);
    console.log("REGION:", process.env.AWS_REGION);
    console.log(
      "KEY EXISTS:",
      !!process.env.AWS_ACCESS_KEY_ID,
      "SECRET EXISTS:",
      !!process.env.AWS_SECRET_ACCESS_KEY
    );

    // ❗ VALIDATION
    if (!process.env.EMAIL_FROM) {
      throw new Error("EMAIL_FROM missing in env");
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("AWS credentials missing in env");
    }

    if (!to) {
      throw new Error("Recipient email missing");
    }

    const command = new SendEmailCommand({
      FromEmailAddress: process.env.EMAIL_FROM,
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject || "No Subject",
          },
          Body: {
            Text: {
              Data: text || "No text content",
            },
            Html: {
              Data: html || "<p>No HTML content</p>",
            },
          },
        },
      },
    });

    const response = await sesClient.send(command);

    console.log("✅ SES Email sent successfully");
    console.log("📨 MessageId:", response.MessageId);
    console.log("📧 EMAIL DEBUG END -------------------");

    return response;

  } catch (err) {
    console.error("❌ EMAIL FAILED -------------------");

    // 🔍 Deep debug
    console.error("MESSAGE:", err.message);
    console.error("STACK:", err.stack);

    if (err.name) console.error("ERROR NAME:", err.name);
    if (err.Code) console.error("ERROR CODE:", err.Code);
    if (err.$metadata) console.error("METADATA:", err.$metadata);

    console.error("❌ EMAIL FAILED END -------------------");

    throw err;
  }
};

export default sendEmail;