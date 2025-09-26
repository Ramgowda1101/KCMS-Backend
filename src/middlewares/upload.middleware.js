// src/middlewares/upload.middleware.js
const multer = require("multer");

// Use memory storage so service decides where to persist (local or S3)
const storage = multer.memoryStorage();

// Allowed MIME types (extend as needed)
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Maximum file size (bytes) — default 10MB
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || `${10 * 1024 * 1024}`, 10);

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error("Unsupported file type"), false);
  }
  cb(null, true);
}

/**
 * uploadMiddleware(fieldName, maxCount)
 * - fieldName: the multipart field name used by frontend (default 'files')
 * - maxCount: maximum number of files (default 5)
 */
function uploadMiddleware(fieldName = "files", maxCount = 5) {
  const uploader = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter,
  });
  return uploader.array(fieldName, maxCount);
}

module.exports = uploadMiddleware;
