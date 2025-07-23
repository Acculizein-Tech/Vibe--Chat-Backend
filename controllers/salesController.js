import Business from '../models/Business.js';
// import Lead from '../models/Lead.js';
import Review from '../models/Review.js';
import User from '../models/user.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getSalesDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const businesses = await Business.find({ salesExecutive: userId });
    const totalBusinesses = businesses.length;

    const businessIds = businesses.map(b => b._id);
    const reviews = await Review.find({ business: { $in: businessIds } });

    const leads = await Lead.find({ salesUser: userId });

    res.status(200).json({
      totalBusinesses,
      reviews,
      leads
    });   
  } catch (err) {
    res.status(500).json({ message: 'Error fetching dashboard', error: err.message });
  }
};
export const getReferralLink = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean();

  if (!user || user.role !== 'sales') {
    res.status(403);
    throw new Error('Only sales users can access this route');
  }

  if (!user.referralCode) {
    res.status(400);
    throw new Error('Referral code not found for this sales user');
  }

  const referralLink = `https://yourwebsite.com/register?ref=${user.referralCode}`;

  res.status(200).json({
    referralCode: user.referralCode,
    referralLink,
    message: 'Referral link generated successfully'
  });
});

// //get business by current user id
// export const getBusinessByUserId = asyncHandler(async (req, res) => {
//   const userId = req.user._id;

//   const businesses = await Business.find({ salesExecutive: userId });

//   res.status(200).json(businesses);
// });
