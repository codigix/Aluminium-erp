const express = require('express');
const router = express.Router();
const companyController = require('../controllers/CompanyController');

router.post('/', companyController.createCompany);
router.get('/', companyController.getCompanies);
router.put('/:companyId', companyController.updateCompany);
router.patch('/:companyId/status', companyController.updateCompanyStatus);
router.delete('/:companyId', companyController.deleteCompany);
router.post('/:companyId/contacts', companyController.addContact);
router.put('/:companyId/contacts/:contactId', companyController.updateContact);
router.patch('/:companyId/contacts/:contactId/status', companyController.updateContactStatus);
router.delete('/:companyId/contacts/:contactId', companyController.deleteContact);
router.get('/:companyId/contacts', companyController.getContacts);

module.exports = router;
