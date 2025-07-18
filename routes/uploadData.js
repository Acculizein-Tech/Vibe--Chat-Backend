import express from 'express';
import upload, { uploadToS3 } from '../middlewares/upload.js';

const router = express.Router();

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const imageUrl = await uploadToS3(req.file);
    res.status(200).json({ success: true, imageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

export default router;
