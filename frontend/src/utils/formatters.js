/**
 * Standardized function to clean project names
 * Removes "Design Review - Drawing" prefix and "for [Client]" suffix
 * @param {string} name - The raw project name
 * @param {string} clientName - Optional client name fallback
 * @returns {string} - The cleaned project name
 */
export const cleanProjectName = (name, clientName = '') => {
  if (!name) return clientName || 'Internal';
  
  // Replace "Design Review - Drawing" with "Project"
  let cleaned = name.replace(/Design Review - Drawing\s+/i, 'Project ');
  
  // Remove "for [Client]" part
  cleaned = cleaned.split(/\s+for\s+/i)[0];
  
  return cleaned;
};
