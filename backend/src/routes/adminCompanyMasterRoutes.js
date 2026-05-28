const express = require('express');
const router = express.Router();
const adminCompanyMasterController = require('../controllers/adminCompanyMasterController');
const { authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Fetch the active company master for documents & invoices (accessible by all authenticated users)
router.get('/active', adminCompanyMasterController.getActiveCompany);

// Protected endpoints for system admin management
router.get('/', authorize(['COMPANY_VIEW']), adminCompanyMasterController.getCompanies);
router.get('/:id', authorize(['COMPANY_VIEW']), adminCompanyMasterController.getCompanyById);
router.post(
  '/', 
  authorize(['COMPANY_EDIT']), 
  upload.fields([
    { name: 'companyLogo', maxCount: 1 },
    { name: 'authorizedSignature', maxCount: 1 }
  ]), 
  adminCompanyMasterController.createCompany
);
router.put(
  '/:id', 
  authorize(['COMPANY_EDIT']), 
  upload.fields([
    { name: 'companyLogo', maxCount: 1 },
    { name: 'authorizedSignature', maxCount: 1 }
  ]), 
  adminCompanyMasterController.updateCompany
);
router.delete('/:id', authorize(['COMPANY_EDIT']), adminCompanyMasterController.deleteCompany);

module.exports = router;
