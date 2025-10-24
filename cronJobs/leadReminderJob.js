// import cron from 'node-cron';
// import Lead from '../models/Leads.js';
// import User from '../models/user.js';
// import { sendLeadReminderEmail } from '../utils/sendLeadReminderEmail.js';

// // Run every minute (for testing) — adjust to '0 9 * * *' for 9 AM daily
// cron.schedule('* * * * *', async () => {
//   console.log('⏰ Running lead follow-up reminder cron');

//   const now = new Date();
//   const startOfMinute = new Date(now.setSeconds(0, 0));
//   const endOfMinute = new Date(now.setSeconds(59, 999));

//   try {
//     const leads = await Lead.find({
//       followUpDate: { $gte: startOfMinute, $lte: endOfMinute }
//     }).populate('salesUser', 'email fullName');

//     if (!leads.length) {
//       console.log('✅ No follow-up reminders for this minute.');
//       return;
//     }

//     for (const lead of leads) {
//       const salesUser = lead.salesUser;

//       if (!salesUser || !salesUser.email) {
//         console.warn(`⚠️ No email found for lead: ${lead.name}`);
//         continue;
//       }

//       try {
//         await sendLeadReminderEmail(
//           salesUser.email,
//           lead.name,
//           lead.followUpDate
//         );

//         console.log(`📧 Email sent to ${salesUser.email} for lead ${lead.name}`);
//       } catch (err) {
//         console.error(`❌ Failed to send email to ${salesUser.email}: ${err.message}`);
//       }
//     }

//   } catch (err) {
//     console.error('❌ Cron job error:', err.message);
//   }
// });
