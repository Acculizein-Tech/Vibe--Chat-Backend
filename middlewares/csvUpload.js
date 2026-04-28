import multer from "multer";
import path from "path";

const csvStorage = multer.memoryStorage();

const csvFileFilter = (_req, file, cb) => {
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();
  const mime = String(file?.mimetype || "").toLowerCase();
  const hasCsvExt = ext === ".csv";
  const isCsvLikeMime =
    mime.includes("text/csv") ||
    mime.includes("text/comma-separated-values") ||
    mime.includes("application/csv") ||
    mime.includes("application/vnd.ms-excel") ||
    mime.includes("text/plain") ||
    mime === "application/octet-stream" ||
    !mime;

  // Mobile/Web pickers often send unpredictable mime/filename combos.
  // Accept if either extension OR mime strongly suggests CSV.
  if (hasCsvExt || isCsvLikeMime) {
    cb(null, true);
    return;
  }

  cb(new Error("Only .csv files are allowed"));
};

export const csvUpload = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});
