import Notification from '../models/Notification.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const { _id: userId, role } = req.user;
console.log("Fetching notifications for user:", userId, "with role:", role);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  const unreadOnly = req.query.unreadOnly === "true";

  const filter = {
    $or: [
      { recipient: userId },
      { scope: "ROLE", role },
      { scope: "GLOBAL" }
    ]
  };

  if (unreadOnly) filter.isRead = false;

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Notification.countDocuments(filter);

  res.status(200).json({
    notifications,
    total,
    page,
    limit
  });
});





export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  notification.isRead = true;
  await notification.save();

  res.status(200).json({ message: 'Notification marked as read' });
});


// controllers/notificationController.js
// controllers/notificationController.js
export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: userId },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  res.status(200).json({ message: "Marked as read" });
});



// PATCH /api/notifications/mark-all-read

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const { _id: userId, role } = req.user;

  const result = await Notification.updateMany(
    {
      $or: [
        { recipient: userId },
        { scope: "ROLE", role }
      ],
      isRead: false
    },
    { isRead: true }
  );

  res.status(200).json({
    message: "All notifications marked as read",
    modifiedCount: result.modifiedCount
  });
});

export const getChatUnreadCounts = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const counts = await Notification.aggregate([
    {
      $match: {
        recipient: userId,
        isRead: false,
        type: "NEW_MESSAGE"
      }
    },
    {
      $group: {
        _id: "$data.conversationId",
        unreadCount: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json(counts);
});
