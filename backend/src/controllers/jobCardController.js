const jobCardService = require('../services/jobCardService');
const schedulingService = require('../services/schedulingService');
const { respondWithError } = require('../config/productionWorkflow');
const { userHasAnyPermission } = require('../middleware/authMiddleware');

// Only QC approvers may approve / reject an inspection
const canApproveQuality = (user) => userHasAnyPermission(user, ['QC_EDIT']);

const listJobCards = async (req, res) => {
  try {
    const jobCards = await jobCardService.listJobCards();
    res.json(jobCards);
  } catch (error) {
    respondWithError(res, error);
  }
};

const createJobCard = async (req, res) => {
  try {
    const id = await jobCardService.createJobCard(req.body);
    const newJC = await jobCardService.getJobCardById(id);
    res.status(201).json(newJC);
  } catch (error) {
    respondWithError(res, error);
  }
};

const updateProgress = async (req, res) => {
  try {
    await jobCardService.updateJobCardProgress(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error);
  }
};

const updateJobCard = async (req, res) => {
  try {
    await jobCardService.updateJobCard(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error);
  }
};

const deleteJobCard = async (req, res) => {
  try {
    await jobCardService.deleteJobCard(req.params.id, req.user?.id || null);
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error);
  }
};

const deleteAllJobCards = async (req, res) => {
  try {
    const result = await jobCardService.deleteAllJobCards(req.user?.id || null);
    res.json({ message: 'All job cards deleted successfully', ...result });
  } catch (error) {
    respondWithError(res, error);
  }
};

const getJobCardLogs = async (req, res) => {
  try {
    const { id } = req.params;
    await jobCardService.syncUnaccountedDowntime(id);
    const [timeLogs, qualityLogs, downtimeLogs] = await Promise.all([
      jobCardService.getTimeLogs(id),
      jobCardService.getQualityLogs(id),
      jobCardService.getDowntimeLogs(id)
    ]);
    res.json({ timeLogs, qualityLogs, downtimeLogs });
  } catch (error) {
    respondWithError(res, error);
  }
};

const addTimeLog = async (req, res) => {
  try {
    const id = await jobCardService.addTimeLog({ ...req.body, jobCardId: req.params.id });
    res.status(201).json({ id });
  } catch (error) {
    respondWithError(res, error);
  }
};

const updateTimeLog = async (req, res) => {
  try {
    await jobCardService.updateTimeLog(req.params.logId, { ...req.body, jobCardId: req.params.id, userId: req.user?.id || null });
    res.json({ message: 'Time log updated' });
  } catch (error) {
    respondWithError(res, error);
  }
};

const addQualityLog = async (req, res) => {
  try {
    const data = { ...req.body, jobCardId: req.params.id, userId: req.user?.id || null, canApprove: await canApproveQuality(req.user) };
    
    if (req.file) {
      data.vendorInvoice = `uploads/${req.file.filename}`;
    }

    if (typeof data.inwardItems === 'string') {
      try {
        data.inwardItems = JSON.parse(data.inwardItems);
      } catch (e) {
        console.error('Error parsing inwardItems:', e);
      }
    }

    const id = await jobCardService.addQualityLog(data);
    res.status(201).json({ id });
  } catch (error) {
    respondWithError(res, error);
  }
};

const updateQualityLog = async (req, res) => {
  try {
    await jobCardService.updateQualityLog(req.params.logId, { ...req.body, jobCardId: req.params.id, userId: req.user?.id || null, canApprove: await canApproveQuality(req.user) });
    res.json({ message: 'Quality log updated' });
  } catch (error) {
    respondWithError(res, error);
  }
};

const addDowntimeLog = async (req, res) => {
  try {
    const id = await jobCardService.addDowntimeLog({ ...req.body, jobCardId: req.params.id });
    res.status(201).json({ id });
  } catch (error) {
    respondWithError(res, error);
  }
};

const deleteTimeLog = async (req, res) => {
  try {
    await jobCardService.deleteTimeLog(req.params.logId, req.user?.id || null);
    res.json({ message: 'Time log deleted' });
  } catch (error) {
    respondWithError(res, error);
  }
};

const deleteQualityLog = async (req, res) => {
  try {
    await jobCardService.deleteQualityLog(req.params.logId, { userId: req.user?.id || null, canApprove: await canApproveQuality(req.user) });
    res.json({ message: 'Quality log deleted' });
  } catch (error) {
    respondWithError(res, error);
  }
};

const deleteDowntimeLog = async (req, res) => {
  try {
    await jobCardService.deleteDowntimeLog(req.params.logId, req.user?.id || null);
    res.json({ message: 'Downtime log deleted' });
  } catch (error) {
    respondWithError(res, error);
  }
};

const getVendorReceipts = async (req, res) => {
  try {
    const receipts = await jobCardService.getVendorReceipts();
    res.json(receipts);
  } catch (error) {
    respondWithError(res, error);
  }
};

const getVendorReceiptItems = async (req, res) => {
  try {
    const { logId } = req.params;
    const items = await jobCardService.getVendorReceiptItems(logId);
    res.json(items);
  } catch (error) {
    respondWithError(res, error);
  }
};

const sendVendorReceiptToPayment = async (req, res) => {
  try {
    const { logId } = req.params;
    await jobCardService.sendVendorReceiptToPayment(logId);
    res.json({ success: true });
  } catch (error) {
    respondWithError(res, error);
  }
};

const getWorkOrderLogs = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const logs = await jobCardService.getWorkOrderLogs(workOrderId);
    res.json(logs);
  } catch (error) {
    respondWithError(res, error);
  }
};

const downloadQualityReport = async (req, res) => {
  try {
    const { logId } = req.params;
    const pdfPath = await jobCardService.downloadJobCardQcPdf(logId);
    res.download(pdfPath);
  } catch (error) {
    respondWithError(res, error);
  }
};

const getJobCardDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const details = await jobCardService.getJobCardDetailAnalysis(id);
    res.json(details);
  } catch (error) {
    respondWithError(res, error);
  }
};

const getActiveAllocations = async (req, res) => {
  try {
    const allocations = await jobCardService.getActiveAllocations();
    res.json(allocations);
  } catch (error) {
    respondWithError(res, error);
  }
};

// Scheduling errors may carry suggested slots / conflicts for the planner
const respondSchedulingError = (res, error) => {
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  res.status(status).json({ error: error.message, ...(error.details || {}) });
};

const getAvailability = async (req, res) => {
  try {
    res.json(await schedulingService.checkAvailability(req.params.id, req.query));
  } catch (error) { respondSchedulingError(res, error); }
};

const scheduleJobCard = async (req, res) => {
  try {
    res.json(await schedulingService.scheduleJobCard(req.params.id, req.body, req.user?.id || null));
  } catch (error) { respondSchedulingError(res, error); }
};

const holdJobCard = async (req, res) => {
  try {
    await schedulingService.holdJobCard(req.params.id, req.body || {}, req.user?.id || null);
    res.json({ success: true });
  } catch (error) { respondSchedulingError(res, error); }
};

const resumeJobCard = async (req, res) => {
  try {
    await schedulingService.resumeJobCard(req.params.id, req.user?.id || null);
    res.json({ success: true });
  } catch (error) { respondSchedulingError(res, error); }
};

const getQuantityAvailability = async (req, res) => {
  try {
    res.json(await jobCardService.getQuantityAvailability(req.params.id));
  } catch (error) { respondSchedulingError(res, error); }
};

const getScheduleBoard = async (req, res) => {
  try {
    res.json(await schedulingService.getScheduleBoard(req.query));
  } catch (error) { respondSchedulingError(res, error); }
};

module.exports = {
  getAvailability,
  getQuantityAvailability,
  scheduleJobCard,
  holdJobCard,
  resumeJobCard,
  getScheduleBoard,
  listJobCards,
  createJobCard,
  updateProgress,
  updateJobCard,
  deleteJobCard,
  deleteAllJobCards,
  getJobCardLogs,
  getWorkOrderLogs,
  addTimeLog,
  updateTimeLog,
  deleteTimeLog,
  addQualityLog,
  updateQualityLog,
  deleteQualityLog,
  addDowntimeLog,
  deleteDowntimeLog,
  getVendorReceipts,
  getVendorReceiptItems,
  sendVendorReceiptToPayment,
  downloadQualityReport,
  getJobCardDetails,
  getActiveAllocations
};
