// controllers/leadController.js
import asyncHandler from '../utils/asyncHandler.js';
import Lead from '../models/Leads.js';
import User from '../models/user.js';

// ✅ Create a new lead
// ✅ Create a new lead
export const createLead = asyncHandler(async (req, res) => {
  const { name, contact, businessType, notes } = req.body;

  // ⏰ Set followUpDate to 2 minutes from now
  const followUpDate = new Date(Date.now() + 2 * 60 * 1000);

  const lead = await Lead.create({
    name, 
    contact,
    businessType,
    followUpDate,
    notes,
    salesUser: req.user._id
  });

  res.status(201).json({ message: 'Lead created successfully', lead });
});






// ✅ Get all leads

// ✅ Get all leads for the logged-in sales user
export const getLeadsForUser = asyncHandler(async (req, res) => {
  const leads = await Lead.find({ salesUser: req.user._id }).sort({ followUpDate: 1 });
  res.status(200).json({ leads });
});




// ✅ Update a lead
// export const updateLead = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const { name, contact, businessType, status, followUpDate, notes } = req.body;

//   const lead = await Lead.findOneAndUpdate(
//     { _id: id, salesUser: req.user._id },
//     { name, contact, businessType, status, followUpDate, notes },
//     { new: true }
//   );

//   if (!lead) {
//     res.status(404);
//     throw new Error('Lead not found or unauthorized');
//   }

//   res.status(200).json({ message: 'Lead updated', lead });
// });

// ✅ Delete a lead
// export const deleteLead = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const lead = await Lead.findOneAndDelete({ _id: id, salesUser: req.user._id });

//   if (!lead) {
//     res.status(404);
//     throw new Error('Lead not found or unauthorized');
//   }

//   res.status(200).json({ message: 'Lead deleted successfully' });
// });

export const updateLead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, contact, businessType, status, followUpDate, notes } = req.body;

  const query = { _id: id };

  // Only restrict by salesUser if the user is a sales role
  if (req.user.role === 'sales') {
    query.salesUser = req.user._id;
  }

  const lead = await Lead.findOneAndUpdate(
    query,
    { name, contact, businessType, status, followUpDate, notes },
    { new: true }
  );

  if (!lead) {
    res.status(404);
    throw new Error('Lead not found or unauthorized');
  }

  res.status(200).json({ message: 'Lead updated', lead });
});

export const deleteLead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const query = { _id: id };

  // Only restrict to salesUser if the user is a sales role
  if (req.user.role === 'sales') {
    query.salesUser = req.user._id;
  }

  const lead = await Lead.findOneAndDelete(query);

  if (!lead) {
    res.status(404);
    throw new Error('Lead not found or unauthorized');
  }

  res.status(200).json({ message: 'Lead deleted successfully' });
});

// GET /api/leads/stats
export const getLeadStats = asyncHandler(async (req, res) => {
  const total = await Lead.countDocuments();
  const byStatus = await Lead.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  res.json({
    total,
    statusCounts: byStatus.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {})
  });
});

//assign a lead to a sales user
// 🔁 Assign one or more leads to a sales user
export const assignLeadsToSalesUser = asyncHandler(async (req, res) => {
  const { salesUserId, leadIds } = req.body;

  // 🛡️ Validate sales user
  const salesUser = await User.findById(salesUserId);
  if (!salesUser || salesUser.role !== 'sales') {
    return res.status(400).json({ message: 'Invalid sales user' });
  }

  // ✅ Normalize input: allow single string or array of strings
  const leadsArray = Array.isArray(leadIds) ? leadIds : [leadIds];

  if (leadsArray.length === 0) {
    return res.status(400).json({ message: 'At least one leadId is required' });
  }

  const result = await Lead.updateMany(
    { _id: { $in: leadsArray } },
    { $set: { salesUser: salesUserId } }
  );

  res.status(200).json({
    message: `${result.modifiedCount} lead(s) assigned to ${salesUser.fullName}`,
    modifiedCount: result.modifiedCount
  });
});



//get the all leads
export const getAllLeads = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  const search = req.query.search || '';

  // 🔍 Build filter if searching
  const filter = {
    $or: [
      { name: { $regex: search, $options: 'i' } },
      { contact: { $regex: search, $options: 'i' } },
      { businessType: { $regex: search, $options: 'i' } }
    ]
  };

  const leads = await Lead.find(filter)
    .sort({ followUpDate: 1 })
    .skip(skip)
    .limit(limit);

  const total = await Lead.countDocuments(filter);

  res.status(200).json({
    message: 'Leads fetched successfully',
    page,
    totalPages: Math.ceil(total / limit),
    totalLeads: total,
    leads
  });
});


// 📊 Get lead count per sales user
export const getLeadCountsPerSalesUser = asyncHandler(async (req, res) => {
  const counts = await Lead.aggregate([
    {
      $match: { salesUser: { $ne: null } }
    },
    {
      $group: {
        _id: '$salesUser',
        totalLeads: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'salesUser'
      }
    },
    {
      $unwind: '$salesUser'
    },
    {
      $project: {
        salesUserId: '$_id',
        name: '$salesUser.fullName',
        email: '$salesUser.email',
        totalLeads: 1
      }
    }
  ]);

  res.status(200).json({
    message: 'Lead counts per sales user',
    data: counts
  });
});
