import Advertisement from "../models/Advertisement.js";

// ✅ Create Advertisement
export const createAdvertisement = async (req, res) => {
  try {
    const { pagesToDisplay, redirectUrl, startDate, endDate, status } = req.body;

    // ✅ s3 middleware se req.files milega
    const image = req.files?.image ? req.files.image[0].location : null;
    const video = req.files?.video ? req.files.video[0].location : null;

    if (!image && !video) {
      return res.status(400).json({ message: "Image or Video is required" });
    }

    const newAd = new Advertisement({
      image,
      video,
      pagesToDisplay,
      redirectUrl,
      startDate,
      endDate,
      status,
    });

    await newAd.save();

    res.status(201).json({
      success: true,
      message: "Advertisement created successfully",
      data: newAd,
    });
  } catch (error) {
    console.error("❌ createAdvertisement Error:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ✅ Get All Advertisements
export const getAdvertisements = async (req, res) => {
  try {
    const ads = await Advertisement.find().sort({ createdAt: -1 });
    res.json({ success: true, data: ads });
  } catch (error) {
    console.error("❌ getAdvertisements Error:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ✅ Update Advertisement
export const updateAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (req.files?.image) {
      updateData.image = req.files.image[0].location;
    }
    if (req.files?.video) {
      updateData.video = req.files.video[0].location;
    }

    const updatedAd = await Advertisement.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedAd) {
      return res.status(404).json({ message: "Advertisement not found" });
    }

    res.json({
      success: true,
      message: "Advertisement updated successfully",
      data: updatedAd,
    });
  } catch (error) {
    console.error("❌ updateAdvertisement Error:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ✅ Delete Advertisement
export const deleteAdvertisement = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAd = await Advertisement.findByIdAndDelete(id);

    if (!deletedAd) {
      return res.status(404).json({ message: "Advertisement not found" });
    }

    res.json({
      success: true,
      message: "Advertisement deleted successfully",
    });
  } catch (error) {
    console.error("❌ deleteAdvertisement Error:", error.message);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
