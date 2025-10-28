import jwt from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/user.js';

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided. Please login to continue.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.refreshTokens || user.refreshTokens.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Error:', error.message);
    return res.status(401).json({
      success: false,
      message:
        error.name === 'TokenExpiredError'
          ? 'Token expired. Please login again.'
          : 'Invalid token. Please login again.'
    });
  }
});

export { protect };
