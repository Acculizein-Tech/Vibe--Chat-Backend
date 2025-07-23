/**
 * Wraps async route handlers to automatically catch errors
 * and forward them to Express error middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;