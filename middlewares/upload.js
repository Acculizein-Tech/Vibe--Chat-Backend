import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Initialize S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 🟢 memory storage
const storage = multer.memoryStorage();

// 🆕 Vibechat limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10MB
const MAX_VIDEO_SIZE = 120 * 1024 * 1024;  // 120MB

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  const imageTypes = [
    '.jpg','.jpeg','.png','.webp','.avif',
    '.gif','.bmp','.tiff','.svg','.jfif'
  ];
  const pdfTypes = ['.pdf'];
  const videoTypes = ['.mp4','.mov','.avi','.mkv'];

  if (file.fieldname === 'certificateImages') {
    return pdfTypes.includes(ext)
      ? cb(null, true)
      : cb(null, false);
  }

  if (imageTypes.includes(ext) || videoTypes.includes(ext)) {
    return cb(null, true);
  }

  cb(null, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // hard cap (video max)
  },
});

const getS3KeyPrefix = (req, file) => {
  let folder = "others";

  const baseUrl = req?.baseUrl || "";
  const params = req?.params || {};

  if (file.fieldname === "qrCode") return "business-qr";

  if (baseUrl.includes("/advertisements")) {
    const adId = params.adId || "temp";
    if (file.fieldname === "image") return `advertisements/${adId}/images`;
    if (file.fieldname === "video") return `advertisements/${adId}/videos`;
    return `advertisements/${adId}/others`;
  }

  if (file.fieldname === "profileImage") {
    folder = baseUrl.includes("/user")
      ? "profile-user"
      : baseUrl.includes("/business")
      ? "profile-business"
      : folder;
  } else if (file.fieldname === "coverImage") folder = "cover-image";
  else if (file.fieldname === "certificateImages") folder = "certificates";
  else if (file.fieldname === "galleryImages") folder = "gallery-images";
  else if (file.fieldname === "eventImages") folder = "events-photo";
  else if (file.fieldname === "aadhaarFront") folder = "aadhaar/front";
  else if (file.fieldname === "aadhaarBack") folder = "aadhaar/back";
  else if (file.fieldname === "driverPhoto") folder = "driver/photo";
  else if (file.fieldname === "licenseCopy") folder = "driver/license";
  else if (file.fieldname === "ryngales-profile") folder = "ryngales-profile";
  else if (file.fieldname === "attachments") folder = "attachments";

  return folder;
};

export const uploadToS3 = async (file, req) => {
  const folder = getS3KeyPrefix(req, file);
  const ext = path.extname(file.originalname).toLowerCase();
  const videoTypes = ['.mp4','.mov','.avi','.mkv'];
  const isVideo = videoTypes.includes(ext);

  try {
    // 🆕 Manual size validation (smooth fail)
    if (!isVideo && file.size > MAX_IMAGE_SIZE) {
      return { success: false, message: "Image size too large" };
    }
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return { success: false, message: "Video size too large" };
    }

    // 🎥 Video upload (no conversion)
    if (isVideo) {
      const key = `${folder}/${Date.now()}-${uuidv4()}${ext}`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));

      return {
        success: true,
        url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
      };
    }

    // 🖼 Image → resize + webp
    const key = `${folder}/${Date.now()}-${uuidv4()}.webp`;

    let pipeline = sharp(file.buffer);

    // 🆕 Dimension cap (WhatsApp style)
    pipeline = pipeline.resize({
      width: 2000,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    });

    if (ext === ".gif") {
      pipeline = sharp(file.buffer, { animated: true });
    }

    const webpBuffer = await pipeline.webp({ quality: 75 }).toBuffer();

    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: webpBuffer,
      ContentType: "image/webp",
    }));

    return {
      success: true,
      url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    };
  } catch (err) {
    console.error("Upload failed:", err.message);
    return {
      success: false,
      message: isVideo
        ? "Video upload failed"
        : "Image upload failed",
    };
  }
};

export default upload;
