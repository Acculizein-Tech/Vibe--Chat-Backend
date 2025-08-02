import Business from '../models/Business.js';
import Health from '../models/Health.js';
import Hotel from '../models/Hotel.js';
import BeautySpa from '../models/BeautySpa.js';
import asyncHandler from '../utils/asyncHandler.js';
import Review from '../models/Review.js';
import User from '../models/user.js';
import moment from 'moment'; // Optional for time comparison
import Leads from '../models/Leads.js';
import { notifyUser, notifyRole } from '../utils/sendNotification.js';
import Priceplan from '../models/Priceplan.js';
import Payment from '../models/Payment.js';
import Education from '../models/Education.js';
import Garment from '../models/Garment.js'; 
import Travels from '../models/Travels.js'; // Import Traveles model
import Shoes from '../models/Shoes.js'; // Import Shoes model
import Groceries from '../models/Groceries.js';
import Models from '../models/Models.js';
import Insurance from '../models/Insurance.js';
import RealEstate from '../models/RealEstate.js';
import Loan from '../models/Loan.js';
import Gym from '../models/Gym.js'; // Import Gym model
import Jeweller from '../models/Jeweller.js'; // Import Jeweller model
import Notification from '../models/Notification.js';

import mongoose from 'mongoose';
import { uploadToS3 } from '../middlewares/upload.js';
const categoryModels = {
  Health,
  Hotel: Hotel,
  BeautySpa: BeautySpa,
  Education: Education,
  Garment: Garment,
  Travels: Travels,
  Shoes: Shoes,
  Insurance: Insurance,
  Groceries: Groceries,
  Models: Models,
  RealEstate: RealEstate,
  Loan: Loan,
  Gym: Gym,
  Jeweller: Jeweller // Add Jeweller model here
};





// export const createBusiness = async (req, res) => {
//   try {
//     const {
//       name,
//       ownerName,
//       owner,
//       location,
//       phone,
//       website,
//       email,
//       socialLinks,
//       businessHours,
//       category,
//       experience,
//       description,
//       referralCode,
//       services,
//       categoryData,
//       planId,
//       paymentId
//     } = req.body;

//     const CategoryModel = categoryModels[category];
//     if (!CategoryModel) {
//       return res.status(400).json({ message: 'Invalid category model' });
//     }

//     const parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
//     const parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
//     const parsedServices = typeof services === 'string' ? JSON.parse(services) : services || {};
//     const parsedCategoryData = typeof categoryData === 'string' ? JSON.parse(categoryData) : categoryData || {};

//     // 🧹 Remove empty GSTIN to avoid MongoDB duplicate "" index error
//     if (parsedCategoryData?.GSTIN === '') {
//       delete parsedCategoryData.GSTIN;
//     }

//     let parsedBusinessHours = [];
//     try {
//       parsedBusinessHours = Array.isArray(businessHours)
//         ? businessHours
//         : JSON.parse(businessHours || '[]');
//     } catch (err) {
//       return res.status(400).json({ message: 'Invalid businessHours format' });
//     }

//     const formattedBusinessHours = parsedBusinessHours.map(entry => ({
//       day: entry.day || '',
//       isWorking: entry.isWorking ?? true,
//       is24Hour: entry.is24Hour ?? false,
//       is24HourClose: entry.is24HourClose ?? false,
//       shifts: Array.isArray(entry.shifts)
//         ? entry.shifts.filter(shift => shift.open && shift.close).map(shift => ({
//             open: shift.open,
//             close: shift.close
//           }))
//         : []
//     }));

//     // 🖼️ Upload Files to S3
//     const files = req.files || {};
//     const uploadedFiles = {};
//     for (const field in files) {
//       uploadedFiles[field] = [];
//       for (const file of files[field]) {
//         try {
//           const s3Url = await uploadToS3(file, req);
//           if (s3Url) {
//             uploadedFiles[field].push(s3Url);
//           } else {
//             console.warn(`⚠️ Upload failed for ${file.originalname || 'unknown'}`);
//           }
//         } catch (err) {
//           console.warn(`❌ Upload error for ${file.originalname || 'unknown'}:`, err.message);
//         }
//       }
//     }

//     const profileImage = uploadedFiles.profileImage?.[0] || null;
//     const coverImage = uploadedFiles.coverImage?.[0] || null;
//     const certificateImages = uploadedFiles.certificateImages?.slice(0, 5) || [];
//     const galleryImages = uploadedFiles.galleryImages?.slice(0, 10) || [];

//     // 🎯 Assign sales executive
//     let salesExecutive = null;
//     if (referralCode) {
//       const refUser = await User.findOne({ referralCode });
//       if (!refUser) {
//         return res.status(400).json({ message: 'Invalid referral code' });
//       }
//       salesExecutive = refUser._id;
//     }

//     if (!salesExecutive) {
//       const salesUsers = await User.find({ role: 'sales' });
//       if (salesUsers.length > 0) {
//         const randomIndex = Math.floor(Math.random() * salesUsers.length);
//         salesExecutive = salesUsers[randomIndex]._id;
//       }
//     }

//     // ✅ Validate Plan
//     const cleanPlanId = typeof planId === 'string'
//       ? planId.trim().replace(/^["']|["']$/g, '')
//       : planId;

//     let validPlan = null;
//     if (cleanPlanId) {
//       if (!mongoose.Types.ObjectId.isValid(cleanPlanId)) {
//         return res.status(400).json({ message: 'Invalid plan ID format' });
//       }

//       const plan = await Priceplan.findById(cleanPlanId);
//       if (!plan) {
//         return res.status(400).json({ message: 'Plan not found' });
//       }

//       validPlan = plan;

//       if (plan.price > 0) {
//         if (!paymentId) {
//           return res.status(400).json({ message: 'Payment ID is required for paid plans' });
//         }

//         const payment = await Payment.findOne({ paymentId });
//         if (!payment || payment.status !== 'success') {
//           return res.status(400).json({ message: 'Payment not found or not verified' });
//         }
//       }
//     }

//     // 🏢 Create Business
//     const business = await Business.create({
//       name,
//       ownerName,
//       owner,
//       location: parsedLocation,
//       phone,
//       website,
//       email,
//       socialLinks: parsedSocialLinks,
//       businessHours: formattedBusinessHours,
//       experience,
//       description,
//       profileImage,
//       coverImage,
//       certificateImages,
//       galleryImages,
//       category,
//       categoryModel: category,
//       services: parsedServices,
//       salesExecutive,
//       plan: validPlan?._id || null
//     });

//     // 💳 Link Payment
//     if (validPlan?.price > 0 && paymentId) {
//       const payment = await Payment.findOneAndUpdate(
//         { paymentId },
//         { $set: { business: business._id } },
//         { new: true }
//       );

//       if (payment) {
//         await Business.findByIdAndUpdate(business._id, {
//           $set: {
//             lastPayment: payment._id,
//             paymentStatus: 'success'
//           }
//         });
//       }
//     }

//     // 📄 Create Category Document
//     let categoryDoc = null;
//     try {
//       categoryDoc = await CategoryModel.create({
//         ...parsedCategoryData,
//         business: business._id
//       });

//       await Business.findByIdAndUpdate(business._id, {
//         $set: { categoryRef: categoryDoc._id }
//       });
//     } catch (err) {
//       console.error('❌ Category model creation failed. Rolling back business:', err.message);
//       await Business.findByIdAndDelete(business._id);
//       return res.status(500).json({
//         message: 'Failed to create business details. Please ensure GSTIN or other fields are unique.',
//         error: err.message
//       });
//     }

//     // 🧾 Create Lead
//     try {
//       const user = await User.findById(owner).select('fullName email');
//       if (user) {
//         await Leads.create({
//           name: user.fullName,
//           contact: user.email,
//           businessType: category,
//           status: 'Interested',
//           notes: 'Business listed on website',
//           salesUser: salesExecutive || null,
//           followUpDate: new Date(Date.now() + 2 * 60 * 1000)
//         });
//       }
//     } catch (leadErr) {
//       console.warn('⚠️ Lead creation failed:', leadErr.message);
//     }

//     // 🔔 Notify sales, admin, superadmin
//     if (salesExecutive) {
//       await notifyUser({
//         userId: salesExecutive,
//         type: 'NEW_BUSINESS_BY_REFERRAL',
//         title: '📢 New Business Listed',
//         message: `A new business "${name}" was listed by your referred user.`,
//         data: {
//           businessId: business._id,
//           businessName: name,
//           userId: owner,
//           redirectPath: `/sales/business/${business._id}`
//         }
//       });
//     }

//     await Promise.all([
//       notifyRole({
//         role: 'admin',
//         type: 'NEW_BUSINESS_LISTED',
//         title: '🆕 Business Listing Submitted',
//         message: salesExecutive
//           ? `"${name}" has been listed and assigned to a sales executive.`
//           : `"${name}" has been listed but not yet assigned to any sales executive.`,
//         data: {
//           businessId: business._id,
//           ownerId: owner,
//           assignedTo: salesExecutive || null,
//           redirectPath: `/admin/business/${business._id}`
//         }
//       }),
//       notifyRole({
//         role: 'superadmin',
//         type: 'NEW_BUSINESS_LISTED',
//         title: '🆕 Business Listing Submitted',
//         message: salesExecutive
//           ? `"${name}" has been listed and assigned to a sales executive.`
//           : `"${name}" has been listed but not yet assigned to any sales executive.`,
//         data: {
//           businessId: business._id,
//           ownerId: owner,
//           assignedTo: salesExecutive || null,
//           redirectPath: `/superadmin/business/${business._id}`
//         }
//       })
//     ]);

//     const finalBusiness = await Business.findById(business._id).populate('salesExecutive');

//     res.status(201).json({
//       message: 'Business created successfully',
//       business: finalBusiness
//     });
//   } catch (error) {
//     console.error('❌ Error creating business:', error);

//     if (error.code === 11000 && error.keyPattern?.GSTIN) {
//       return res.status(409).json({
//         message: 'Duplicate GSTIN detected. Please enter a unique GSTIN or leave it blank.'
//       });
//     }

//     res.status(500).json({
//       message: 'Server Error',
//       error: error.message
//     });
//   }
// };





// export const updateBusiness = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // 1️⃣  Extract raw form-data values
//     const {
//       name,
//       ownerName,
//       phone,
//       website,
//       email,
//       category: newCategory,     // in case of category change
//       experience,
//       description,
//       services: rawServices,
//       location: rawLocation,
//       socialLinks: rawSocialLinks,
//       businessHours: rawBusinessHours
//     } = req.body;

//     // 2️⃣  Parse JSON-stringified fields
//     let location = {};
//     let socialLinks = {};
//     let businessHoursArr = [];
//     let categoryData = {};
//     let services = {};

//     try { location = rawLocation ? JSON.parse(rawLocation) : {}; }        catch { return res.status(400).json({ message: 'Invalid JSON in location' }); }
//     try { socialLinks = rawSocialLinks ? JSON.parse(rawSocialLinks) : {}; }catch { return res.status(400).json({ message: 'Invalid JSON in socialLinks' }); }
//     try { businessHoursArr = rawBusinessHours ? JSON.parse(rawBusinessHours) : []; } catch { return res.status(400).json({ message: 'Invalid JSON in businessHours' }); }
//     try { categoryData = req.body.categoryData ? JSON.parse(req.body.categoryData) : {}; } catch { return res.status(400).json({ message: 'Invalid JSON in categoryData' }); }
//     try { services = rawServices ? JSON.parse(rawServices) : {}; } catch { return res.status(400).json({ message: 'Invalid JSON in services' }); }

//     // 3️⃣  Fetch existing business
//     const business = await Business.findById(id);
//     if (!business) return res.status(404).json({ message: 'Business not found' });

//     /* ------------------------------------------------------------------ */
//     /* 4️⃣  Handle file uploads                                           */
//     /* ------------------------------------------------------------------ */
//     const { uploadToS3 } = await import('../middlewares/upload.js'); // ✅ dynamic import for ESM

// const files = req.files || {};

// if (files.profileImage?.length) {
//   const url = await uploadToS3(files.profileImage[0], req);
//   business.profileImage = url;
// }

// if (files.coverImage?.length) {
//   const url = await uploadToS3(files.coverImage[0], req);
//   business.coverImage = url;
// }

// if (files.certificateImages?.length) {
//   const certUrls = await Promise.all(
//     files.certificateImages.slice(0, 5).map(file => uploadToS3(file, req))
//   );
//   business.certificateImages = certUrls;
// }

// if (files.galleryImages?.length) {
//   const galleryUrls = await Promise.all(
//     files.galleryImages.slice(0, 10).map(file => uploadToS3(file, req))
//   );
//   business.galleryImages = galleryUrls;
// }


//     /* ------------------------------------------------------------------ */
//     /* 5️⃣  Update scalar fields                                          */
//     /* ------------------------------------------------------------------ */
//     business.name        = name        ?? business.name;
//     business.ownerName   = ownerName   ?? business.ownerName;
//     business.phone       = phone       ?? business.phone;
//     business.website     = website     ?? business.website;
//     business.email       = email       ?? business.email;
//     business.experience  = experience  ?? business.experience;
//     business.description = description ?? business.description;

//     /* ------------------------------------------------------------------ */
//     /* 6️⃣  Update complex object fields                                  */
//     /* ------------------------------------------------------------------ */
//     if (Object.keys(location).length)      business.location    = location;
//     if (Object.keys(socialLinks).length)   business.socialLinks = socialLinks;
//     if (Object.keys(services).length)      business.services     = services;

//     if (Array.isArray(businessHoursArr) && businessHoursArr.length) {
//       business.businessHours = businessHoursArr.map(bh => ({
//         day:   bh.day,
//         open:  bh.open  || '',
//         close: bh.close || ''
//       }));
//     }

//     /* ------------------------------------------------------------------ */
//     /* 7️⃣  Category Update (switch or same)                              */
//     /* ------------------------------------------------------------------ */
//     if (newCategory && newCategory !== business.category) {
//       // ✨ Switch to a new category
//       const newModelName = newCategory;
//       const NewCategoryModel = categoryModels[newModelName];
//       if (!NewCategoryModel) {
//         return res.status(400).json({ message: `Invalid category "${newCategory}"` });
//       }

//       const newCatDoc = new NewCategoryModel(categoryData);
//       await newCatDoc.save();

//       business.category      = newCategory;
//       business.categoryModel = newModelName;
//       business.categoryRef   = newCatDoc._id;
//     } else {
//       // ✨ Update existing categoryData
//       const CurrentCatModel = categoryModels[business.categoryModel];
//       if (CurrentCatModel && Object.keys(categoryData).length && business.categoryRef) {
//         const catDoc = await CurrentCatModel.findById(business.categoryRef);
//         if (catDoc) {
//           catDoc.set(categoryData);
//           await catDoc.save();
//         }
//       }
//     }

//     /* ------------------------------------------------------------------ */
//     /* 8️⃣  Save and respond                                              */
//     /* ------------------------------------------------------------------ */
//     const updatedBusiness = await business.save();

//     res.status(200).json({
//       message: '✅ Business listing updated successfully',
//       business: updatedBusiness
//     });
//   } catch (error) {
//     console.error('❌ Error updating business listing:', error);
//     res.status(500).json({
//       message: 'Server Error while updating business listing',
//       error: error.message
//     });
//   }
// };

export const createBusiness = async (req, res) => {
  try {
    const {
      name,
      ownerName,
      owner,
      location,
      phone,
      website,
      email,
      socialLinks,
      businessHours,
      category,
      experience,
      description,
      referralCode,
      services,
      categoryData,
      planId,
      paymentId
    } = req.body;

    const CategoryModel = categoryModels[category];
    if (!CategoryModel) {
      return res.status(400).json({ message: 'Invalid category model' });
    }

    const parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
    const parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
    const parsedServices = typeof services === 'string' ? JSON.parse(services) : services || {};
    const parsedCategoryData = typeof categoryData === 'string' ? JSON.parse(categoryData) : categoryData || {};

    // 🧹 Remove empty GSTIN to avoid MongoDB duplicate "" index error
    if (parsedCategoryData?.GSTIN === '') {
      delete parsedCategoryData.GSTIN;
    }

    let parsedBusinessHours = [];
    try {
      parsedBusinessHours = Array.isArray(businessHours)
        ? businessHours
        : JSON.parse(businessHours || '[]');
    } catch (err) {
      return res.status(400).json({ message: 'Invalid businessHours format' });
    }

    const formattedBusinessHours = parsedBusinessHours.map(entry => ({
      day: entry.day || '',
      isWorking: entry.isWorking ?? true,
      is24Hour: entry.is24Hour ?? false,
      is24HourClose: entry.is24HourClose ?? false,
      shifts: Array.isArray(entry.shifts)
        ? entry.shifts.filter(shift => shift.open && shift.close).map(shift => ({
            open: shift.open,
            close: shift.close
          }))
        : []
    }));

    // 🖼️ Upload Files to S3
    const files = req.files || {};
    const uploadedFiles = {};
    for (const field in files) {
      uploadedFiles[field] = [];
      for (const file of files[field]) {
        try {
          const s3Url = await uploadToS3(file, req);
          if (s3Url) {
            uploadedFiles[field].push(s3Url);
          } else {
            console.warn(`⚠️ Upload failed for ${file.originalname || 'unknown'}`);
          }
        } catch (err) {
          console.warn(`❌ Upload error for ${file.originalname || 'unknown'}:`, err.message);
        }
      }
    }

    const profileImage = uploadedFiles.profileImage?.[0] || null;
    const coverImage = uploadedFiles.coverImage?.[0] || null;
    const certificateImages = uploadedFiles.certificateImages?.slice(0, 5) || [];
    const galleryImages = uploadedFiles.galleryImages?.slice(0, 10) || [];

    // 🎯 Assign sales executive
    let salesExecutive = null;
    if (referralCode) {
      const refUser = await User.findOne({ referralCode });
      if (!refUser) {
        return res.status(400).json({ message: 'Invalid referral code' });
      }
      salesExecutive = refUser._id;
    }

    if (!salesExecutive) {
      const salesUsers = await User.find({ role: 'sales' });
      if (salesUsers.length > 0) {
        const randomIndex = Math.floor(Math.random() * salesUsers.length);
        salesExecutive = salesUsers[randomIndex]._id;
      }
    }

    // ✅ Validate Plan
    const cleanPlanId = typeof planId === 'string'
      ? planId.trim().replace(/^["']|["']$/g, '')
      : planId;

    let validPlan = null;
    if (cleanPlanId) {
      if (!mongoose.Types.ObjectId.isValid(cleanPlanId)) {
        return res.status(400).json({ message: 'Invalid plan ID format' });
      }

      const plan = await Priceplan.findById(cleanPlanId);
      if (!plan) {
        return res.status(400).json({ message: 'Plan not found' });
      }

      validPlan = plan;

      if (plan.price > 0) {
        if (!paymentId) {
          return res.status(400).json({ message: 'Payment ID is required for paid plans' });
        }

        const payment = await Payment.findOne({ paymentId });
        if (!payment || payment.status !== 'success') {
          return res.status(400).json({ message: 'Payment not found or not verified' });
        }
      }
    }

    // 🏢 Create Business
    const business = await Business.create({
      name,
      ownerName,
      owner,
      location: parsedLocation,
      phone,
      website,
      email,
      socialLinks: parsedSocialLinks,
      businessHours: formattedBusinessHours,
      experience,
      description,
      profileImage,
      coverImage,
      certificateImages,
      galleryImages,
      category,
      categoryModel: category,
      services: parsedServices,
      salesExecutive,
      plan: validPlan?._id || null
    });

    // 💳 Link Payment
    if (validPlan?.price > 0 && paymentId) {
      const payment = await Payment.findOneAndUpdate(
        { paymentId },
        { $set: { business: business._id } },
        { new: true }
      );

      if (payment) {
        await Business.findByIdAndUpdate(business._id, {
          $set: {
            lastPayment: payment._id,
            paymentStatus: 'success'
          }
        });
      }
    }

    // 📄 Create Category Document
    let categoryDoc = null;
    try {
      categoryDoc = await CategoryModel.create({
        ...parsedCategoryData,
        business: business._id
      });

      await Business.findByIdAndUpdate(business._id, {
        $set: { categoryRef: categoryDoc._id }
      });
    } catch (err) {
      console.error('❌ Category model creation failed. Rolling back business:', err.message);
      await Business.findByIdAndDelete(business._id);
      return res.status(500).json({
        message: 'Failed to create business details. Please ensure GSTIN or other fields are unique.',
        error: err.message
      });
    }

    // 🧾 Create Lead
    try {
      const user = await User.findById(owner).select('fullName email');
      if (user) {
        await Leads.create({
          name: user.fullName,
          contact: user.email,
          businessType: category,
          status: 'Interested',
          notes: 'Business listed on website',
          salesUser: salesExecutive || null,
          followUpDate: new Date(Date.now() + 2 * 60 * 1000)
        });
      }
    } catch (leadErr) {
      console.warn('⚠️ Lead creation failed:', leadErr.message);
    }

    // 🔔 Notify sales, admin, superadmin
    if (salesExecutive) {
      await notifyUser({
        userId: salesExecutive,
        type: 'NEW_BUSINESS_BY_REFERRAL',
        title: '📢 New Business Listed',
        message: `A new business "${name}" was listed by your referred user.`,
        data: {
          businessId: business._id,
          businessName: name,
          userId: owner,
          redirectPath: `/sales/business/${business._id}`
        }
      });
    }

    await Promise.all([
      notifyRole({
        role: 'admin',
        type: 'NEW_BUSINESS_LISTED',
        title: '🆕 Business Listing Submitted',
        message: salesExecutive
          ? `"${name}" has been listed and assigned to a sales executive.`
          : `"${name}" has been listed but not yet assigned to any sales executive.`,
        data: {
          businessId: business._id,
          ownerId: owner,
          assignedTo: salesExecutive || null,
          redirectPath: `/admin/business/${business._id}`
        }
      }),
      notifyRole({
        role: 'superadmin',
        type: 'NEW_BUSINESS_LISTED',
        title: '🆕 Business Listing Submitted',
        message: salesExecutive
          ? `"${name}" has been listed and assigned to a sales executive.`
          : `"${name}" has been listed but not yet assigned to any sales executive.`,
        data: {
          businessId: business._id,
          ownerId: owner,
          assignedTo: salesExecutive || null,
          redirectPath: `/superadmin/business/${business._id}`
        }
      })
    ]);

    const finalBusiness = await Business.findById(business._id).populate('salesExecutive');

    res.status(201).json({
      message: 'Business created successfully',
      business: finalBusiness
    });
  } catch (error) {
    console.error('❌ Error creating business:', error);

    if (error.code === 11000 && error.keyPattern?.GSTIN) {
      return res.status(409).json({
        message: 'Duplicate GSTIN detected. Please enter a unique GSTIN or leave it blank.'
      });
    }

    res.status(500).json({
      message: 'Server Error',
      error: error.message
    });
  }
};







export const updateBusiness = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣  Extract raw form-data values
    const {
      name,
      ownerName,
      phone,
      website,
      email,
      category: newCategory,  
      subCategory: newSubCategory,  // ✅ NEW: subcategory for more granularity
      experience,
      description,
      services: rawServices,
      location: rawLocation,
      socialLinks: rawSocialLinks,
      businessHours: rawBusinessHours
    } = req.body;

    // 2️⃣  Parse JSON-stringified fields
    let location = {};
    let socialLinks = {};
    let businessHoursArr = [];
    let categoryData = {};
    let services = {};

    try { location = rawLocation ? JSON.parse(rawLocation) : {}; }        catch { return res.status(400).json({ message: 'Invalid JSON in location' }); }
    try { socialLinks = rawSocialLinks ? JSON.parse(rawSocialLinks) : {}; }catch { return res.status(400).json({ message: 'Invalid JSON in socialLinks' }); }
    try { businessHoursArr = rawBusinessHours ? JSON.parse(rawBusinessHours) : []; } catch { return res.status(400).json({ message: 'Invalid JSON in businessHours' }); }
    try { categoryData = req.body.categoryData ? JSON.parse(req.body.categoryData) : {}; } catch { return res.status(400).json({ message: 'Invalid JSON in categoryData' }); }
    try { services = rawServices ? JSON.parse(rawServices) : {}; } catch { return res.status(400).json({ message: 'Invalid JSON in services' }); }

    // 3️⃣  Fetch existing business
    const business = await Business.findById(id);
    if (!business) return res.status(404).json({ message: 'Business not found' });

    /* ------------------------------------------------------------------ */
    /* 4️⃣  Handle file uploads                                           */
    /* ------------------------------------------------------------------ */
    

const files = req.files || {};

if (files.profileImage?.length) {
  const url = await uploadToS3(files.profileImage[0], req);
  business.profileImage = url;
}

if (files.coverImage?.length) {
  const url = await uploadToS3(files.coverImage[0], req);
  business.coverImage = url;
}

if (files.certificateImages?.length) {
  const certUrls = await Promise.all(
    files.certificateImages.slice(0, 5).map(file => uploadToS3(file, req))
  );
  business.certificateImages = certUrls;
}

if (files.galleryImages?.length) {
  const galleryUrls = await Promise.all(
    files.galleryImages.slice(0, 10).map(file => uploadToS3(file, req))
  );
  business.galleryImages = galleryUrls;
}


    /* ------------------------------------------------------------------ */
    /* 5️⃣  Update scalar fields                                          */
    /* ------------------------------------------------------------------ */
    business.name        = name        ?? business.name;
    business.ownerName   = ownerName   ?? business.ownerName;
    business.phone       = phone       ?? business.phone;
    business.website     = website     ?? business.website;
    business.email       = email       ?? business.email;
    business.experience  = experience  ?? business.experience;
    business.description = description ?? business.description;

    /* ------------------------------------------------------------------ */
    /* 6️⃣  Update complex object fields                                  */
    /* ------------------------------------------------------------------ */
    if (Object.keys(location).length)      business.location    = location;
    if (Object.keys(socialLinks).length)   business.socialLinks = socialLinks;
    if (Object.keys(services).length)      business.services     = services;

    // if (Array.isArray(businessHoursArr) && businessHoursArr.length) {
    //   business.businessHours = businessHoursArr.map(bh => ({
    //     day:   bh.day,
    //     open:  bh.open  || '',
    //     close: bh.close || ''
    //   }));

    if (Array.isArray(businessHoursArr) && businessHoursArr.length) {
  business.businessHours = businessHoursArr.map(bh => ({
    day: bh.day || '',
    isWorking: bh.isWorking ?? true,
    is24Hour: bh.is24Hour ?? false,
    is24HourClose: bh.is24HourClose ?? false,
    shifts: Array.isArray(bh.shifts)
      ? bh.shifts
          .filter(shift => shift.open && shift.close)
          .map(shift => ({
            open: shift.open,
            close: shift.close
          }))
      : []
  }));


    }

    /* ------------------------------------------------------------------ */
    /* 7️⃣  Category Update (switch or same)                              */
    /* ------------------------------------------------------------------ */
    if (newCategory && newCategory !== business.category) {
      // ✨ Switch to a new category
      const newModelName = newCategory;
      const NewCategoryModel = categoryModels[newModelName];
      if (!NewCategoryModel) {
        return res.status(400).json({ message: `Invalid category "${newCategory}"` });
      }

      const newCatDoc = new NewCategoryModel(categoryData);
      await newCatDoc.save();

      business.category      = newCategory;
      business.categoryModel = newModelName;
      business.categoryRef   = newCatDoc._id;
    } else {
      // ✨ Update existing categoryData
      const CurrentCatModel = categoryModels[business.categoryModel];
      if (CurrentCatModel && Object.keys(categoryData).length && business.categoryRef) {
        const catDoc = await CurrentCatModel.findById(business.categoryRef);
        if (catDoc) {
          catDoc.set(categoryData);
          await catDoc.save();
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* 8️⃣  Save and respond                                              */
    /* ------------------------------------------------------------------ */
    const updatedBusiness = await business.save();

    res.status(200).json({
      message: '✅ Business listing updated successfully',
      business: updatedBusiness
    });
  } catch (error) {
    console.error('❌ Error updating business listing:', error);
    res.status(500).json({
      message: 'Server Error while updating business listing',
      error: error.message
    });
  }
};

export const getBusinessById = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔍 Step 1: Fetch main business info as Mongoose document
    let business = await Business.findById(id);
    if (!business) {
      console.log('❌ Business not found with id:', id);
      return res.status(404).json({ message: 'Business not found' });
    }

    // ✅ Step 1.1: Track view based on IP
    const userIp =
      req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

    // Ensure viewers field exists
    if (!Array.isArray(business.viewers)) {
      business.viewers = [];
    }

    const hasViewed = business.viewers.some(view =>
      view.ip === userIp &&
      new Date(view.viewedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000) // last 24h
    );

    if (!hasViewed) {
      business.views = (business.views || 0) + 1;
      business.viewers.push({ ip: userIp, viewedAt: new Date() });
      await business.save();
    }

    console.log('✅ Fetched business:', business);

    // 🧠 Step 2: Resolve category model and ref
    const CategoryModel = categoryModels[business.categoryModel];
    let categoryData = {};

    if (CategoryModel && business.categoryRef) {
      const categoryDoc = await CategoryModel.findById(business.categoryRef).lean();
      if (categoryDoc) {
        const { _id, __v, ...rest } = categoryDoc;
        categoryData = rest;
      }
    }

    // 🧩 Step 3: Get associated reviews
    const reviews = await Review.find({ business: id })
      .populate('user', 'fullName profile.avatar')
      .sort({ createdAt: -1 });

    const formattedReviews = reviews.map(r => ({
      reviewerName: r.user?.fullName,
      reviewerAvatar: r.user?.profile?.avatar || null,
      comment: r.comment,
      rating: r.rating,
      time: r.createdAt,
    }));

    // 🧩 Step 4: Merge and return
    const fullData = {
      ...business.toObject(),
      categoryData,
      reviews: formattedReviews
    };

    console.log('✅ Final response object:', fullData);

    res.status(200).json({
      message: 'Business fetched successfully',
      business: fullData
    });

  } catch (error) {
    console.error('❌ Error fetching business:', error);
    res.status(500).json({
      message: 'Server error while fetching business data',
      error: error.message
    });
  }
};




//get all businesses
// export const getAllBusinesses = async (req, res) => {
//   try {
//     // ✅ Fetch all businesses with categoryRef
//     const businesses = await Business.find().lean(); // lean = plain object for merging

//     // 🧠 Fetch category details for each business
//     const businessesWithCategoryDetails = await Promise.all(
//       businesses.map(async (business) => {
//         const CategoryModel = categoryModels[business.categoryModel];
//         let categoryDetails = {};

//         if (CategoryModel && business.categoryRef) {
//           const categoryDoc = await CategoryModel.findById(business.categoryRef).lean();
//           if (categoryDoc) {
//             categoryDetails = categoryDoc;
//           }
//         }

//         return {
//           ...business,
//           categoryDetails // or rename to 'categoryData' if preferred
//         };
//       })
//     );

//     res.status(200).json({
//       message: 'Businesses fetched successfully',
//       businesses: businessesWithCategoryDetails
//     });
//   } catch (error) {
//     console.error('Error fetching businesses:', error);
//     res.status(500).json({
//       message: 'Server error while fetching businesses',
//       error: error.message
//     });
//   }
// };
export const getAllBusinesses = async (req, res) => {
  try {
    // ✅ Fetch all non-deleted businesses with categoryRef
    const businesses = await Business.find({ isDeleted: false }).lean(); // lean = plain object for merging

    // 🧠 Fetch category details for each business
    const businessesWithCategoryDetails = await Promise.all(
      businesses.map(async (business) => {
        const CategoryModel = categoryModels[business.categoryModel];
        let categoryDetails = {};

        if (CategoryModel && business.categoryRef) {
          const categoryDoc = await CategoryModel.findById(business.categoryRef).lean();
          if (categoryDoc) {
            categoryDetails = categoryDoc;
          }
        }

        return {
          ...business,
          categoryDetails // or rename to 'categoryData' if preferred
        };
      })
    );

    res.status(200).json({
      message: 'Businesses fetched successfully',
      businesses: businessesWithCategoryDetails
    });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({
      message: 'Server error while fetching businesses',
      error: error.message
    });
  }
};



//get user view
// 🔥 Analytics API for business owner's dashboard
export const getUserBusinessViewsAnalytics = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    // Step 1: Fetch businesses owned by this user
    const businesses = await Business.find({ owner: userId }).select('_id name views');

    if (!businesses || businesses.length === 0) {
      return res.status(404).json({ message: 'No businesses found for this user' });
    }

    // Step 2: Get all business IDs
    const businessIds = businesses.map(b => b._id);

    // Step 3: Get review counts for each business
    const reviewCounts = await Review.aggregate([
      { $match: { business: { $in: businessIds } } },
      { $group: { _id: '$business', count: { $sum: 1 } } }
    ]);

    // Step 4: Convert reviewCounts to a map
    const reviewMap = {};
    reviewCounts.forEach(r => {
      reviewMap[r._id.toString()] = r.count;
    });

    // Step 5: Merge views + review count per business
    const viewsPerBusiness = businesses.map(b => ({
      id: b._id,
      name: b.name,
      views: b.views || 0,
      reviews: reviewMap[b._id.toString()] || 0
    }));

    // Step 6: Compute total views and reviews
    const totalViews = viewsPerBusiness.reduce((sum, b) => sum + b.views, 0);
    const totalReviews = viewsPerBusiness.reduce((sum, b) => sum + b.reviews, 0);

    res.status(200).json({
      message: 'Analytics fetched successfully',
      totalViews,
      totalReviews,
      viewsPerBusiness
    });

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching analytics',
      error: error.message
    });
  }
});

export const getBusinessId = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch business document
    const businessDoc = await Business.findById(id);
    if (!businessDoc) {
      return res.status(404).json({ message: 'Business not found' });
    }

    // 2. Get IP address
    let userIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    if (userIp?.startsWith('::ffff:')) userIp = userIp.replace('::ffff:', '');

    // 3. Get user ID if authenticated
    const userId = req.user?._id || null;

    // 4. Ensure viewers array exists
    if (!Array.isArray(businessDoc.viewers)) {
      businessDoc.viewers = [];
    }

    // 5. Check if already viewed in the last 24 hours
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const hasViewed = businessDoc.viewers.some(
      (v) =>
        (v.ip === userIp || (userId && v.user?.toString() === userId.toString())) &&
        new Date(v.viewedAt) > oneDayAgo
    );

    // 6. Add view if not viewed recently
    if (!hasViewed) {
      businessDoc.views += 1;
      businessDoc.viewers.push({
        ip: userIp,
        user: userId,
        viewedAt: now,
      });
      await businessDoc.save();
    }

    // 7. Load category data
    let categoryData = {};
    const CategoryModel = categoryModels[businessDoc.categoryModel];
    if (CategoryModel && businessDoc.categoryRef) {
      const categoryDoc = await CategoryModel.findById(businessDoc.categoryRef).lean();
      if (categoryDoc) {
        const { _id, __v, ...rest } = categoryDoc;
        categoryData = rest;
      }
    }

    // 8. Load reviews
    const reviews = await Review.find({ business: id })
      .populate('user', 'fullName profile.avatar')
      .sort({ createdAt: -1 })
      .lean();

    const formattedReviews = reviews.map((r) => ({
      reviewerName: r.user?.fullName || 'Anonymous',
      reviewerAvatar: r.user?.profile?.avatar || null,
      rating: r.rating,
      comment: r.comment,
      time: r.createdAt,
    }));

    // 9. Load full plan data from Priceplan collection
    let planData = null;
    if (businessDoc.plan) {
      try {
        const planDoc = await Priceplan.findById(businessDoc.plan).lean();
        if (planDoc) {
          const { _id, __v, ...rest } = planDoc;
          planData = rest;
        }
      } catch (err) {
        console.warn('⚠️ Invalid plan ID:', businessDoc.plan);
      }
    }

    // 10. Prepare and send final response
    const business = businessDoc.toObject();
    const fullData = {
      ...business,
      categoryData,
      reviews: formattedReviews,
      totalViews: businessDoc.views || 0,
      planData,
    };

    res.status(200).json({
      message: 'Business fetched successfully',
      business: fullData,
    });

  } catch (error) {
    console.error('❌ Server error in getBusinessId:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message || 'Unexpected error',
    });
  }
};

//api for search businesses according to location and category, or any keyword which is in business model database.

export const searchBusinesses = async (req, res) => {
  try {
    const { keyword = '', location = '' } = req.query;

    if (!keyword && !location) {
      return res.status(400).json({ message: 'Please provide keyword or location' });
    }

    const keywordRegex = new RegExp(keyword, 'i');
    const locationRegex = new RegExp(location, 'i');

    // ✅ STEP 1: Direct Business search
    let results = await Business.find({
      $or: [
        { name: keywordRegex },
        { description: keywordRegex },
        { category: keywordRegex },
        { speciality: keywordRegex },
        { services: keywordRegex },
        { categoryModel: keywordRegex }
      ],
      ...(location ? { 'location.city': locationRegex } : {})
    });

    // ✅ STEP 2: If no results, drop location filter
    if (results.length === 0) {
      results = await Business.find({
        $or: [
          { name: keywordRegex },
          { description: keywordRegex },
          { category: keywordRegex },
            { speciality: keywordRegex },
        { services: keywordRegex },
          { categoryModel: keywordRegex }
        ]
      });
    }

    // ✅ STEP 3: Search across all category models' `speciality`
    if (results.length === 0) {
      let businessIds = [];

      for (const [modelName, Model] of Object.entries(categoryModels)) {
        const matchedDocs = await Model.find({ speciality: keywordRegex }).select('business');

        const ids = matchedDocs
          .map(doc => doc.business)
          .filter(id => !!id); // remove undefined/null

        businessIds.push(...ids);
      }

      if (businessIds.length > 0) {
        results = await Business.find({
          _id: { $in: businessIds },
          ...(location ? { 'location.city': locationRegex } : {})
        });
      }
    }

    res.status(200).json({
      count: results.length,
      results
    });

  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};


//get the business by current sales user id
export const getBusinessBySalesId = asyncHandler(async (req, res) => {
  const salesUserId = req.user._id;

  const businesses = await Business.find({ salesExecutive: salesUserId })
    .populate('owner', 'fullName email')
    .populate('categoryRef')
    .lean();

  const enrichedBusinesses = await Promise.all(
    businesses.map(async (biz) => {
      const reviews = await Review.find({ business: biz._id });
      const avgRating = reviews.length
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      return {
        _id: biz._id,
        title: biz.name,
        owner: biz.owner?.fullName || '',
        ownerEmail: biz.owner?.email || '',
        category: biz.category || '',
        location: biz.location?.city
          ? `${biz.location.city}, ${biz.location.state}`
          : '',
        status: 'Active', // Add a field to track if needed
        rating: parseFloat(avgRating.toFixed(1)),
        reviews: reviews.length,
        views: biz.views || 0,
        revenue: biz.revenue || 0,
        plan: biz.plan || 'N/A', // Optional if plan not implemented
        date: biz.createdAt?.toISOString().split('T')[0],
        featured: biz.featured || false,
        description: biz.description || '',
      };
    })
  );

  res.status(200).json({
    count: enrichedBusinesses.length,
    businesses: enrichedBusinesses,
  });
});


// Get count of businesses by category
export const businessCountByCategory = asyncHandler(async (req, res) => {
  try {
    const counts = await Business.aggregate([
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          total: 1
        }
      },
      {
        $sort: { category: 1 } // optional: sorts alphabetically
      }
    ]);

    res.status(200).json({ success: true, data: counts });
  } catch (error) {
    console.error('❌ Error in category-wise count:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});



//delete with all things
export const deleteBusinessListingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Get business
  const business = await Business.findById(id);
  if (!business) {
    return res.status(404).json({ message: 'Business listing not found.' });
  }

  // 2. Delete S3 images
  const images = [
    business.profileImage,
    business.coverImage,
    ...(business.certificateImages || []),
    ...(business.galleryImages || [])
  ];

  for (const imgUrl of images) {
    if (imgUrl) await deleteFromS3(imgUrl);
  }

  // 3. Delete category-specific data
  const CategoryModel = categoryModels[business.category];
  if (CategoryModel && business.categoryRef) {
    await CategoryModel.findByIdAndDelete(business.categoryRef);
  }

  // 4. Delete leads
  await Leads.deleteMany({ contact: business.email });

  // 5. Delete related notifications
  await Notification.deleteMany({ 'data.businessId': business._id });

  // 6. Finally, delete the business itself
  await Business.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Business and all related data (category, leads, notifications, images) deleted successfully.'
  });
});



//soft delete business
export const softDeleteBusiness = asyncHandler(async (req, res) => {
  const businessId = req.params.id;

  const business = await Business.findById(businessId);

  if (!business) {
    return res.status(404).json({ message: "Business not found" });
  }

  // Optional: check if the logged-in user is owner of this business

  business.isDeleted = true;
  await business.save();

  res.status(200).json({ message: "Business listing is deleted" });
  // res.status(200).json({ message: "Business listing hidden (soft deleted)" });
});

