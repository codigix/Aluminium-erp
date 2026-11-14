// Purchase Returns (Procurement): QC-rejected GRN material back to the supplier
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const service = require('../services/purchaseReturnService');

// View: Procurement and Quality (QC rejects feed this page); create / edit / dispatch / cancel: Procurement only
const VIEW = ['PURCHASE_ORDER_VIEW', 'QC_VIEW'];

const send = (res, error) => res.status(error.statusCode || 500).json({ message: error.message });

router.use(authenticate);

// Rejected QC lines still to be returned
router.get('/pending', authorize(VIEW), async (req, res) => {
  try {
    res.json(await service.getPendingReturns({ vendorId: req.query.vendorId, poId: req.query.poId }));
  } catch (e) { send(res, e); }
});

// Accounts → Debit Note → "Pending Debit Notes" (Debit Note returns sent to Accounts, no debit note yet)
router.get('/accounts/pending-debit-notes', authorize(['PAYMENT_VIEW', 'PAYMENT_PROCESS']), async (req, res) => {
  try {
    res.json(await service.getPendingDebitNotes());
  } catch (e) { send(res, e); }
});

router.get('/', authorize(VIEW), async (req, res) => {
  try {
    res.json(await service.listReturns());
  } catch (e) { send(res, e); }
});

router.get('/:id/pdf', authorize(VIEW), async (req, res) => {
  try {
    const pr = await service.getReturnById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'Purchase Return not found' });
    const generate = require('../utils/generateReturnChallanPdf');
    const { pdfPath, fileName } = await generate(pr);
    if (req.query.inline === '1') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.sendFile(pdfPath);
    }
    res.download(pdfPath, fileName, (err) => { if (err) console.error('Return challan download error:', err); });
  } catch (e) {
    console.error('Return challan PDF error:', e);
    send(res, e);
  }
});

router.get('/:id', authorize(VIEW), async (req, res) => {
  try {
    const pr = await service.getReturnById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'Purchase Return not found' });
    res.json(pr);
  } catch (e) { send(res, e); }
});

router.post('/', authorize(['PURCHASE_ORDER_EDIT']), async (req, res) => {
  try {
    res.status(201).json(await service.createReturn(req.body || {}, req.user?.id || null));
  } catch (e) { send(res, e); }
});

router.put('/:id', authorize(['PURCHASE_ORDER_EDIT']), async (req, res) => {
  try {
    res.json(await service.updateReturn(req.params.id, req.body || {}));
  } catch (e) { send(res, e); }
});

router.post('/:id/dispatch', authorize(['PURCHASE_ORDER_EDIT']), async (req, res) => {
  try {
    res.json(await service.dispatchReturn(req.params.id, req.body || {}, req.user?.id || null));
  } catch (e) { send(res, e); }
});

router.post('/:id/send-to-accounts', authorize(['PURCHASE_ORDER_EDIT']), async (req, res) => {
  try {
    res.json(await service.sendToAccounts(req.params.id, req.body || {}, req.user?.id || null));
  } catch (e) { send(res, e); }
});

router.post('/:id/cancel',authorize(['PURCHASE_ORDER_EDIT']), async (req, res) => {
  try {
    res.json(await service.cancelReturn(req.params.id));
  } catch (e) { send(res, e); }
});

module.exports = router;
