import express from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  verifyEmailOTP,
  verifyForgotOTP,
  resendOTP,
  resetPassword
} from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';


const router = express.Router();

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.post('/refresh', refreshToken);

router.post('/forgot-password', forgotPassword);
router.post('/verify-email-otp', verifyEmailOTP);
router.post('/verify-forgot-otp', verifyForgotOTP);
router.post('/resend-otp', resendOTP);
router.post('/reset-password', resetPassword);

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

export default router;