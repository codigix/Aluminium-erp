const companyChangeService = require('../services/companyChangeService');

const wrap = (fn) => async (req, res, next) => {
  try {
    res.json(await fn(req));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Sales
  submitRequest: wrap(async (req) => {
    const data = await companyChangeService.submitRequest({
      orderId: req.body.orderId || req.body.order_id,
      requestedCompanyId: req.body.requestedCompanyId || req.body.requested_company_id,
      reason: req.body.reason
    }, req.user.id);
    return { message: 'Company change request sent for Admin approval', data };
  }),
  getOrderStatus: wrap((req) => companyChangeService.getOrderCompanyStatus(req.params.orderId, req.user.id)),
  resolveSource: wrap((req) => companyChangeService.resolveSource({
    mrId: req.query.mrId, poId: req.query.poId, receiptId: req.query.receiptId, grnId: req.query.grnId
  }, req.user.id)),
  markSeen: wrap((req) => companyChangeService.markDecisionSeen(req.params.id, req.user.id)),

  // Admin
  listRequests: wrap((req) => companyChangeService.listRequests({ status: req.query.status, search: req.query.search })),
  getRequestDetail: wrap((req) => companyChangeService.getRequestDetail(req.params.id)),
  getPendingCount: wrap(() => companyChangeService.getPendingCount()),
  approve: wrap(async (req) => {
    const data = await companyChangeService.approveRequest(req.params.id, req.user.id, req.body?.remarks || null);
    return { message: 'Company change approved', data };
  }),
  reject: wrap(async (req) => {
    const data = await companyChangeService.rejectRequest(req.params.id, req.user.id, req.body?.remarks);
    return { message: 'Company change rejected', data };
  })
};
