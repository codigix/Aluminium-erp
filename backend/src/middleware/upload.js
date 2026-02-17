const fs = require('fs');
const multer = require('multer');
const { uploadsPath } = require('../config/uploadConfig');

console.log(`[Upload Middleware] Uploads directory: ${uploadsPath}`);

if (!fs.existsSync(uploadsPath)) {
  try {
    fs.mkdirSync(uploadsPath, { recursive: true });
    console.log(`[Upload Middleware] Created uploads directory: ${uploadsPath}`);
  } catch (err) {
    console.error(`[Upload Middleware] Error creating uploads directory: ${err.message}`);
  }
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsPath),
  filename: (_, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

module.exports = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});
