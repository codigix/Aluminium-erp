const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const customerPoController = require('../controllers/customerPoController');

const { blockInProduction, authorize } = require('../middleware/authMiddleware');

router.post('/parse', authorize(['PO_CREATE', 'PO_EDIT']), upload.single('poPdf'), customerPoController.parseCustomerPoPdf);
router.post('/', authorize(['PO_CREATE']), upload.any(), customerPoController.createCustomerPo);
router.get('/', authorize(['PO_VIEW']), customerPoController.listCustomerPos);
router.get('/drawings/pending', authorize(['PO_VIEW']), customerPoController.getPendingDrawings);
router.get('/drawings/pending/excel', authorize(['PO_VIEW']), customerPoController.exportPendingDrawingsExcel);
router.get('/drawings/pending/filter-options', authorize(['PO_VIEW']), customerPoController.getPendingFilterOptions);
router.get('/drawings/dispatched', authorize(['PO_VIEW']), customerPoController.getDispatchedDrawings);
router.get('/drawings/dispatched/excel', authorize(['PO_VIEW']), customerPoController.exportDispatchedDrawingsExcel);
router.get('/:id', authorize(['PO_VIEW']), customerPoController.getCustomerPo);
router.get('/:id/pdf', authorize(['PO_VIEW']), customerPoController.generateCustomerPoPdf);
router.post('/:id/send-email', authorize(['PO_VIEW']), customerPoController.sendCustomerPoEmail);
router.put('/:id', authorize(['PO_EDIT']), upload.any(), customerPoController.updateCustomerPo);
router.patch('/:id/upload-pdf', authorize(['PO_EDIT', 'PO_CREATE']), upload.single('poPdf'), customerPoController.uploadCustomerPoPdfOnly);
router.delete('/:id', authorize(['PO_DELETE', 'PO_EDIT']), customerPoController.deleteCustomerPo);

module.exports = router;
