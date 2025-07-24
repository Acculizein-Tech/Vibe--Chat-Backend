import express from 'express';
import upload, { uploadToS3 } from '../middlewares/upload.js';
import moment from 'moment-timezone'; // ✅ Add this

const router = express.Router();

const mediaFields = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
  { name: 'certificateImages', maxCount: 5 },
  { name: 'galleryImages', maxCount: 10 },
  { name: 'eventsImage', maxCount: 1 },
  { name: 'others', maxCount: 5 } // ✅ New field

]);

router.post('/upload', mediaFields, async (req, res) => {
  try {
    const uploadedFiles = {};
    const files = req.files || {};

    // Get current time in Asia/Kolkata
    const timestampIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    for (const field in files) {
      uploadedFiles[field] = [];

      for (const file of files[field]) {
        const s3Url = await uploadToS3(file, req);

        console.log(`📦 Uploaded ${file.originalname} at ${timestampIST}`); // ✅ Log IST time

        uploadedFiles[field].push({
          url: s3Url,
          uploadedAt: timestampIST // ✅ Include timestamp in response
        });
      }
    }

    res.json({
      message: '✅ Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
