const express = require('express');
const router = express.Router();
const controller = require('../controllers/companyChangeController');
const { authorize } = require('../middleware/authMiddleware');

// Sales Order issuing-company change requests.
// Submit: Sales (ORDER_EDIT), Procurement RFQ / PO / GRN screens (QUOTATION_EDIT, PURCHASE_ORDER_EDIT, GRN_CREATE, GRN_EDIT)
// and Quality (QC_EDIT). Approve / reject / review queue: Admin only (COMPANY_CHANGE_APPROVE; System Admin bypasses).
const VIEWERS = ['ORDER_VIEW', 'ORDER_EDIT', 'QUOTATION_VIEW', 'PURCHASE_ORDER_VIEW', 'GRN_VIEW', 'QC_VIEW', 'COMPANY_CHANGE_APPROVE'];
const REQUESTERS = ['ORDER_EDIT', 'QUOTATION_EDIT', 'PURCHASE_ORDER_EDIT', 'GRN_CREATE', 'GRN_EDIT', 'QC_EDIT'];
router.get('/pending-count', authorize(['COMPANY_CHANGE_APPROVE']), controller.getPendingCount);
router.get('/source', authorize(VIEWERS), controller.resolveSource);
// Company id per MR / quotation / PO / receipt / GRN for list filters (read-only, any signed-in user)
router.get('/company-map', controller.getCompanyMap);
router.get('/order/:orderId', authorize(VIEWERS), controller.getOrderStatus);
router.get('/', authorize(['COMPANY_CHANGE_APPROVE']), controller.listRequests);
router.post('/', authorize(REQUESTERS), controller.submitRequest);
router.get('/:id', authorize(['COMPANY_CHANGE_APPROVE']), controller.getRequestDetail);
router.post('/:id/approve', authorize(['COMPANY_CHANGE_APPROVE']), controller.approve);
router.post('/:id/reject', authorize(['COMPANY_CHANGE_APPROVE']), controller.reject);
router.post('/:id/seen', authorize(['ORDER_VIEW', 'ORDER_EDIT']), controller.markSeen);

module.exports = router;
