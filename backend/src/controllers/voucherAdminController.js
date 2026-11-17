const voucherAdminService = require('../services/voucherAdminService');

const currentUser = (req) => ({
  id: req.user?.id || null,
  name: req.user?.username || req.user?.email || null
});

const previewCancel = async (req, res, next) => {
  try {
    res.json(await voucherAdminService.previewCancel(req.params.kind, req.params.id));
  } catch (error) {
    next(error);
  }
};

const cancelVoucher = async (req, res, next) => {
  try {
    const result = await voucherAdminService.cancelVoucher(req.params.kind, req.params.id, req.body?.reason, currentUser(req));
    res.json({ message: `${result.label} ${result.voucherNo || ''} cancelled`.replace(/\s+/g, ' ').trim(), data: result });
  } catch (error) {
    next(error);
  }
};

const updateVoucher = async (req, res, next) => {
  try {
    const result = await voucherAdminService.updateVoucher(req.params.kind, req.params.id, req.body, currentUser(req));
    res.json({ message: `Voucher ${result.voucherNo || ''} updated`.replace(/\s+/g, ' ').trim(), data: result });
  } catch (error) {
    next(error);
  }
};

const getEditData = async (req, res, next) => {
  try {
    res.json(await voucherAdminService.getEditData(req.params.kind, req.params.id));
  } catch (error) {
    next(error);
  }
};

const replaceVoucher = async (req, res, next) => {
  try {
    const result = await voucherAdminService.replaceVoucher(req.params.kind, req.params.id, req.body, currentUser(req));
    res.json({ message: `${result.label} ${result.voucherNo} updated`, data: result });
  } catch (error) {
    next(error);
  }
};

const getAuditTrail = async (req, res, next) => {
  try {
    res.json(await voucherAdminService.getAuditTrail(req.params.kind, req.params.id));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  previewCancel,
  cancelVoucher,
  updateVoucher,
  getEditData,
  replaceVoucher,
  getAuditTrail
};
