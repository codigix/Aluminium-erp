const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const customerPoController = require('../controllers/customerPoController');

const { blockInProduction, authorize } = require('../middleware/authMiddleware');

router.post('/parse', authorize(['PO_CREATE', 'PO_EDIT']), upload.single('poPdf'), customerPoController.parseCustomerPoPdf);
router.post('/', authorize(['PO_CREATE']), upload.single('poPdf'), customerPoController.createCustomerPo);
router.get('/', authorize(['PO_VIEW']), customerPoController.listCustomerPos);
router.get('/:id', authorize(['PO_VIEW']), customerPoController.getCustomerPo);
router.put('/:id', authorize(['PO_EDIT']), upload.single('poPdf'), customerPoController.updateCustomerPo);
router.delete('/:id', authorize(['PO_DELETE']), customerPoController.deleteCustomerPo);

module.exports = router;
