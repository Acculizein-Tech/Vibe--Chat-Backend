//SuperAdminController.js
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/user.js';


// get all users
export const getAllUsers = asyncHandler(async (req, res) => {
  // if (req.user.role !== 'superadmin') {
  //   return res.status(403).json({ message: 'Access denied: SuperAdmin only.' });
  // }

  // Get all users without sensitive fields
  const users = await User.find().select(' -refreshTokens -emailVerifyOTP -resetPasswordOTP -emailVerifyExpires -resetPasswordExpires').sort({ createdAt: -1 });

  // For each user, count how many businesses they own
//   const usersWithBusinessCounts = await Promise.all(
//     users.map(async (user) => {
//       const businessCount = await Business.countDocuments({ owner: user._id });

//       return {
//         ...user.toObject(),
//         totalBusinesses: businessCount
//       };
//     })
//   );

  res.status(200).json({
    success: true,
    //,
    data: users
  });
});

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

//add new user
export const addNewUser = asyncHandler(async (req, res) => {
  // Check if user is superadmin
  // if (req.user.role !== 'superadmin') {
  //   return res.status(403).json({ message: 'Access denied: SuperAdmin only.' });
  // }

  // Define allowed fields for the user
  const allowedFields = ['fullName', 'email', 'password', 'role'];
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

//update the user by id
export const updateUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const allowedFields = ['fullName', 'email', 'role'];
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