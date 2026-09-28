// src/middleware/upload.js

const multer = require('multer');

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function fileFilter(req, file, cb) {
  if (!ALLOWED.has(file.mimetype)) {
    return cb(
      new Error('Only JPG, PNG, WEBP and GIF images are allowed.')
    );
  }

  cb(null, true);
}

// Store the original upload in memory.
// Sharp will optimize it before sending it to Supabase Storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Allow original camera images up to 25 MB.
    // The file is compressed before reaching Supabase.
    fileSize: 25 * 1024 * 1024,

    // Maximum 8 images per product.
    files: 8,
  },
  fileFilter,
});

module.exports = {
  upload,
};