import Enquiry from '../models/Enquiry.js';
import Leads from '../models/Leads.js';
import { notifyRole } from '../utils/sendNotification.js';
// import sanitize from 'mongo-sanitize'; // optional: if you use this for extra protection


// export const createEnquiry = async (req, res) => {
//   try {
//     const {
//       fullName = '', 
//       email = '',
//       phone = '',
//       businessName = '',
//       subject = '',
//       message = ''
//     } = req.body; // Prevent NoSQL injections if needed

//     // ✅ Basic validation
//     if (!fullName.trim() || !email.trim() || !phone.trim() || !message.trim()) {
//       return res.status(400).json({ error: "All required fields must be filled" });
//     }

//     // ✅ Save enquiry to DB
//     const enquiry = await Enquiry.create({
//       fullName: fullName.trim(),
//       email: email.trim(),
//       phone: phone.trim(),
//       businessName: businessName.trim(),
//       subject: subject.trim(),
//       message: message.trim()
//     });

//     // 📇 Create associated lead entry
//     try {
//       await Leads.create({
//         name: fullName.trim(),
//         contact: email.trim() || phone.trim(),
//         businessType: businessName.trim(),
//         status: 'New Enquiry',
//         notes: subject.trim(),
//         followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours later
//       });
//     } catch (leadErr) {
//       console.error("⚠️ Failed to create lead from enquiry:", leadErr.message);
//     }

//     // 🔔 Notify superadmin and admin
//     const notificationData = {
//       enquiryId: enquiry._id,
//       name: fullName,
//       redirectPath: `/admin/enquiries/${enquiry._id}`
//     };

//     const notificationMessage = `New enquiry received from "${fullName}".`;

//     await Promise.all([
//       notifyRole({
//         role: 'admin',
//         type: 'NEW_ENQUIRY',
//         title: '📩 New Enquiry Received',
//         message: notificationMessage,
//         data: notificationData
//       }),
//       notifyRole({
//         role: 'superadmin',
//         type: 'NEW_ENQUIRY',
//         title: '📩 New Enquiry Received',
//         message: notificationMessage,
//         data: {
//           ...notificationData,
//           redirectPath: `/superadmin/enquiries/${enquiry._id}`
//         }
//       })
//     ]);

//     return res.status(201).json({
//       message: 'Enquiry submitted successfully',
//       enquiry
//     });

//   } catch (err) {
//     console.error('❌ Server error while creating enquiry:', err.message);
//     return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
//   }
// };



export const createEnquiry = async (req, res) => {
  try {
    const {
      fullName = "",
      email = "",
      phone = "",
      businessName = "Not Specified",
      subject = "", // 👈 ab user jo bheje wahi save hoga
      message = "",
    } = req.body;

    // ✅ Basic validation
    if (!fullName.trim() || !email.trim() || !phone.trim() || !message.trim()) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    // ✅ Directly use subject (no restriction)
    const finalSubject = subject.trim() || "General Inquiry";

    // ✅ Save enquiry to DB
    const enquiry = await Enquiry.create({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      businessName: businessName.trim(),
      subject: finalSubject, // 👈 user ka diya hua save hoga
      message: message.trim(),
    });

    // 📇 Create associated lead entry
    try {
      await Leads.create({
        name: fullName.trim(),
        contact: email.trim() || phone.trim(),
        businessType: businessName.trim(),
        status: "New Enquiry",
        notes: finalSubject,
        followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hrs later
      });
    } catch (leadErr) {
      console.error("⚠️ Failed to create lead from enquiry:", leadErr);
    }

    // 🔔 Notify admins
    const notificationData = {
      enquiryId: enquiry._id,
      name: fullName,
      redirectPath: `/admin/enquiries/${enquiry._id}`,
    };

    const notificationMessage = `New enquiry received from "${fullName}".`;

    await Promise.all([
      notifyRole({
        role: "admin",
        type: "NEW_ENQUIRY_CREATED",
        title: "📩 New Enquiry Received",
        message: notificationMessage,
        data: notificationData,
      }),
      notifyRole({
        role: "superadmin",
        type: "NEW_ENQUIRY_CREATED",
        title: "📩 New Enquiry Received",
        message: notificationMessage,
        data: {
          ...notificationData,
          redirectPath: `/superadmin/enquiries/${enquiry._id}`,
        },
      }),
    ]);

    return res.status(201).json({
      message: "Enquiry submitted successfully",
      enquiry,
    });
  } catch (err) {
    console.error("❌ Server error while creating enquiry:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again later." });
  }
};




export const getAllEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    return res.status(200).json(enquiries);
  } catch (err) {
    console.error('❌ Server error while fetching enquiries:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
};