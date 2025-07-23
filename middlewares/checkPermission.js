import User from '../models/user.js';

export const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).populate({
        path: 'role',
        populate: { path: 'permissions' }
      });

      if (!user || !user.role) {
        return res.status(403).json({ message: 'No role assigned to user' });
      }

      const permissions = user.role.permissions.map(p => p.name);
      if (!permissions.includes(requiredPermission)) {
        return res.status(403).json({ message: 'Permission denied' });
      }

      next();
    } catch (err) {
      res.status(500).json({ message: 'Internal server error', error: err.message });
    }
  };
};
