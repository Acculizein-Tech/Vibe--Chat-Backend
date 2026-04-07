import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import sharp from 'sharp';
import zlib from 'zlib';
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
const MAX_ATTACHMENT_SIZE = 200 * 1024 * 1024; // 200 MB
const MAX_IMAGE_SIZE = MAX_ATTACHMENT_SIZE;
const MAX_VIDEO_SIZE = MAX_ATTACHMENT_SIZE;
const MAX_FILE_SIZE = MAX_ATTACHMENT_SIZE;

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  const imageTypes = [
    '.jpg','.jpeg','.png','.webp','.avif',
    '.gif','.bmp','.tiff','.svg','.jfif'
  ];
  const pdfTypes = ['.pdf'];
  const videoTypes = ['.mp4','.mov','.avi','.mkv'];
  const audioTypes = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac'];
  const docTypes = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.zip', '.rar', '.7z', '.json', '.xml'
  ];

  if (file.fieldname === 'certificateImages') {
    return pdfTypes.includes(ext)
      ? cb(null, true)
      : cb(null, false);
  }

  if (file.fieldname === 'attachments') {
    const mime = String(file.mimetype || "").toLowerCase();
    if (
      imageTypes.includes(ext) ||
      videoTypes.includes(ext) ||
      audioTypes.includes(ext) ||
      docTypes.includes(ext) ||
      mime.startsWith("image/") ||
      mime.startsWith("video/") ||
      mime.startsWith("application/") ||
      mime.startsWith("text/") ||
      mime.startsWith("audio/")
    ) {
      return cb(null, true);
    }
    return cb(null, false);
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
    fileSize: MAX_ATTACHMENT_SIZE, // hard cap for chat attachments
  },
});

const clampPositiveInt = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n));
};

const findZipEocdOffset = (buffer) => {
  const sig = 0x06054b50;
  const min = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === sig) return i;
  }
  return -1;
};

const parseZipCentralDirectory = (buffer) => {
  try {
    if (!Buffer.isBuffer(buffer) || buffer.length < 22) return [];
    const eocd = findZipEocdOffset(buffer);
    if (eocd < 0) return [];

    const totalEntries = buffer.readUInt16LE(eocd + 10);
    const centralSize = buffer.readUInt32LE(eocd + 12);
    const centralOffset = buffer.readUInt32LE(eocd + 16);
    if (!centralOffset || !centralSize) return [];

    let pos = centralOffset;
    const out = [];
    for (let i = 0; i < totalEntries && pos + 46 <= buffer.length; i += 1) {
      const sig = buffer.readUInt32LE(pos);
      if (sig !== 0x02014b50) break;
      const compressionMethod = buffer.readUInt16LE(pos + 10);
      const compressedSize = buffer.readUInt32LE(pos + 20);
      const uncompressedSize = buffer.readUInt32LE(pos + 24);
      const fileNameLen = buffer.readUInt16LE(pos + 28);
      const extraLen = buffer.readUInt16LE(pos + 30);
      const commentLen = buffer.readUInt16LE(pos + 32);
      const localHeaderOffset = buffer.readUInt32LE(pos + 42);
      const nameStart = pos + 46;
      const nameEnd = nameStart + fileNameLen;
      if (nameEnd > buffer.length) break;
      const name = buffer.toString('utf8', nameStart, nameEnd);
      out.push({
        name,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      });
      pos = nameEnd + extraLen + commentLen;
    }
    return out;
  } catch {
    return [];
  }
};

const extractZipEntryBuffer = (zipBuffer, entry) => {
  try {
    const localOffset = Number(entry?.localHeaderOffset || 0);
    if (!localOffset || localOffset + 30 > zipBuffer.length) return null;
    if (zipBuffer.readUInt32LE(localOffset) !== 0x04034b50) return null;
    const fileNameLen = zipBuffer.readUInt16LE(localOffset + 26);
    const extraLen = zipBuffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + fileNameLen + extraLen;
    const dataEnd = dataStart + Number(entry?.compressedSize || 0);
    if (dataStart < 0 || dataEnd > zipBuffer.length || dataEnd <= dataStart) return null;
    const raw = zipBuffer.subarray(dataStart, dataEnd);
    if (entry.compressionMethod === 0) return raw;
    if (entry.compressionMethod === 8) return zlib.inflateRawSync(raw);
    return null;
  } catch {
    return null;
  }
};

const extractZipEntryText = (zipBuffer, entries, targetName) => {
  const target = entries.find((e) => String(e?.name || '') === String(targetName));
  if (!target) return '';
  const entryBuffer = extractZipEntryBuffer(zipBuffer, target);
  return entryBuffer ? entryBuffer.toString('utf8') : '';
};

const estimateDocumentPages = ({ buffer, ext, mimeType }) => {
  const extension = String(ext || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();

  // Text-like documents: estimate by lines (roughly 45 lines/page).
  if (['.txt', '.csv', '.json', '.xml', '.md', '.log'].includes(extension) || mime.startsWith('text/')) {
    try {
      const text = Buffer.from(buffer || Buffer.alloc(0)).toString('utf8');
      const lines = text ? text.split(/\r\n|\n|\r/).length : 0;
      return clampPositiveInt(Math.ceil(Math.max(lines, 1) / 45));
    } catch {
      return null;
    }
  }

  // OOXML formats (zip containers): docx/pptx/xlsx.
  if (['.docx', '.pptx', '.xlsx'].includes(extension)) {
    const entries = parseZipCentralDirectory(buffer);
    if (!entries.length) return null;

    if (extension === '.pptx') {
      const slideCount = entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(String(e?.name || ''))).length;
      return clampPositiveInt(slideCount);
    }

    if (extension === '.xlsx') {
      const sheetCount = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(String(e?.name || ''))).length;
      return clampPositiveInt(sheetCount);
    }

    if (extension === '.docx') {
      const appXml = extractZipEntryText(buffer, entries, 'docProps/app.xml');
      const appPages = clampPositiveInt((appXml.match(/<Pages>(\d+)<\/Pages>/i) || [])[1]);
      if (appPages) return appPages;

      const docXml = extractZipEntryText(buffer, entries, 'word/document.xml');
      if (docXml) {
        const explicitBreaks = (docXml.match(/w:type=\"page\"/g) || []).length;
        const sectionBreaks = (docXml.match(/<w:sectPr\b/g) || []).length;
        const approx = Math.max(explicitBreaks + 1, sectionBreaks || 1);
        return clampPositiveInt(approx);
      }
    }
  }

  // Legacy office docs: render-engine ke bina exact pages unreliable, fallback 1.
  if ([
    '.doc', '.xls', '.ppt', '.rtf', '.odt', '.ods', '.odp',
    '.epub', '.pages', '.numbers', '.key',
  ].includes(extension)) {
    return 1;
  }

  // Generic application docs fallback.
  if (mime.startsWith('application/')) {
    return 1;
  }
  return null;
};

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

export const uploadToS3 = async (file, req, options = {}) => {
  const abortSignal = options?.abortSignal;
  const folder = getS3KeyPrefix(req, file);
  const ext = path.extname(file.originalname).toLowerCase();
  const videoTypes = ['.mp4','.mov','.avi','.mkv'];
  const imageTypes = [
    '.jpg','.jpeg','.png','.webp','.avif',
    '.gif','.bmp','.tiff','.svg','.jfif',
    '.heic','.heif'
  ];
  const isVideo = videoTypes.includes(ext);
  const isImage = imageTypes.includes(ext);
  const mime = String(file?.mimetype || "").toLowerCase();
  const isHeic =
    ext === ".heic" ||
    ext === ".heif" ||
    mime.includes("heic") ||
    mime.includes("heif");
  const isPdf = ext === ".pdf" || String(file?.mimetype || "").toLowerCase().includes("pdf");
  const parsePdfPageCountFromBuffer = (buffer) => {
    try {
      const latin1 = Buffer.from(buffer || Buffer.alloc(0)).toString("latin1");
      // Prefer catalog/pages-tree count first (most accurate when present)
      const objMap = new Map();
      const objRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
      let objMatch = null;
      while ((objMatch = objRegex.exec(latin1)) !== null) {
        const key = `${objMatch[1]} ${objMatch[2]}`;
        objMap.set(key, String(objMatch[3] || ""));
      }
      const trailerRoot =
        latin1.match(/\/Root\s+(\d+)\s+(\d+)\s+R/) ||
        latin1.match(/\/Type\s*\/Catalog[\s\S]{0,300}?\/Pages\s+(\d+)\s+(\d+)\s+R/);
      if (trailerRoot) {
        const rootKey = `${trailerRoot[1]} ${trailerRoot[2]}`;
        let rootObj = objMap.get(rootKey) || "";
        if (!rootObj && latin1.includes("/Type/Catalog")) {
          const catalogInline = latin1.match(/\/Type\s*\/Catalog[\s\S]{0,300}/);
          rootObj = String(catalogInline?.[0] || "");
        }
        const pagesRef = rootObj.match(/\/Pages\s+(\d+)\s+(\d+)\s+R/);
        if (pagesRef) {
          const pagesKey = `${pagesRef[1]} ${pagesRef[2]}`;
          const pagesObj = objMap.get(pagesKey) || "";
          const pagesCount = Number((pagesObj.match(/\/Count\s+(\d{1,6})\b/) || [])[1] || 0);
          if (Number.isFinite(pagesCount) && pagesCount > 0 && pagesCount < 50000) {
            return pagesCount;
          }
        }
      }

      const countMatches = [...latin1.matchAll(/\/Count\s+(\d{1,6})\b/g)]
        .map((m) => Number(m?.[1] || 0))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (countMatches.length) {
        const maxCount = Math.max(...countMatches);
        if (maxCount > 0 && maxCount < 50000) return maxCount;
      }
      const pageMatches = latin1.match(/\/Type\s*\/Page\b/g);
      const pages = Array.isArray(pageMatches) ? pageMatches.length : 0;
      return pages > 0 ? pages : null;
    } catch {
      return null;
    }
  };
  const isAbortLikeError = (error) => {
    const name = String(error?.name || "").toLowerCase();
    const code = String(error?.code || "").toUpperCase();
    return (
      code === "ECONNRESET" ||
      code === "ECONNABORTED" ||
      code === "EPIPE" ||
      code === "ABORT_ERR" ||
      name.includes("abort")
    );
  };
  const sendToS3 = (command) => {
    if (abortSignal?.aborted) {
      const abortErr = new Error("Upload canceled by client");
      abortErr.name = "AbortError";
      abortErr.code = "ABORT_ERR";
      throw abortErr;
    }
    return abortSignal
      ? s3.send(command, { abortSignal })
      : s3.send(command);
  };

  try {
    // 🆕 Manual size validation (smooth fail)
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      return { success: false, message: "Image size too large (max 200 MB)" };
    }
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return { success: false, message: "Video size too large (max 200 MB)" };
    }
    if (!isImage && !isVideo && file.size > MAX_FILE_SIZE) {
      return { success: false, message: "File size too large (max 200 MB)" };
    }

    // 🎥 Video upload (no conversion)
    if (isVideo) {
      const key = `${folder}/${Date.now()}-${uuidv4()}${ext}`;
      await sendToS3(new PutObjectCommand({
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

    // Generic files (docs/audio/etc): upload as-is
    if (!isImage) {
      const key = `${folder}/${Date.now()}-${uuidv4()}${ext || ""}`;
      await sendToS3(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
      }));

      let thumbnailUrl = "";
      let pageCount = null;
      if (isPdf) {
        try {
          // Most reliable source when libvips has PDF support.
          const pdfMeta = await sharp(file.buffer, { density: 120 }).metadata();
          const metaPages = Number(pdfMeta?.pages || 0);
          if (Number.isFinite(metaPages) && metaPages > 0) {
            pageCount = Math.round(metaPages);
          }
        } catch {
          // continue to text parser fallback
        }
        if (!pageCount) {
          pageCount = parsePdfPageCountFromBuffer(file.buffer);
        }
        try {
          const thumbKey = `${folder}/thumbs/${Date.now()}-${uuidv4()}.webp`;
          const thumbBuffer = await sharp(file.buffer, { density: 180, page: 0 })
            .resize({
              width: 800,
              height: 1100,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 74 })
            .toBuffer();
          await sendToS3(new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: thumbKey,
            Body: thumbBuffer,
            ContentType: "image/webp",
          }));
          thumbnailUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${thumbKey}`;
        } catch (_thumbErr) {
          thumbnailUrl = "";
        }
      } else {
        pageCount =
          estimateDocumentPages({
            buffer: file.buffer,
            ext,
            mimeType: file.mimetype,
          }) || null;
      }

      return {
        success: true,
        url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
        thumbnailUrl,
        pageCount,
      };
    }

    if (isHeic) {
      const key = `${folder}/${Date.now()}-${uuidv4()}${ext || ""}`;
      await sendToS3(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "image/heic",
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

    await sendToS3(new PutObjectCommand({
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
    const wasClientAborted = Boolean(req?.aborted) || isAbortLikeError(err);
    if (wasClientAborted) {
      return {
        success: false,
        canceled: true,
        message: "Upload canceled by client",
      };
    }
    console.error("Upload failed:", err.message);
    return {
      success: false,
      message: isVideo
        ? "Video upload failed"
        : isImage
          ? "Image upload failed"
          : "File upload failed",
    };
  }
};

export default upload;

