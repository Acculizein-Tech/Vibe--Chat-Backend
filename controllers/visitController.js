import Visit from '../models/Visit.js';
import asyncHandler from '../utils/asyncHandler.js';
import Business from '../models/Business.js';
import Review from '../models/Review.js';
import user from '../models/user.js';
import mongoose from 'mongoose';

// ✅ 1. Track a visit (public)
export const trackVisit = asyncHandler(async (req, res) => {
  try {
    // Get IP address
    let ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    if (ip?.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

    // Get logged-in user (or null if guest)
    const userId = req.user?._id || null;

    // Extract data from request
    const page = req.body.page || req.originalUrl || 'unknown';
    const category = req.body.category || null;
    const referrer = req.get('referer') || null; // Optional: Track referrer URL

    // Save visit
    // await Visit.create({
    //   ip,
    //   user: userId,
    //   page,
    //   category,
    //   referrer
    // });

    // ✅ NEW: include businessId to associate visit with a business
const businessId = req.body.businessId || null;

await Visit.create({
  ip,
  user: userId,
  page,
  category,
  referrer,
  business: businessId // ✅ Added here
});


    // ✅ Auto-lead from guest visit
  if (page === '/pricing' || page === '/partner') {
    await Lead.create({
      name: userId ? 'Registered User' : 'Guest',
      contact: userId || ip,
      businessType: 'Unknown',
      status: 'Interested',
      notes: `Visited ${page}`,
    });
  }

    res.status(200).json({ message: 'Visit tracked successfully' });
  } catch (error) {
    console.error('❌ Error in trackVisit:', error);
    res.status(500).json({ message: 'Failed to track visit', error: error.message });
  }
});


// ✅ 2. Analytics for SuperAdmin
// ✅ Enhanced Visit Analytics
export const getVisitAnalytics = asyncHandler(async (req, res) => {
  const { filter = 'all' } = req.query; // 'month', 'week', '6months', 'all'

  const now = new Date();
  let startDate;

  switch (filter) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); // 1st day of current month
      break;
    case 'week':
      startDate = new Date();
      startDate.setDate(now.getDate() - 7); // 7 days ago
      break;
    case '6months':
      startDate = new Date();
      startDate.setMonth(now.getMonth() - 6); // 6 months ago
      break;
    default:
      startDate = null; // No filter
  }

  const query = startDate ? { timestamp: { $gte: startDate } } : {};

  const totalVisits = await Visit.countDocuments(query);
  const uniqueIPs = await Visit.distinct('ip', query);
  const uniqueUsers = await Visit.distinct('user', { ...query, user: { $ne: null } });

  const recent = await Visit.find(query)
    .sort({ timestamp: -1 })
    .limit(10)
    .populate('user', 'fullName email');

  let monthlyBreakdown = [];
  let weeklyBreakdown = [];

  // 📆 6-Month Breakdown
  if (filter === '6months') {
    monthlyBreakdown = await Visit.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" }
          },
          totalVisits: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Format month name
    monthlyBreakdown = monthlyBreakdown.map(item => {
      const date = new Date(item._id.year, item._id.month - 1);
      return {
        month: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
        totalVisits: item.totalVisits
      };
    });
  }

  // 📅 7-Day Weekly Breakdown
  if (filter === 'week') {
    weeklyBreakdown = await Visit.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" }
          },
          totalVisits: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    weeklyBreakdown = weeklyBreakdown.map(item => {
      const date = new Date(item._id.year, item._id.month - 1, item._id.day);
      return {
        day: date.toDateString(), // e.g., "Wed Jul 30 2025"
        totalVisits: item.totalVisits
      };
    });
  }

  res.status(200).json({
    filter,
    totalVisits,
    uniqueIPs: uniqueIPs.length,
    registeredUsers: uniqueUsers.length,
    recentVisits: recent,
    ...(filter === '6months' && { monthlyBreakdown }),
    ...(filter === 'week' && { weeklyBreakdown })
  });
});


// ✅ User-level Analytics
export const getUserBusinessAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Step 1: Get all business listings of the logged-in user
  const businesses = await Business.find({ owner: userId }).select('_id name');

  if (!businesses.length) {
    return res.status(404).json({ message: "No listings found for user" });
  }

  // Step 2: Collect all business IDs
  const businessIds = businesses.map(b => b._id);

  // Step 3: Get visit count per business
  const visits = await Visit.aggregate([
    { $match: { business: { $in: businessIds } } },
    {
      $group: {
        _id: "$business",
        visitCount: { $sum: 1 }
      }
    }
  ]);

  // Step 4: Get review count per business
  const reviews = await Review.aggregate([
    { $match: { business: { $in: businessIds } } },
    {
      $group: {
        _id: "$business",
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  // Step 5: Merge business info
  const data = businesses.map(biz => {
    const visitEntry = visits.find(v => v._id.toString() === biz._id.toString());
    const reviewEntry = reviews.find(r => r._id.toString() === biz._id.toString());

    return {
      businessId: biz._id,
      name: biz.name,
      visits: visitEntry?.visitCount || 0,
      reviews: reviewEntry?.reviewCount || 0
    };
  });

  // Total views (across all listings)
  const totalViews = data.reduce((acc, curr) => acc + curr.visits, 0);
  const totalReviews = data.reduce((acc, curr) => acc + curr.reviews, 0);
 const Getdata = {
  totalViews,
  totalReviews, 
  listings: data
 };
  res.status(200).json({
    message: "User business analytics fetched successfully",
    data: Getdata
  });
});
