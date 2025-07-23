import Role from '../models/Role.js';

export const createRole = async (req, res) => {
  try {
    const { name, permissionIds } = req.body;
    const role = new Role({ name, permissions: permissionIds });
    await role.save();
    res.status(201).json({ message: 'Role created', role });
  } catch (err) {
    res.status(500).json({ message: 'Error creating role', error: err.message });
  }
};

export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find().populate('permissions');
    res.json(roles);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching roles', error: err.message });
  }
};
