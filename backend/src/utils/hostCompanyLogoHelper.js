const fs = require('fs');
const path = require('path');
const { uploadsPath } = require('../config/uploadConfig');

/**
 * Resolves a disk file path for an uploaded asset (logo, signature, attachment)
 * across multiple environments (local dev, production, custom UPLOAD_DIR in .env).
 */
const resolveUploadedFilePath = (relativePathOrName) => {
  if (!relativePathOrName || typeof relativePathOrName !== 'string') return null;

  // Clean filename: remove leading slashes and any 'uploads/' prefix
  const normalized = relativePathOrName.replace(/\\/g, '/').replace(/^\/+/, '');
  const fileName = normalized.replace(/^uploads\//i, '');

  const candidates = [
    // 1. Direct match in configured uploadsPath (handles UPLOAD_DIR from .env)
    path.join(uploadsPath, fileName),
    path.join(uploadsPath, normalized),
    // 2. Relative to process cwd
    path.join(process.cwd(), 'backend', 'uploads', fileName),
    path.join(process.cwd(), 'uploads', fileName),
    // 3. Relative to this file's directory
    path.join(__dirname, '../../uploads', fileName),
    path.join(__dirname, '../../../uploads', fileName),
    // 4. Absolute path if provided
    relativePathOrName
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

/**
 * Returns Base64 data URI for the host company logo.
 * If the company has a custom uploaded logo, loads and returns it.
 * If no logo or file missing, returns fallback official company emblem.
 */
const getHostCompanyLogoBase64 = (company) => {
  try {
    if (company && company.company_logo) {
      const diskPath = resolveUploadedFilePath(company.company_logo);
      if (diskPath && fs.existsSync(diskPath)) {
        const ext = path.extname(diskPath).toLowerCase().replace('.', '') || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        return `data:${mime};base64,${fs.readFileSync(diskPath).toString('base64')}`;
      }
    }

    // Default Fallback: look for packaged official SP Techpioneer logo
    const fallbackCandidates = [
      path.join(__dirname, '../../uploads/sp_techpioneer_logo.png'),
      path.join(__dirname, '../../uploads/sp_techpioneer_logo.jpg'),
      path.join(__dirname, '../../../frontend/src/assets/sp_techpioneer_logo.png'),
      path.join(__dirname, '../../../frontend/src/assets/sp_techpioneer_logo.jpg'),
      path.join(__dirname, '../../../frontend/src/assets/sptechpioneer logo.png')
    ];

    for (const fb of fallbackCandidates) {
      if (fs.existsSync(fb)) {
        const ext = path.extname(fb).toLowerCase().replace('.', '') || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        return `data:${mime};base64,${fs.readFileSync(fb).toString('base64')}`;
      }
    }
  } catch (err) {
    console.error('[hostCompanyLogoHelper] Error converting logo to base64:', err.message);
  }

  return null;
};

/**
 * Returns Base64 data URI for the authorized signature.
 */
const getHostCompanySignatureBase64 = (company) => {
  try {
    if (company && company.authorized_signature) {
      const diskPath = resolveUploadedFilePath(company.authorized_signature);
      if (diskPath && fs.existsSync(diskPath)) {
        const ext = path.extname(diskPath).toLowerCase().replace('.', '') || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
        return `data:${mime};base64,${fs.readFileSync(diskPath).toString('base64')}`;
      }
    }
  } catch (err) {
    console.error('[hostCompanyLogoHelper] Error converting signature to base64:', err.message);
  }

  return null;
};

module.exports = {
  resolveUploadedFilePath,
  getHostCompanyLogoBase64,
  getHostCompanySignatureBase64
};
