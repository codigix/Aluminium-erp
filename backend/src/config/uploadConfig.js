const path = require('path');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

const uploadsPath = path.isAbsolute(UPLOAD_DIR)
  ? UPLOAD_DIR
  : path.join(process.cwd(), UPLOAD_DIR);

module.exports = {
  UPLOAD_DIR,
  uploadsPath
};
