// Accounts → Ledger Statement (Tally "Ledger Vouchers"): read-only
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const service = require('../services/ledgerStatementService');

const VIEW = ['PAYMENT_VIEW', 'PAYMENT_PROCESS'];
const send = (res, e) => res.status(e.status || e.statusCode || 500).json({ message: e.message });

router.use(authenticate);

router.get('/options', authorize(VIEW), async (req, res) => {
  try { res.json(await service.getLedgerOptions()); } catch (e) { send(res, e); }
});

// ?ledgerType=CUSTOMER|SUPPLIER|BANK|CASH|OTHER&ledgerId=&hostCompanyId=&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', authorize(VIEW), async (req, res) => {
  try {
    const { ledgerType, ledgerId, hostCompanyId, from, to } = req.query;
    res.json(await service.getLedgerStatement({ ledgerType, ledgerId, hostCompanyId, from, to }));
  } catch (e) { send(res, e); }
});

router.get('/voucher/:kind/:id', authorize(VIEW), async (req, res) => {
  try { res.json(await service.getVoucher(req.params.kind, req.params.id)); } catch (e) { send(res, e); }
});

module.exports = router;
