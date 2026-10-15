const express = require('express');
const router = express.Router();
const bankAccountController = require('../controllers/bankAccountController');
const { authorize } = require('../middleware/authMiddleware');

const VIEW_PERMISSIONS = ['PAYMENT_VIEW', 'PAYMENT_SETUP', 'PAYMENT_PROCESS', 'ACCOUNTS_DASHBOARD_VIEW', 'ORDER_VIEW'];
const MANAGE_PERMISSIONS = ['PAYMENT_SETUP', 'PAYMENT_PROCESS', 'PAYMENT_EDIT', 'ACCOUNTS_DASHBOARD_VIEW'];

router.get('/', authorize(VIEW_PERMISSIONS), bankAccountController.getBankAccounts);
router.get('/:accountId', authorize(VIEW_PERMISSIONS), bankAccountController.getBankAccountById);
router.post('/', authorize(MANAGE_PERMISSIONS), bankAccountController.createBankAccount);
router.put('/:accountId', authorize(MANAGE_PERMISSIONS), bankAccountController.updateBankAccount);
router.patch('/:accountId/toggle-status', authorize(MANAGE_PERMISSIONS), bankAccountController.toggleBankAccountStatus);
router.patch('/:accountId/deactivate', authorize(MANAGE_PERMISSIONS), bankAccountController.deactivateBankAccount);
router.delete('/:accountId', authorize(MANAGE_PERMISSIONS), bankAccountController.deleteBankAccount);

module.exports = router;
