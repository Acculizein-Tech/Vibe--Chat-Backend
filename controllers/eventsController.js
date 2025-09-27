// controllers/eventController.js
// controllers/eventController.js
import Event from "../models/Events.js";
import Business from "../models/Business.js";
import asyncHandler from "../utils/asyncHandler.js";
import { notifyRole } from "../utils/sendNotification.js";
import { uploadToS3 } from "../middlewares/upload.js";
import fs from "fs";

// export const createEvent = asyncHandler(async (req, res) => {
//   try {
//     const { title, description, date, location, ...otherFields } = req.body;

//     let eventImages = "";

//     // if (req.file) {
//     //   const s3Url = await uploadToS3(req.file, req); // Returns full S3 URL
//     //   eventImages = s3Url;
//     // }
//     if (req.file) {
//       const s3Response = await uploadToS3(req.file, req);
//       eventImages = s3Response.url; // ✅ only the string
//     }

//     const newEvent = new Event({
//       title,
//       description,
//       date,
//       location,
//       eventImages: eventImages,
//       ...otherFields,
//     });

//     const savedEvent = await newEvent.save();
//     res.status(201).json({
//       success: true,
//       message: "Event created successfully",
//       // imageUrl: eventsImage,
//       data: savedEvent,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Event creation failed",
//       error: err.message,
//     });
//   }
// });

//update the event
// export const updateEvent = asyncHandler(async (req, res) => {
//   try {
//     const { id } = req.params;
//     let updatedData = { ...req.body };

//     if (req.file) {
//       const s3Response = await uploadToS3(req.file, req); // { url: "https://..." }
//       updatedData.eventImages = s3Response.url; // ✅ fixed field name
//     }

//     const updatedEvent = await Event.findByIdAndUpdate(id, updatedData, {
//       new: true,
//       runValidators: true,
//     });

//     if (!updatedEvent) {
//       return res.status(404).json({
//         success: false,
//         message: "Event not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Event updated successfully",
//       data: updatedEvent,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Event update failed",
//       error: err.message,
//     });
//   }
// });  



export const createEvent = asyncHandler(async (req, res) => {
  try {
    const { title, description, startTime, endTime, location, business: businessId, ...otherFields } = req.body;

    if (!businessId) {
      return res.status(400).json({ success: false, message: "Business ID is required" });
    }

    let eventImages = "";
    if (req.file) {
      const s3Response = await uploadToS3(req.file, req); // Returns full S3 URL
      eventImages = s3Response.url;
    }

    // 🔹 Fetch business category
    const business = await Business.findById(businessId).select('category');
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    // 🔹 Construct redirect path
    const redirectPath = `/categories/${business.category}/${business._id}`;

    // 🔹 Create event
    const newEvent = new Event({
      title,
      description,
      startTime,
      endTime,
      location,
      business: businessId,
      eventImages,
      redirectPath,  // save redirect path in DB
      ...otherFields,
    });

    const savedEvent = await newEvent.save();

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: savedEvent,
    });

  } catch (err) {
    console.error("Event creation error:", err);
    res.status(500).json({
      success: false,
      message: "Event creation failed",
      error: err.message,
    });
  }
});


export const updateEvent = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    let updatedData = { ...req.body };

    // 🔹 Handle eventImages update (file upload)
    if (req.file) {
      const s3Response = await uploadToS3(req.file, req); // { url: "https://..." }
      updatedData.eventImages = s3Response.url; // ✅ save in correct field
    }

    // 🔹 Prevent overwriting business field
    if (updatedData.business) delete updatedData.business;

    // 🔹 Update the event without populating
    await Event.findByIdAndUpdate(id, updatedData, {
      new: true,
      runValidators: true,
    });

    // 🔹 Fetch updated event with populated business category
    const updatedEvent = await Event.findById(id)
      .populate('business', 'category') // fetch only category
      .lean(); // JS object for easy access

    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // 🔹 Construct redirect path
    const category = updatedEvent.business?.category || 'general';
    const businessId = updatedEvent.business?._id || id;
    const redirectPath = `/categories/${category}/${businessId}`;

    console.log("Updated Event:", updatedEvent);
    console.log("Redirect Path:", redirectPath);

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
       data: {
    ...updatedEvent,       // existing event fields
    redirectPath,          // redirectPath ko data ke andar include karo
  }
       // send redirect path
    });

  } catch (err) {
    console.error("Event update error:", err);
    res.status(500).json({
      success: false,
      message: "Event update failed",
      error: err.message,
    });
  }
});






// ✅ Delete event
export const deleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await Event.findByIdAndDelete(id);
  if (!deleted) {
    return res.status(404).json({ message: "Event not found" });
  }

  res.status(200).json({ message: "Event deleted successfully" });
});

// ✅ Get events by business
export const getEventsByBusiness = asyncHandler(async (req, res) => {
  const { businessId } = req.params;

  const events = await Event.find({ business: businessId }).sort({
    startTime: 1,
  });

  res.status(200).json({
    message: "Events fetched successfully",
    events,
  });
});


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
    eventImages,
  } = req.body;

  const updatedFields = {
    title,
    description,
    startTime,
    endTime,
    link,
    location,
    isApproved,
    eventImages,
  };

  const event = await Event.findByIdAndUpdate(id, updatedFields, { new: true });

  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  res.status(200).json({
    message: "Event updated successfully",
    event,
  });
});

// ✅ Get all events according to user id
// ✅ Get all events created by the logged-in user
export const getEventsByUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Step 1: Find all businesses owned by this user
  const businesses = await Business.find({ owner: userId });

  if (!businesses || businesses.length === 0) {
    return res
      .status(404)
      .json({ message: "No businesses found for this user" });
  }

  // Extract all business IDs
  const businessIds = businesses.map((b) => b._id);

  // Step 2: Fetch events for all those businesses
  const events = await Event.find({ business: { $in: businessIds } }).sort({
    date: 1,
  });

  res.status(200).json({
    message: "Events fetched successfully",
    businessIds,
    count: events.length,
    events,
  });
});

//get all events
export const getAllEvents = asyncHandler(async (req, res) => {
  const events = await Event.find().sort({ startTime: -1 });

  res.status(200).json({
    message: "All events fetched successfully",
    count: events.length,
    events,
  });
});
