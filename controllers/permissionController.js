import Permission from '../models/Permission.js';

export const createPermission = async (req, res) => {
  try {
    const { name, description } = req.body;
    const permission = new Permission({ name, description });
    await permission.save();
    res.status(201).json({ message: 'Permission created', permission });
  } catch (err) {
    res.status(500).json({ message: 'Error creating permission', error: err.message });
  }
};

export const getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching permissions', error: err.message });
  }
};
