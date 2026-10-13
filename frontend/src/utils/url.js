
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
const UPLOAD_BASE = import.meta.env.VITE_UPLOAD_URL;

/**
 * Standardized function to get file URLs from backend paths
 * @param {string} path - The path from the database (e.g., 'uploads/filename.jpg' or 'filename.jpg')
 * @returns {string} - The full URL to the file
 */
export const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // 1. Determine base URL (priority: VITE_UPLOAD_URL -> API_BASE/uploads -> window.origin/api/uploads)
  let base = UPLOAD_BASE;
  
  if (!base) {
    // Keep the /api prefix if it exists so Nginx routes to backend
    if (API_BASE.endsWith('/api')) {
      base = API_BASE + '/uploads';
    } else if (API_BASE.endsWith('/api/')) {
      base = API_BASE + 'uploads';
    } else {
      base = API_BASE + '/uploads';
    }
  }
  
  if (base.endsWith('/')) base = base.slice(0, -1);
  
  // 2. Clean incoming path (normalize backslashes and strip leading redundant 'uploads/')
  let cleanPath = String(path).replace(/\\/g, '/').replace(/^\/+/, '');
  
  if (cleanPath.toLowerCase().startsWith('uploads/')) {
    cleanPath = cleanPath.slice(8);
  }
  cleanPath = cleanPath.replace(/^\/+/, '');
  
  const url = `${base}/${cleanPath}`;
  
  // 3. Final URL absolute construction for production
  if (url.startsWith('http')) return url;
  
  // For relative URLs like '/api/uploads/...', prepend the origin
  const origin = window.location.origin;
  return origin + (url.startsWith('/') ? url : '/' + url);
};
