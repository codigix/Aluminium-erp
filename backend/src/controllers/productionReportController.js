const reportService = require('../services/productionReportService');
const { respondWithError } = require('../config/productionWorkflow');

// Table-shaped part of each report, used for ?format=csv
const TABLE_KEY = {
  planVsActual: 'rows',
  jobCards: 'rows',
  utilisation: 'machines',
  quality: 'byOperation',
  materials: 'items',
  shipments: 'rows',
  delayed: 'workOrders'
};

const handler = (name, serviceFn) => async (req, res) => {
  try {
    const data = await serviceFn(req.query);
    if (req.query.format === 'csv' && TABLE_KEY[name]) {
      const csv = reportService.toCsv(data[TABLE_KEY[name]] || []);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="production-${name}.csv"`);
      return res.send(csv);
    }
    res.json(data);
  } catch (error) {
    respondWithError(res, error);
  }
};

module.exports = {
  summary: handler('summary', reportService.getSummary),
  planVsActual: handler('planVsActual', reportService.getPlanVsActual),
  jobCards: handler('jobCards', reportService.getJobCardStatus),
  utilisation: handler('utilisation', reportService.getUtilisation),
  quality: handler('quality', reportService.getQualityRework),
  materials: handler('materials', reportService.getMaterialVariance),
  shipments: handler('shipments', reportService.getShipmentStatus),
  delayed: handler('delayed', reportService.getDelayed),
  workspace: handler('workspace', reportService.getWorkspace)
};
