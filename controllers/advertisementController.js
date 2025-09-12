import Advertisement from "../models/Advertisement.js";
import User from "../models/User.js";
import { uploadToS3 } from "../middlewares/upload.js";
import moment from "moment-timezone";

/**
 * @desc Create new advertisement (user side) with S3 uploads
 */
export const createAd = async (req, res) => {
  try {
    const { tittle,
      redirectUrl, suggestedPages, 
      startDate, endDate, billingModel, bidAmount, 
      dailyBudget, totalBudget, consentGiven 
    } = req.body;

    if (!consentGiven) {
      return res.status(400).json({ message: "Consent is required to create an advertisement." });
    }

    // Ensure only paid plan users can create ads
    const user = await User.findById(req.user.id);
    if (!user || user.plan === 0) {
      return res.status(403).json({ message: "Upgrade plan to create advertisements." });
    }

    const uploadedFiles = {};
    const files = req.files || {};

    // Process image and video uploads if present
    for (const field of ["adImage", "adVideo"]) {
      if (files[field] && files[field][0]) {
        const s3Result = await uploadToS3(files[field][0], req);
        if (s3Result.success) {
          uploadedFiles[field] = s3Result.url;
        } else {
          return res.status(400).json({ message: s3Result.message });
        }
      }
    }

    const ad = new Advertisement({
      userId: req.user.id,
      tittle,
      image: uploadedFiles.adImage || null,
      video: uploadedFiles.adVideo || null,
      redirectUrl,
      suggestedPages: suggestedPages || [],
      startDate,
      endDate,
      billingModel: billingModel || "CPD",
      bidAmount: bidAmount || 5,
      dailyBudget: dailyBudget || 0,
      totalBudget: totalBudget || 0,
      status: "pending"
    });

    await ad.save();

    res.status(201).json({
      message: "✅ Advertisement created successfully.",
      ad,
      // uploadedFiles,
      // createdAt: moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss")
    });

  } catch (error) {
    console.error("❌ createAd error:", error.message);
    res.status(500).json({ message: "Server error while creating ad." });
  }
};

/**
 * @desc Get all ads for current user
 */
export const getUserAds = async (req, res) => {
  try {
    const ads = await Advertisement.find({ userId: req.user.id });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: "Server error while fetching ads." });
  }
};

/**
 * @desc Superadmin approves or rejects an ad
 */
export const approveAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const { pagesToDisplay, adminApproved, status } = req.body;

    const ad = await Advertisement.findById(adId);
    if (!ad) return res.status(404).json({ message: "Ad not found." });

    ad.adminApproved = adminApproved;
    ad.status = status || (adminApproved ? "active" : "rejected");
    ad.pagesToDisplay = pagesToDisplay || [];

    await ad.save();
    res.json({ message: "✅ Ad approval updated.", ad });
  } catch (error) {
    res.status(500).json({ message: "Error while approving ad." });
  }
};

/**
 * @desc Update ad metrics (called when ad is shown or clicked)
 */
export const trackAdEvent = async (req, res) => {
  try {
    const { adId, eventType } = req.body; // "impression" or "click"
    const ad = await Advertisement.findById(adId);
    if (!ad) return res.status(404).json({ message: "Ad not found." });

    if (eventType === "impression") ad.impressions += 1;
    if (eventType === "click") ad.clicks += 1;

    await ad.save();
    res.json({ message: "✅ Ad metrics updated.", ad });
  } catch (error) {
    res.status(500).json({ message: "Error while tracking ad event." });
  }
};

/**
 * @desc Pause ad manually
 */
export const pauseAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const { reason } = req.body;

    const ad = await Advertisement.findById(adId);
    if (!ad) return res.status(404).json({ message: "Ad not found." });

    ad.status = "paused";
    ad.pausedReason = reason || "Paused by user/admin";
    await ad.save();

    res.json({ message: "✅ Ad paused successfully.", ad });
  } catch (error) {
    res.status(500).json({ message: "Error pausing ad." });
  }
};
