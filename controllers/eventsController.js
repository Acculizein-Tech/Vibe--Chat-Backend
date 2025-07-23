// controllers/eventController.js
// controllers/eventController.js
import Event from '../models/Events.js';
import Business from '../models/Business.js';
import asyncHandler from '../utils/asyncHandler.js';
import { notifyRole } from '../utils/sendNotification.js';
import { uploadToS3 } from '../middlewares/upload.js';
import fs from 'fs';

// ✅ Create new event with S3 upload
export const createEvent = asyncHandler(async (req, res) => {
  const { business, title, description, startTime, endTime, link, location } = req.body;

  const businessExists = await Business.findById(business);
  if (!businessExists) {
    return res.status(404).json({ message: 'Business not found' });
  }

  let imageUrl = null;
  if (req.file) {
    imageUrl = await uploadToS3(req.file);
    fs.unlinkSync(req.file.req); // clean local temp file
  }

  const event = await Event.create({
    business,
    title,
    description,
    startTime,
    endTime,
    link,
    location,
    eventImages: imageUrl,
    isApproved: false
  });

  const notifyPayload = {
    type: 'EVENT_REQUEST',
    title: '📅 New Event Submitted',
    message: `An event "${title}" has been submitted and is awaiting approval.`,
    data: {
      eventId: event._id,
      businessId: business,
      redirectPath: `/admin/events/${event._id}`
    }
  };

  const eventsData = await Promise.all([
    notifyRole({ role: 'admin', ...notifyPayload }),
    notifyRole({ role: 'superadmin', ...notifyPayload })
  ]);

  res.status(201).json({
    message: 'Event created successfully',
    event,
    eventsData
  });
});


// ✅ Update event with optional image upload to S3
export const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (req.file) {
    const imageUrl = await uploadToS3(req.file);
    updates.eventImages = imageUrl;
    fs.unlinkSync(req.file.path); // clean local temp file
  }

  const updated = await Event.findByIdAndUpdate(id, updates, { new: true });

  if (!updated) {
    return res.status(404).json({ message: 'Event not found' });
  }

  res.status(200).json({
    message: 'Event updated successfully',
    event: updated
  });
});


// ✅ Delete event
export const deleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await Event.findByIdAndDelete(id);
  if (!deleted) {
    return res.status(404).json({ message: 'Event not found' });
  }

  res.status(200).json({ message: 'Event deleted successfully' });
});

// ✅ Get events by business
export const getEventsByBusiness = asyncHandler(async (req, res) => {
  const { businessId } = req.params;

  const events = await Event.find({ business: businessId }).sort({ startTime: 1 });

  res.status(200).json({
    message: 'Events fetched successfully',
    events
  });
});

// ✅ Approve event (admin)
// export const approveEvent = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const event = await Event.findByIdAndUpdate(id, { isApproved: true }, { new: true });

//   if (!event) {
//     return res.status(404).json({ message: 'Event not found' });
//   }

//   res.status(200).json({
//     message: 'Event approved',
//     event
//   });
// });

// ✅ Update event (SuperAdmin)
export const approveEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    startTime,
    endTime,
    link,
    location,
    isApproved,
    eventImages
  } = req.body;

  const updatedFields = {
    title,
    description,
    startTime,
    endTime,
    link,
    location,
    isApproved,
    eventImages
  };

  const event = await Event.findByIdAndUpdate(id, updatedFields, { new: true });

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  res.status(200).json({
    message: 'Event updated successfully',
    event
  });
});


// ✅ Get all events according to user id
// ✅ Get all events created by the logged-in user
export const getEventsByUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Step 1: Find all businesses owned by this user
  const businesses = await Business.find({ owner: userId });

  if (!businesses || businesses.length === 0) {
    return res.status(404).json({ message: 'No businesses found for this user' });
  }

  // Extract all business IDs
  const businessIds = businesses.map(b => b._id);

  // Step 2: Fetch events for all those businesses
  const events = await Event.find({ business: { $in: businessIds } }).sort({ date: 1 });

  res.status(200).json({
    message: 'Events fetched successfully',
    businessIds,
    count: events.length,
    events
  });
});

//get all events
export const getAllEvents = asyncHandler(async (req, res) => {
  const events = await Event.find().sort({ startTime: -1 });

  res.status(200).json({
    message: 'All events fetched successfully',
    count: events.length,
    events
  });
});
