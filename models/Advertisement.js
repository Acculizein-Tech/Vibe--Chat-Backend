import mongoose from "mongoose";

const advertisementSchema = new mongoose.Schema(
  {
    image: {
      type: String, // S3 image URL
      required: false,
    },
    video: {
      type: String, // S3 video URL
      required: false,
    },
    pagesToDisplay: {
      type: [String], // Array of page identifiers: ["home", "billing", "search"]
      required: true,
    },
    redirectUrl: {
      type: String, // Where user should land when clicking
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "expired"],
      default: "inactive",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Advertisement", advertisementSchema);
