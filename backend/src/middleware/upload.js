const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

module.exports = multer({ storage });
