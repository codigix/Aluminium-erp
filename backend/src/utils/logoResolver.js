const fs = require('fs');
const path = require('path');

let cachedLogoBase64 = null;

/**
 * Returns the fixed company logo as a base64 data URI string.
 * Strictly loads from backend/src/assets/sp_emblem.png with in-memory caching.
 * Independent of frontend directories or database upload paths.
 */
function getCompanyLogoBase64() {
  if (cachedLogoBase64) {
    return cachedLogoBase64;
  }

  const fixedLogoPath = path.join(__dirname, '../assets/sp_emblem.png');

  try {
    if (fs.existsSync(fixedLogoPath)) {
      const buffer = fs.readFileSync(fixedLogoPath);
      cachedLogoBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
      return cachedLogoBase64;
    }
  } catch (err) {
    console.error('[logoResolver] Error reading fixed logo asset:', err.message);
  }

  // Secondary fallback: check backend/uploads/sp_emblem.png if present
  try {
    const fallbackUploadPath = path.join(__dirname, '../../uploads/sp_emblem.png');
    if (fs.existsSync(fallbackUploadPath)) {
      const buffer = fs.readFileSync(fallbackUploadPath);
      cachedLogoBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
      return cachedLogoBase64;
    }
  } catch (err) {
    console.error('[logoResolver] Error reading fallback logo:', err.message);
  }

  return cachedLogoBase64;
}

/**
 * Returns absolute path to the fixed company logo asset.
 */
function getLogoPath() {
  return path.join(__dirname, '../assets/sp_emblem.png');
}

module.exports = {
  getCompanyLogoBase64,
  getLogoPath
};
