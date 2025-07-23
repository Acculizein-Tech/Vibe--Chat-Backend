import asyncHandler from '../utils/asyncHandler.js';
import Business from '../models/Business.js';
import DeleteRequest from '../models/DeleteRequest.js';
import User from '../models/user.js';
import { notifyRole } from '../utils/sendNotification.js';


// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  SuperAdmin
export const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isVerified: true }),
    Business.countDocuments(),
    Business.countDocuments({ isApproved: false }),
    User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  res.json({
    totalUsers: stats[0],
    verifiedUsers: stats[1],
    totalBusinesss: stats[2],
    pendingBusinesss: stats[3],
    userRoles: stats[4]
  });
});

// @desc    Approve/reject business Businesss
// @route   PUT /api/admin/Businesss/:id
// @access  Admin/SuperAdmin
export const moderateBusiness = asyncHandler(async (req, res) => {
  const { action } = req.body; // 'approve' or 'reject'
  const Business = await Business.findById(req.params.id);

  if (!Business) {
    res.status(404);
    throw new Error('Business not found');
  }

  if (action === 'approve') {
    Business.isApproved = true;
    await Business.save();
    res.json({ message: 'Business approved successfully' });
  } else if (action === 'reject') {
    await Business.deleteOne();
    res.json({ message: 'Business rejected and removed' });
  } else {
    res.status(400);
    throw new Error('Invalid action');
  }
});

// @desc    Get all pending Businesss
// @route   GET /api/admin/Businesss/pending
// @access  Admin/SuperAdmin
export const getPendingBusinesss = asyncHandler(async (req, res) => {
  const Businesss = await Business.find({ isApproved: false })
    .populate('owner', 'email profile.name');

  res.json(Businesss);
});

// @desc    Manage user roles
// @route   PUT /api/admin/users/:id/role
// @access  SuperAdmin
export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Prevent role escalation
  if (req.user.role !== 'superadmin' && ['admin', 'superadmin'].includes(role)) {
    res.status(403);
    throw new Error('Not authorized to assign this role');
  }

  user.role = role;
  await user.save();

  res.json({
    _id: user._id,
    email: user.email,
    role: user.role
  });
});

// @desc    Verify business accounts
// @route   PUT /api/admin/business/:id/verify
// @access  Admin/SuperAdmin
export const verifyBusiness = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { 
      isVerified: true,
      $set: { 'profile.isVerified': true } 
    },
    { new: true }
  ).select('-password');

  if (!user || user.role !== 'business') {
    res.status(404);
    throw new Error('Business user not found');
  }

  res.json(user);
});

// controllers/adminController.js

//delete request for user deletion
export const requestUserDeletion = async (req, res) => {
  const { userIdToDelete, reason = '' } = req.body;
  const adminId = req.user._id;

  // 1. Make sure the user exists
  const targetUser = await User.findById(userIdToDelete);
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  // 2. Prevent self-delete
  if (userIdToDelete.toString() === adminId.toString()) {
    return res.status(400).json({ message: "You can't delete yourself" });
  }

  // 3. Prevent duplicate request
  const existing = await DeleteRequest.findOne({ userToDelete: userIdToDelete, status: 'pending' });
  if (existing) {
    return res.status(400).json({ message: 'A delete request is already pending for this user' });
  }

  // 4. Create delete request
  const deleteRequest = await DeleteRequest.create({
    requestedBy: adminId,
    userToDelete: userIdToDelete,
    reason
  });

  // 5. Notify SuperAdmin
  await notifyRole({
    role: 'superadmin',
    type: 'ADMIN_ALERT',
    title: '🚨 User Deletion Request',
    message: `Admin requested to delete user ${targetUser.fullName}`,
    data: {
      userIdToDelete,
      requestId: deleteRequest._id,
      redirectPath: `/superadmin/delete-requests/${deleteRequest._id}`
    }
  });

  res.status(200).json({
    message: 'Delete request submitted for approval',
    deleteRequest
  });
};

//delete request for business deletion
export const requestBusinessDeletion = async (req, res) => {
  const { businessId, reason = '' } = req.body;
  const adminId = req.user._id;

  const business = await Business.findById(businessId);
  if (!business) {
    return res.status(404).json({ message: 'Business not found' });
  }

  const existing = await DeleteRequest.findOne({
    businessToDelete: businessId,
    status: 'pending'
  });

  if (existing) {
    return res.status(400).json({ message: 'A delete request is already pending for this business' });
  }

  const request = await DeleteRequest.create({
    requestedBy: adminId,
    businessToDelete: businessId,
    reason
  });

  // 🔔 Notify superadmin
  await notifyRole({
    role: 'superadmin',
    type: 'ADMIN_ALERT',
    title: '🚨 Business Deletion Request',
    message: `Admin requested deletion of business "${business.name}"`,
    data: {
      businessId,
      requestId: request._id,
      redirectPath: `/superadmin/delete-requests/${request._id}`
    }
  });

  res.status(200).json({
    message: 'Business deletion request submitted for approval',
    request
  });
};
