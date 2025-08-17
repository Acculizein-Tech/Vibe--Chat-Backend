//upload.js

import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand  } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

dotenv.config();

// Initialize S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Local temp storage before uploading to S3
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempPath = './temp/';
    if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });
    cb(null, tempPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${file.fieldname}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter logic (allow all common image types)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const imageTypes = [
    '.jpg', '.jpeg', '.png', '.webp', '.avif',
    '.gif', '.bmp', '.tiff', '.svg' , '.jfif'
  ];
  const pdfTypes = ['.pdf'];

  if (file.fieldname === 'certificateImages') {
    return pdfTypes.includes(ext)
      ? cb(null, true)
      : cb(new Error('Only PDF files are allowed for certificateImages'));
  }

  const allowedImageFields = [
    'profileImage', 'coverImage', 'galleryImages',
    'bannerImage', 'others'
  ];
  if (allowedImageFields.includes(file.fieldname)) {
    return imageTypes.includes(ext)
      ? cb(null, true)
      : cb(new Error(`Only image files are allowed for ${file.fieldname}`));
  }

  cb(null, true);
};

const upload = multer({ storage, fileFilter });

// Get correct S3 folder path
const getS3KeyPrefix = (req, file) => {
  let folder = 'others';

  if (file.fieldname === 'profileImage') {
    folder = req.baseUrl.includes('/user')
      ? 'profile-user'
      : req.baseUrl.includes('/business')
        ? 'profile-business'
        : folder;
  } else if (file.fieldname === 'coverImage') {
    folder = 'cover-image';
  } else if (file.fieldname === 'certificateImages') {
    folder = 'certificates';
  } else if (file.fieldname === 'galleryImages') {
    folder = 'gallery-images';
  } else if (file.fieldname === 'eventImages') {
    folder = 'events-photo';
  } else if (file.fieldname === 'aadhaarFront') {
    folder = 'aadhaar/front';
  } else if (file.fieldname === 'aadhaarBack') {
    folder = 'aadhaar/back';
  } else if (file.fieldname === 'driverPhoto') {
    folder = 'driver/photo';
  } else if (file.fieldname === 'licenseCopy') {
    folder = 'driver/license';
  }

  return folder;
};


// Helper to delete file from S3
// export const deleteFromS3 = async (fileUrl) => {
//   try {
//     if (!fileUrl) return false;

//     // Parse key safely
//     const key = new URL(fileUrl).pathname.substring(1);

//     await s3.send(new DeleteObjectCommand({
//       Bucket: process.env.AWS_BUCKET_NAME,
//       Key: key
//     }));

//     console.log(`🗑 Deleted from S3: ${key}`);
//     return true;
//   } catch (err) {
//     console.error(`❌ Failed to delete from S3: ${fileUrl}`, err);
//     return false;
//   }
// };


// Upload and convert images
export const uploadToS3 = async (file, req) => {
  const folder = getS3KeyPrefix(req, file);
  const baseFileName = path.parse(file.filename).name;
  const key = `${folder}/${baseFileName}.webp`;
  const ext = path.extname(file.originalname).toLowerCase();

  try {
    let webpBuffer;

    if (ext === '.gif') {
      // Convert animated GIF → first frame WebP
      webpBuffer = await sharp(file.path, { animated: true })
        .webp({ quality: 80 })
        .toBuffer();
    } else if (ext === '.svg') {
      // Convert SVG → PNG → WebP
      const pngBuffer = await sharp(file.path).png().toBuffer();
      webpBuffer = await sharp(pngBuffer).webp({ quality: 80 }).toBuffer();
    } else {
      // Other image formats
      webpBuffer = await sharp(file.path)
        .webp({ quality: 80 })
        .toBuffer();
    }

    // Upload to S3
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: webpBuffer,
      ContentType: 'image/webp'
    }));

    // Delete temp file after processing
    fs.unlink(file.path, () => {});

    return {
      success: true,
      url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      message: (ext === '.gif' || ext === '.svg')
        ? 'Some images were optimized for faster loading.'
        : undefined
    };
  } catch (err) {
    console.error(`❌ Upload failed for "${file.filename}":`, err.message);
    return {
      success: false,
      message: 'We could not process one of your images. Please try again.'
    };
  }
};

export default upload;