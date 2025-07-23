import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

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

// File filter logic
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const imageTypes = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
  const pdfTypes = ['.pdf'];

  if (file.fieldname === 'certificateImages') {
    return pdfTypes.includes(ext)
      ? cb(null, true)
      : cb(new Error('Only PDF files are allowed for certificateImages'));
  }

  const allowedImageFields = ['profileImage', 'coverImage', 'galleryImages', 'bannerImage'];
  if (allowedImageFields.includes(file.fieldname)) {
    return imageTypes.includes(ext)
      ? cb(null, true)
      : cb(new Error(`Only image files are allowed for ${file.fieldname}`));
  }

  cb(null, true); // allow other types if needed
};

const upload = multer({ storage, fileFilter });

/**
 * Get correct S3 folder path based on request
 */
const getS3KeyPrefix = (req, file) => {
  let folder = 'others';

  if (file.fieldname === 'profileImage') {
    if (req.baseUrl.includes('/user')) {
      folder = 'profile-user';
    } else if (req.baseUrl.includes('/business')) {
      folder = 'profile-business';
    }
  } else if (file.fieldname === 'coverImage') {
    folder = 'cover-image';
  } else if (file.fieldname === 'certificateImages') {
    folder = 'certificates';
  } else if (file.fieldname === 'galleryImages') {
    folder = 'gallery-images';
  } else if (file.fieldname === 'bannerImage') {
    folder = 'events-photo';
  }

  return folder;
};

/**
 * Upload single file to S3 and return a pre-signed URL
 */
export const uploadToS3 = async (file, req) => {
  const folder = getS3KeyPrefix(req, file);
  const key = `${folder}/${file.filename}`;
  const fileStream = fs.createReadStream(file.path);

  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: file.mimetype,
  };

  await s3.send(new PutObjectCommand(uploadParams));

  // Remove local file after upload
  fs.unlinkSync(file.path);

  // Generate pre-signed URL (valid for 1 hour)
  const getCommand = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 3600 }); // 1 hour

  return signedUrl;
};

export default upload;


