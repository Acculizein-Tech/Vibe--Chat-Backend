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

const isConnectionResetLikeError = (err) => {
  const code = String(err?.code || "").toUpperCase();
  const syscall = String(err?.syscall || "").toLowerCase();
  const name = String(err?.name || "").toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  return (
    ["ECONNRESET", "ECONNABORTED", "EPIPE", "ETIMEDOUT", "ABORT_ERR"].includes(code) ||
    syscall === "read" ||
    name.includes("abort") ||
    msg.includes("socket hang up") ||
    msg.includes("connection reset")
  );
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Default error response
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Normalize transient network errors (S3, upstream APIs, client disconnects)
  if (isConnectionResetLikeError(err)) {
    const isClientAbort =
      String(err?.code || "").toUpperCase() === "ABORT_ERR" ||
      Boolean(req?.aborted);
    err.statusCode = isClientAbort ? 499 : 503;
    err.status = 'error';
    err.isOperational = true;
    err.message =
      err.message ||
      (isClientAbort
        ? "Request canceled by client"
        : "Temporary network issue. Please retry.");
  }

  // Log detailed error in development
  if (process.env.NODE_ENV === 'development') {
    const payload = {
      status: err.status,
      message: err.message,
      code: err?.code,
      statusCode: err?.statusCode,
      path: req?.originalUrl || req?.url,
      method: req?.method,
    };

    if (isConnectionResetLikeError(err)) {
      console.warn('WARN network/transient error', payload);
    } else {
      console.error('ERROR ??', {
        ...payload,
        stack: err.stack,
        error: err,
      });
    }
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    return res.status(400).json({
      status: 'fail',
      message: 'Password length must be at least 8 characters',
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
    console.error('ERROR ??', err);
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
