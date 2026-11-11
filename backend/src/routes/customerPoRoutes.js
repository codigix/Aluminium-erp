const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const customerPoController = require('../controllers/customerPoController');

const { blockInProduction, authorize } = require('../middleware/authMiddleware');

router.post('/parse', authorize(['PO_CREATE', 'PO_EDIT']), upload.any(), customerPoController.parseCustomerPoPdf);
router.post('/parse-pdf', authorize(['PO_CREATE', 'PO_EDIT']), upload.any(), customerPoController.parseCustomerPoPdf);
router.post('/bulk-drawing-details', authorize(['PO_CREATE', 'PO_EDIT', 'PO_VIEW']), customerPoController.getBulkDrawingDetails);
router.post('/', authorize(['PO_CREATE']), upload.any(), customerPoController.createCustomerPo);
router.get('/', authorize(['PO_VIEW']), customerPoController.listCustomerPos);
router.get('/drawings/pending', authorize(['PO_VIEW']), customerPoController.getPendingDrawings);
router.get('/drawings/pending/excel', authorize(['PO_VIEW']), customerPoController.exportPendingDrawingsExcel);
router.get('/drawings/pending/filter-options', authorize(['PO_VIEW']), customerPoController.getPendingFilterOptions);
router.get('/drawings/dispatched', authorize(['PO_VIEW']), customerPoController.getDispatchedDrawings);
router.get('/drawings/dispatched/excel', authorize(['PO_VIEW']), customerPoController.exportDispatchedDrawingsExcel);
// Item Master (stock_balance) entries that carry a Drawing No (e.g. BOUGHT_OUT items) — used by the Drawing No column lookup
router.get('/drawings/item-master', authorize(['PO_CREATE', 'PO_EDIT', 'PO_VIEW']), async (req, res, next) => {
  try {
    const pool = require('../config/db');
    const [rows] = await pool.query(
      `SELECT TRIM(drawing_no) AS drawing_no,
              MAX(item_code) AS item_code,
              MAX(COALESCE(NULLIF(item_description, ''), material_name)) AS drawing_description,
              MAX(material_type) AS material_type,
              MAX(hsn_code) AS hsn_code,
              MAX(unit) AS unit,
              MAX(valuation_rate) AS valuation_rate,
              MAX(drawing_id) AS drawing_id
       FROM stock_balance
       WHERE drawing_no IS NOT NULL AND TRIM(drawing_no) NOT IN ('', '—', '-')
       GROUP BY TRIM(drawing_no)`
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});
router.get('/:id', authorize(['PO_VIEW']), customerPoController.getCustomerPo);
router.get('/:id/pdf', authorize(['PO_VIEW']), customerPoController.generateCustomerPoPdf);
router.post('/:id/send-email', authorize(['PO_VIEW']), customerPoController.sendCustomerPoEmail);
router.put('/:id', authorize(['PO_EDIT']), upload.any(), customerPoController.updateCustomerPo);
router.patch('/:id/upload-pdf', authorize(['PO_EDIT', 'PO_CREATE']), upload.single('poPdf'), customerPoController.uploadCustomerPoPdfOnly);
router.delete('/:id', authorize(['PO_DELETE', 'PO_EDIT']), customerPoController.deleteCustomerPo);

module.exports = router;
