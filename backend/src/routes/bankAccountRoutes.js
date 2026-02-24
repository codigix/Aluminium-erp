const express = require('express');
const router = express.Router();
const bankAccountController = require('../controllers/bankAccountController');
const { authorize } = require('../middleware/authMiddleware');

router.post('/', authorize(['PAYMENT_SETUP']), bankAccountController.createBankAccount);
router.get('/', authorize(['PAYMENT_VIEW']), bankAccountController.getBankAccounts);
router.get('/:accountId', authorize(['PAYMENT_VIEW']), bankAccountController.getBankAccountById);
router.put('/:accountId', authorize(['PAYMENT_SETUP']), bankAccountController.updateBankAccount);
router.patch('/:accountId/deactivate', authorize(['PAYMENT_SETUP']), bankAccountController.deactivateBankAccount);
router.delete('/:accountId', authorize(['PAYMENT_SETUP']), bankAccountController.deleteBankAccount);

module.exports = router;
