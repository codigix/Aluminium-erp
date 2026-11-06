const express = require('express');
const router = express.Router();
const customerMasterController = require('../controllers/customerMasterController');
const { authorize } = require('../middleware/authMiddleware');

// Customer Master (Sales). Read: anyone who can view customers or POs (so other Sales modules can reuse it).
// Write: customer editors and Sales users who create / edit POs.
const VIEW = ['COMPANY_VIEW', 'PO_VIEW'];
const EDIT = ['COMPANY_EDIT', 'PO_CREATE', 'PO_EDIT'];

router.get('/', authorize(VIEW), customerMasterController.listCustomers);
router.get('/:id', authorize(VIEW), customerMasterController.getCustomerById);
router.post('/', authorize(EDIT), customerMasterController.createCustomer);
router.put('/:id', authorize(EDIT), customerMasterController.updateCustomer);
router.patch('/:id/status', authorize(EDIT), customerMasterController.updateCustomerStatus);
router.delete('/:id', authorize(EDIT), customerMasterController.deleteCustomer);

module.exports = router;
