const roles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403);
      throw new Error('Forbidden: Insufficient permissions');
    }
    next();
  };
};

export default roles;