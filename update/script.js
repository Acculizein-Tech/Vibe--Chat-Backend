// update/script.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Business from "../models/Business.js";
import Priceplan from "../models/Priceplan.js";

dotenv.config(); // Load your .env file

const updateBusinessDocuments = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");

    // 1️⃣ First, make sure every business has default fields (no overwrite issue if already present)
    await Business.updateMany(
      {},
      {
        $setOnInsert: {
          deleteBusiness: false,
          isPremium: false,
        },
      }
    );

    // 2️⃣ Fetch all businesses with a plan
    const businesses = await Business.find({ plan: { $ne: null } }).populate("plan");

    let updatedCount = 0;

    for (let b of businesses) {
      if (b.plan && b.plan.priceName.toLowerCase() !== "basic") {
        if (!b.isPremium) {
          b.isPremium = true;
          await b.save();
          updatedCount++;
          console.log(`⭐ Upgraded to Premium: ${b.name}`);
        }
      } else {
        if (b.isPremium) {
          b.isPremium = false;
          await b.save();
          updatedCount++;
          console.log(`⬇️ Downgraded to Basic: ${b.name}`);
        }
      }
    }

    console.log(`✅ Migration finished. ${updatedCount} businesses updated.`);
  } catch (error) {
    console.error("❌ Error updating business documents:", error);
  } finally {
    mongoose.connection.close();
  }
};

updateBusinessDocuments();
