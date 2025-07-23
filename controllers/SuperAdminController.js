
// controllers/SuperAdminController.js

import Business from '../models/Business.js';
import User from '../models/user.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendEmail from '../utils/emailSender.js';
import Health from '../models/Health.js'; // Assuming you have a HealthMedical model
import DeleteRequest from '../models/DeleteRequest.js';


// get all users
export const getAllUsers = asyncHandler(async (req, res) => {
  // if (req.user.role !== 'superadmin') {
  //   return res.status(403).json({ message: 'Access denied: SuperAdmin only.' });
  // }

  // Get all users without sensitive fields
  const users = await User.find().select('-password -refreshTokens -emailVerifyOTP -resetPasswordOTP -emailVerifyExpires -resetPasswordExpires');

  // For each user, count how many businesses they own
  const usersWithBusinessCounts = await Promise.all(
    users.map(async (user) => {
      const businessCount = await Business.countDocuments({ owner: user._id });

      return {
        ...user.toObject(),
        totalBusinesses: businessCount
      };
    })
  );

  res.status(200).json({
    success: true,
    count: usersWithBusinessCounts.length,
    data: usersWithBusinessCounts
  });
});



//update user by id 
//create user we all done in userController.js file
// create business listing also done in businessListingController.js and edit as well.

//update superadmin by id
export const updateSuperAdminById = asyncHandler(async (req, res) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied: SuperAdmin only.' });
  }

  const { id } = req.params;
  const updates = req.body;

  const superAdmin = await User.findByIdAndUpdate(id, updates, { new: true });

  if (!superAdmin) {
    return res.status(404).json({ message: 'SuperAdmin not found.' });
  }

  res.status(200).json({
    success: true,
    data: superAdmin
  });
});


//get all business listings data

// ✅ GET all business listings with user and category references
export const getAllBusinessListings = asyncHandler(async (req, res) => {

  try {
    const businesses = await Business.find()
      .populate('owner', 'fullName email')  // ✅ this must match field name in schema
      .sort({ createdAt: -1 });

    const populatedBusinesses = await Promise.all(
      businesses.map(async (business) => {
        let categoryData = null;

        switch (business.categoryModel) {
          case 'Health':
          case 'HealthMedical':
            categoryData = await Health.findById(business.categoryRef);
            break;
          default:
            categoryData = null;
        }

        return {
          ...business.toObject(),
          categoryData
        };
      })
    );

    res.json({ success: true, count: populatedBusinesses.length, data: populatedBusinesses });
  } catch (error) {
    console.error('Error fetching business listings:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

//update the user by id
export const updateUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const allowedFields = ['fullName', 'email', 'username', 'city', 'state', 'country', 'zipCode', 'role'];
  const updateData = {};

  for (let key of allowedFields) {
    if (req.body[key] !== undefined) {
      updateData[key] = req.body[key];
    }
  }

  // ✅ Handle nested profile fields
  updateData.profile = {
    name: req.body['profile.name'],
    phone: req.body['profile.phone'],
    avatar: req.file ? `/uploads/userImage/${req.file.filename}` : undefined
  };

  // Remove undefined fields from profile
  Object.keys(updateData.profile).forEach(
    (key) => updateData.profile[key] === undefined && delete updateData.profile[key]
  );

  const updatedUser = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).select('-password -refreshTokens');

  if (!updatedUser) {
    res.status(404);
    throw new Error('User not found');
  }

  res.status(200).json({
    status: 'success',
    message: 'User updated successfully',
    data: updatedUser,
  });
});

//Delete user by id
export const deleteUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findByIdAndDelete(id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.status(200).json({
    success: true,
    message: 'User deleted successfully.'
  });
});

//delete the listing by id
export const deleteBusinessListingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const businessListing = await Business.findByIdAndDelete(id);

  if (!businessListing) {
    return res.status(404).json({ message: 'Business listing not found.' });
  }

  res.status(200).json({
    success: true,
    message: 'Business listing deleted successfully.'
  });
});

//add new user
export const addNewUser = asyncHandler(async (req, res) => {
  // Check if user is superadmin
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied: SuperAdmin only.' });
  }

  // Define allowed fields for the user
  const allowedFields = ['fullName', 'email', 'password', 'role', 'city', 'state', 'country', 'zipCode'];
  const userData = {};

  // Populate userData with allowed fields from req.body
  for (let key of allowedFields) {
    if (req.body[key] !== undefined) {
      userData[key] = req.body[key];
    }
  }

  // Validate required fields
  if (!userData.fullName || !userData.email || !userData.password || !userData.role) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email: userData.email });
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists.' });
  }

  // Handle nested profile fields
  userData.profile = {
    name: req.body['profile.name'],
    phone: req.body['profile.phone'],
    avatar: req.file ? `/uploads/userImage/${req.file.filename}` : undefined
  };

  // Remove undefined fields from profile
  Object.keys(userData.profile).forEach(
    (key) => userData.profile[key] === undefined && delete userData.profile[key]
  );

  // Create new user
  const newUser = new User(userData);

  await newUser.save();

  // Respond with success
  res.status(201).json({
    success: true,
    message: 'User created successfully.',
    data: {
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      
      city: newUser.city,
      state: newUser.state,
      country: newUser.country,
      zipCode: newUser.zipCode,
      profile: newUser.profile,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    },
  });
});

//create user with  permission
export const createUserBySuperAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const newUser = await User.create({
    name,
    email,
    password,
    role,
    is_verified: true
  });

  res.status(201).json({
    message: 'User created successfully',
    user: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role
    }
  });
});
// request user deletion
export const handleDeleteRequest = async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action. Must be "approve" or "reject"' });
  }

  const deleteRequest = await DeleteRequest.findById(requestId);
  if (!deleteRequest || deleteRequest.status !== 'pending') {
    return res.status(404).json({ message: 'Delete request not found or already processed' });
  }

  // Optional: Fetch user to check existence
  const userToDelete = await User.findById(deleteRequest.userToDelete);
  if (action === 'approve') {
    if (!userToDelete) {
      return res.status(404).json({ message: 'Target user not found' });
    }
    await userToDelete.deleteOne(); // Safer than findByIdAndDelete for middleware
    deleteRequest.status = 'approved';
  } else {
    deleteRequest.status = 'rejected';
  }

  deleteRequest.resolvedBy = req.user._id;
  deleteRequest.resolvedAt = new Date();
  await deleteRequest.save();

  res.status(200).json({
    message: `Delete request ${action}d successfully`,
    deleteRequest
  });
};


//handle the delete request for business deletion
export const handleDeleteRequestforBusiness = async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  const request = await DeleteRequest.findById(requestId);
  if (!request || request.status !== 'pending') {
    return res.status(404).json({ message: 'Request not found or already handled' });
  }

  if (action === 'approve') {
    // 👤 User deletion
    if (request.userToDelete) {
      await User.findByIdAndDelete(request.userToDelete);
    }

    // 🏢 Business deletion
    if (request.businessToDelete) {
      await Business.findByIdAndDelete(request.businessToDelete);
    }

    request.status = 'approved';
    request.resolvedBy = req.user._id;
    request.resolvedAt = new Date();

  } else if (action === 'reject') {
    request.status = 'rejected';
    request.resolvedBy = req.user._id;
    request.resolvedAt = new Date();
  } else {
    return res.status(400).json({ message: 'Invalid action. Use approve or reject.' });
  }

  await request.save();

  res.status(200).json({
    message: `Delete request ${action}d successfully`,
    request
  });
};
