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

    console.log("📧 EMAIL DEBUG START -------------------");
    console.log("FROM:", process.env.EMAIL_FROM);
    console.log("TO:", to);


    if (!process.env.EMAIL_FROM) {
      throw new Error("EMAIL_FROM missing in env");
    }

    if (!to) {
      throw new Error("Recipient email missing");
    }


    // ✅ Default OTP Email Template
    const emailHtml =
      html ||
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Email Verification</title>
      </head>

      <body style="
        margin:0;
        padding:0;
        background:#f4f4f4;
        font-family:Arial, sans-serif;
      ">

        <div style="
          max-width:600px;
          margin:40px auto;
          background:#ffffff;
          padding:30px;
          border-radius:12px;
        ">

          <h2 style="
            color:#111827;
            text-align:center;
          ">
            Verify your email
          </h2>


          <p style="
            color:#4b5563;
            font-size:16px;
          ">
            Thank you for creating your account.
            Please use the verification code below:
          </p>


          <div style="
            margin:30px 0;
            text-align:center;
          ">

            <span style="
              display:inline-block;
              background:#111827;
              color:white;
              font-size:32px;
              letter-spacing:8px;
              padding:15px 25px;
              border-radius:10px;
              font-weight:bold;
            ">
              ${text?.match(/\d{6}/)?.[0] || "------"}
            </span>

          </div>


          <p style="
            color:#6b7280;
            font-size:14px;
          ">
            This verification code is valid for 10 minutes.
          </p>


          <p style="
            color:#6b7280;
            font-size:14px;
          ">
            If you did not request this code, you can safely ignore this email.
          </p>


          <hr />


          <p style="
            text-align:center;
            color:#9ca3af;
            font-size:12px;
          ">
            © Bizvility
          </p>


        </div>

      </body>
      </html>
      `;


    const command = new SendEmailCommand({

      FromEmailAddress: process.env.EMAIL_FROM,

      Destination:{
        ToAddresses:[to],
      },


      Content:{
        Simple:{

          Subject:{
            Data: subject || "Verify your email",
          },


          Body:{

            Text:{
              Data:
                text ||
                "Your email verification code is required.",
            },


            Html:{
              Data: emailHtml,
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


  } catch(err){

    console.error("❌ EMAIL FAILED -------------------");
    console.error("MESSAGE:", err.message);
    console.error("STACK:", err.stack);

    throw err;
  }
};


export default sendEmail;