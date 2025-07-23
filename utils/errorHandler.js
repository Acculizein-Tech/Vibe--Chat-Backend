/**
 * Custom error handler middleware for Express
 * Handles both operational errors and programming errors
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  // Default error response
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log detailed error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('ERROR 💥', {
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err
    });
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    return res.status(400).json({
      status: 'fail',
      message: 'Validation Error',
      errors: Object.values(err.errors).map(el => el.message)
    });
  }

  if (err.code === 11000) {
    // MongoDB duplicate key error
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      status: 'fail',
      message: `${field} already exists`,
      field
    });
  }

  if (err.name === 'JsonWebTokenError') {
    // JWT malformed error
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid token. Please log in again!'
    });
  }

  if (err.name === 'TokenExpiredError') {
    // JWT expired error
    return res.status(401).json({
      status: 'fail',
      message: 'Your token has expired! Please log in again.'
    });
  }

  // Send simplified error in production
  if (process.env.NODE_ENV === 'production') {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    }
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!'
    });
  }

  // Development error handling (more verbose)
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack
  });
};

export { AppError, errorHandler };
;