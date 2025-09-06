// middlewares/uploadWrapper.js
export const handleUpload = (mediaFields) => {
  return (req, res, next) => {
    mediaFields(req, res, async function (err) {
      if (err) {
        // Multer specific errors
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          if (err.field === "galleryImages") {
            return res.status(400).json({
              success: false,
              message: "❌ You can upload maximum 10 images in galleryImages",
            });
          }

          if (err.field === "certificateImages") {
            return res.status(400).json({
              success: false,
              message: "❌ You can upload maximum 5 images in certificateImages",
            });
          }

          return res.status(400).json({
            success: false,
            message: `❌ Unexpected file for field "${err.field}". Please check allowed fields.`,
          });
        }

        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: `❌ File too large for field "${err.field}".`,
          });
        }

        return res.status(400).json({
          success: false,
          message: err.message || "Upload error",
        });
      }

      // ✅ Manual check for galleryImages max 10
      if (req.files?.galleryImages && req.files.galleryImages.length > 10) {
        return res.status(400).json({
          success: false,
          message: "❌ You can upload maximum 10 images in galleryImages",
        });
      }

      // ✅ Manual check for certificateImages max 5
      if (req.files?.certificateImages && req.files.certificateImages.length > 5) {
        return res.status(400).json({
          success: false,
          message: "❌ You can upload maximum 5 images in certificateImages",
        });
      }

      // ✅ Convert all uploaded files to string URLs to avoid [object Object]
      for (const field in req.files) {
        req.files[field] = req.files[field].map(file => {
          if (file.location) return file.location; // if using S3 multer storage
          if (file.path) return file.path;         // local storage fallback
          return file.url || file;                 // fallback
        });
      }

      // No error → continue
      next();
    });
  };
};
