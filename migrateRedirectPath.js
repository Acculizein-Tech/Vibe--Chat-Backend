import mongoose from "mongoose";
import dotenv from "dotenv";
import Event from "./models/Events.js";
import Business from "./models/Business.js";

dotenv.config(); // ✅ load your .env (DB uri)

const migrateRedirectPath = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected...");

    // 1. Find all events which don't have redirectPath
    const events = await Event.find({ redirectPath: { $exists: false } });

    console.log(`🔍 Found ${events.length} events without redirectPath`);

    for (const event of events) {
      if (!event.business) {
        console.log(`⏭️ Skipping event ${event._id} (no business linked)`);
        continue;
      }

      const business = await Business.findById(event.business).select("category");
      if (!business) {
        console.log(`❌ Business not found for event ${event._id}`);
        continue;
      }

      // Construct redirect path
      const redirectPath = `/categories/${business.category}/${business._id}`;

      // Update event
      event.redirectPath = redirectPath;
      await event.save();

      console.log(`✅ Updated event ${event._id} with redirectPath: ${redirectPath}`);
    }

    console.log("🎉 Migration completed successfully");
    process.exit(0);

  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
};

migrateRedirectPath();
