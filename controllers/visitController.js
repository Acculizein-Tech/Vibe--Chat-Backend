import Visit from '../models/Visit.js';
import asyncHandler from '../utils/asyncHandler.js';

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
    await Visit.create({
      ip,
      user: userId,
      page,
      category,
      referrer
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
export const getVisitAnalytics = asyncHandler(async (req, res) => {
  const totalVisits = await Visit.countDocuments();
  const uniqueIPs = await Visit.distinct('ip');
  const uniqueUsers = await Visit.distinct('user', { user: { $ne: null } });

  const recent = await Visit.find()
    .sort({ timestamp: -1 })
    .limit(10)
    .populate('user', 'fullName email');

  res.status(200).json({
    totalVisits,
    uniqueIPs: uniqueIPs.length,
    registeredUsers: uniqueUsers.length,
    recentVisits: recent
  });
});
