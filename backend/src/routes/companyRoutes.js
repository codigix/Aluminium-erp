const express = require('express');
const router = express.Router();
const companyController = require('../controllers/CompanyController');

const { authorize } = require('../middleware/authMiddleware');

router.post('/', authorize(['COMPANY_EDIT']), companyController.createCompany);
router.get('/', authorize(['COMPANY_VIEW']), companyController.getCompanies);
router.put('/:companyId', authorize(['COMPANY_EDIT']), companyController.updateCompany);
router.patch('/:companyId/status', authorize(['COMPANY_EDIT']), companyController.updateCompanyStatus);
router.delete('/:companyId', authorize(['COMPANY_EDIT']), companyController.deleteCompany);
router.post('/:companyId/contacts', authorize(['COMPANY_EDIT']), companyController.addContact);
router.put('/:companyId/contacts/:contactId', authorize(['COMPANY_EDIT']), companyController.updateContact);
router.patch('/:companyId/contacts/:contactId/status', authorize(['COMPANY_EDIT']), companyController.updateContactStatus);
router.delete('/:companyId/contacts/:contactId', authorize(['COMPANY_EDIT']), companyController.deleteContact);
router.get('/:companyId/contacts', authorize(['COMPANY_VIEW']), companyController.getContacts);

module.exports = router;
