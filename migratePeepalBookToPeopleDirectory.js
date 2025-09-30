import mongoose from "mongoose";
import Business from "./models/Business.js";
import PeepalBook from "./models/PeepalBook.js";
import PeopleDirectory from "./models/PeopleDirectory.js";
import dotenv from "dotenv";
dotenv.config();

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected...");

    // 1. Fetch all PeepalBook data
    const oldData = await PeepalBook.find({});
    console.log(`📦 Found ${oldData.length} PeepalBook records`);

    // 2. Insert into PeopleDirectory if not already migrated
    for (let record of oldData) {
      const exists = await PeopleDirectory.findOne({ _id: record._id });

      if (!exists) {
        await PeopleDirectory.create(record.toObject());
        console.log(`➡️ Migrated: ${record._id}`);
      } else {
        console.log(`⚠️ Skipped (already exists): ${record._id}`);
      }
    }

    // 3. Update Business model references
    await Business.updateMany(
      { categoryModel: "PeepalBook" },
      { $set: { categoryModel: "PeopleDirectory" } }
    );

    console.log("✅ Business references updated");

    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed", err);
    process.exit(1);
  }
};

migrate();
