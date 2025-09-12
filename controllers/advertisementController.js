import Advertisement from "../models/Advertisement.js";
import User from "../models/User.js";
import { uploadToS3 } from "../middlewares/upload.js";
import moment from "moment-timezone";

/**
 * @desc Create new advertisement (user side) with S3 uploads
 */
// export const createAd = async (req, res) => {
//   try {
//     const { 
//       title,
//       redirectUrl, suggestedPages, 
//       startDate, endDate, billingModel, bidAmount, 
//       dailyBudget, totalBudget, city,
//       category,
//       services 
//     } = req.body;

//     // assuming destructured from req.body
// const { consentAccepted } = req.body;

// // If consentAccepted might be a string or boolean, do:
// if (consentAccepted !== true && consentAccepted !== "true") {
//   return res.status(400).json({ message: "Consent is required to create an advertisement." });
// }

//     const uploadedFiles = {};
//     const files = req.files || {};

//     // ✅ Process image and video uploads if present
//     for (const field of ["adImage", "adVideo"]) {
//       if (files[field] && files[field][0]) {
//         const s3Result = await uploadToS3(files[field][0], req);
//         if (s3Result.success) {
//           uploadedFiles[field] = s3Result.url;
//         } else {
//           return res.status(400).json({ message: s3Result.message });
//         }
//       }
//     }
//  let parsedServices = {};
// if (services) {
//   try {
//     parsedServices = typeof services === "string" ? JSON.parse(services) : services;
//     if (typeof parsedServices !== "object" || Array.isArray(parsedServices)) {
//       return res.status(400).json({ message: "Services must be an object with booleans." });
//     }
//   } catch (err) {
//     return res.status(400).json({ message: "Invalid services format." });
//   }
// }

// let parsedPages = {};
// if (suggestedPages) {
//   try {
//     parsedPages = typeof suggestedPages === "string" ? JSON.parse(suggestedPages) : suggestedPages;
//   } catch (err) {
//     parsedPages = {};
//   }
// }



//     // ✅ Admin / SuperAdmin ads (no budget needed)
//     if (req.user.role === "admin" || req.user.role === "superadmin") {
//       const ad = new Advertisement({
//         userId: req.user._id,
//         adType: req.user.role, // save actual role
//         title,
//         image: uploadedFiles.adImage || null,
//         video: uploadedFiles.adVideo || null,
//         redirectUrl,
//         suggestedPages: suggestedPages || [],
        
//         startDate,
//         endDate,
//         city: city,
//         category: category,
//         services: parsedServices ,
//         consentAccepted: true, // force true
//         status: "active"       // auto-active
//       });
//       await ad.save();

//       return res.status(201).json({
//         message: `✅ ${req.user.role} Ad created successfully.`,
//         ad
//       });
//     }

//     // ✅ Customer Ads (consent + budget required)
//     if (req.user.role === "customer" && !consentGiven) {
//       return res.status(400).json({ message: "Consent is required to create an advertisement." });
//     }

//     if (!req.user || req.user.plan === 0) {
//       return res.status(403).json({ message: "Upgrade plan to create advertisements." });
//     }

//     const ad = new Advertisement({
//       userId: req.user._id,
//       adType: "customer",
//       title,
//       image: uploadedFiles.adImage || null,
//       video: uploadedFiles.adVideo || null,
//       redirectUrl,
//       suggestedPages: suggestedPages || [],
//       startDate,
//       endDate,
//       billingModel: billingModel || "CPC",
//       bidAmount: bidAmount || 5,
//       dailyBudget: dailyBudget || 0,
//       totalBudget: totalBudget || 0,
//       city: city,
//       category: category ,
//       services: parsedServices,
//       consentAccepted: !!consentAccepted,
//       status: "pending" // customers ka ad pending rahega
//     });

//     await ad.save();

//     res.status(201).json({
//       message: "✅ Customer Ad created successfully.",
//       ad
//     });

//   } catch (error) {
//     console.error("❌ createAd error:", error.message);
//     res.status(500).json({ message: "Server error while creating ad." });
//   }
// };

export const createAd = async (req, res) => {
  try {
    const { 
      title,
      redirectUrl,
      suggestedPages,
      pagesToDisplay,
      startDate,
      endDate,
      billingModel,
      bidAmount,
      dailyBudget,
      totalBudget,
      city,
      category,
      services,
      consentAccepted
    } = req.body;

    // ✅ Consent check
    if (consentAccepted !== true && consentAccepted !== "true") {
      return res.status(400).json({ message: "Consent is required to create an advertisement." });
    }

    const uploadedFiles = {};
    const files = req.files || {};

    // ✅ Upload image/video
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

    // ✅ Parse services (Map<Boolean>)
    let parsedServices = {};
    if (services) {
      try {
        const obj = typeof services === "string" ? JSON.parse(services) : services;
        if (typeof obj === "object" && !Array.isArray(obj)) {
          parsedServices = obj;
        }
      } catch (err) {
        return res.status(400).json({ message: "Invalid services format." });
      }
    }

    // ✅ Parse pagesToDisplay (Map<Boolean>)
    let parsedPagesToDisplay = {};
    if (pagesToDisplay) {
      try {
        const obj = typeof pagesToDisplay === "string" ? JSON.parse(pagesToDisplay) : pagesToDisplay;
        if (typeof obj === "object" && !Array.isArray(obj)) {
          parsedPagesToDisplay = obj;
        }
      } catch (err) {
        parsedPagesToDisplay = {};
      }
    }

    // ✅ Parse suggestedPages (Array)
    let parsedSuggestedPages = [];
    if (suggestedPages) {
      try {
        parsedSuggestedPages = typeof suggestedPages === "string" ? JSON.parse(suggestedPages) : suggestedPages;
        if (!Array.isArray(parsedSuggestedPages)) parsedSuggestedPages = [];
      } catch (err) {
        parsedSuggestedPages = [];
      }
    }

    // ✅ City (String only)
    const parsedCity = typeof city === "string" ? city : "";

    // ✅ Admin / SuperAdmin ads (no budget required)
    if (req.user.role === "admin" || req.user.role === "superadmin") {
      const ad = new Advertisement({
        userId: req.user._id,
        adType: req.user.role,
        title:title,
        image: uploadedFiles.adImage || null,
        video: uploadedFiles.adVideo || null,
        redirectUrl,
        suggestedPages: parsedSuggestedPages,
        pagesToDisplay: parsedPagesToDisplay,
        startDate,
        endDate,
        city: parsedCity,
        category,
        services: parsedServices,
        consentAccepted: true,
        status: "active"
      });
      await ad.save();

      return res.status(201).json({
        message: `✅ ${req.user.role} Ad created successfully.`,
        ad
      });
    }

    // ✅ Customer validation
    if (req.user.role === "customer" && !consentAccepted) {
      return res.status(400).json({ message: "Consent is required to create an advertisement." });
    }

    if (!req.user || req.user.plan === 0) {
      return res.status(403).json({ message: "Upgrade plan to create advertisements." });
    }

    // ✅ Customer Ad
    const ad = new Advertisement({
      userId: req.user._id,
      adType: "customer",
      tittle: title,
      image: uploadedFiles.adImage || null,
      video: uploadedFiles.adVideo || null,
      redirectUrl,
      suggestedPages: parsedSuggestedPages,
      pagesToDisplay: parsedPagesToDisplay,
      startDate,
      endDate,
      billingModel: billingModel || "CPD",
      bidAmount: bidAmount || 5,
      dailyBudget: dailyBudget || 0,
      totalBudget: totalBudget || 0,
      city: parsedCity,
      category,
      services: parsedServices,
      consentAccepted: !!consentAccepted,
      status: "pending"
    });

    await ad.save();

    res.status(201).json({
      message: "✅ Customer Ad created successfully.",
      ad
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



//countig details for superadmin dashboard
export const getAdStats = async (req, res) => {
  try {
    // ✅ Count ads by status
    const totalCampaigns = await Advertisement.countDocuments({});
    const activeAds = await Advertisement.countDocuments({ status: "active" });
    const pendingAds = await Advertisement.countDocuments({ status: "pending" });
    const expiredAds = await Advertisement.countDocuments({ status: "expired" });

    // ✅ Get recently added ads (sorted by createdAt descending)
    const recentAds = await Advertisement.find({})
      .sort({ createdAt: -1 })
      .limit(10) // last 10 ads
      .select("title status pagesToDisplay redirectUrl cities categories subCategories startDate endDate image video");

    // Map _id to id for frontend
    const recent = recentAds.map(ad => ({
      id: ad._id,
      title: ad.title,
      status: ad.status,
      pages: ad.pagesToDisplay,
      redirectUrl: ad.redirectUrl,
      cities: ad.cities,
      categories: ad.categories,
      subCategories: ad.subCategories,
      startDate: ad.startDate,
      endDate: ad.endDate,
      image: ad.image,
      video: ad.video
    }));

    res.status(200).json({
      stats: {
        totalCampaigns,
        activeAds,
        pendingAds,
        expiredAds
      },
      recent
    });

  } catch (error) {
    console.error("❌ getAdStats error:", error.message);
    res.status(500).json({ message: "Server error while fetching ad stats." });
  }
};