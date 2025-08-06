import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/user.js';

const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for Bearer token in headers
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized token, Please Login to Continue');
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401);
      throw new Error('User not found');
    }

    // Optional: verify if refreshTokens exist in DB for session tracking
    // This helps ensure user has not logged out or had tokens cleared
    if (!user.refreshTokens || user.refreshTokens.length === 0) {
      res.status(401);
      throw new Error('Session expired. Please login again.');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Error:', error.message);
    res.status(401);
    throw new Error('Not authorized token, Please Login to Continue');
  }
});

export { protect };
