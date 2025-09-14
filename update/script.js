// update/script.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Business from "../models/Business.js";

dotenv.config(); // Load your .env file

const updateBusinessDocuments = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");

    // Update all existing documents to include the new fields with default values
    const result = await Business.updateMany(
      {},
      {
        $set: {
          deleteBusiness: false,
          isPremium: false,
        },
      }
    );

    console.log(`✅ ${result.modifiedCount} business documents updated`);
  } catch (error) {
    console.error("❌ Error updating business documents:", error);
  } finally {
    mongoose.connection.close();
  }
};

updateBusinessDocuments();
