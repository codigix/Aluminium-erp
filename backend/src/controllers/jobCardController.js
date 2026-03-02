const jobCardService = require('../services/jobCardService');

const listJobCards = async (req, res) => {
  try {
    const jobCards = await jobCardService.listJobCards();
    res.json(jobCards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createJobCard = async (req, res) => {
  try {
    const id = await jobCardService.createJobCard(req.body);
    const newJC = await jobCardService.getJobCardById(id);
    res.status(201).json(newJC);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProgress = async (req, res) => {
  try {
    await jobCardService.updateJobCardProgress(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateJobCard = async (req, res) => {
  try {
    await jobCardService.updateJobCard(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteJobCard = async (req, res) => {
  try {
    await jobCardService.deleteJobCard(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getJobCardLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const [timeLogs, qualityLogs, downtimeLogs] = await Promise.all([
      jobCardService.getTimeLogs(id),
      jobCardService.getQualityLogs(id),
      jobCardService.getDowntimeLogs(id)
    ]);
    res.json({ timeLogs, qualityLogs, downtimeLogs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addTimeLog = async (req, res) => {
  try {
    const id = await jobCardService.addTimeLog({ ...req.body, jobCardId: req.params.id });
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateTimeLog = async (req, res) => {
  try {
    await jobCardService.updateTimeLog(req.params.logId, { ...req.body, jobCardId: req.params.id });
    res.json({ message: 'Time log updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addQualityLog = async (req, res) => {
  try {
    const id = await jobCardService.addQualityLog({ ...req.body, jobCardId: req.params.id });
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateQualityLog = async (req, res) => {
  try {
    await jobCardService.updateQualityLog(req.params.logId, { ...req.body, jobCardId: req.params.id });
    res.json({ message: 'Quality log updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addDowntimeLog = async (req, res) => {
  try {
    const id = await jobCardService.addDowntimeLog({ ...req.body, jobCardId: req.params.id });
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteTimeLog = async (req, res) => {
  try {
    await jobCardService.deleteTimeLog(req.params.logId);
    res.json({ message: 'Time log deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteQualityLog = async (req, res) => {
  try {
    await jobCardService.deleteQualityLog(req.params.logId);
    res.json({ message: 'Quality log deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteDowntimeLog = async (req, res) => {
  try {
    await jobCardService.deleteDowntimeLog(req.params.logId);
    res.json({ message: 'Downtime log deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listJobCards,
  createJobCard,
  updateProgress,
  updateJobCard,
  deleteJobCard,
  getJobCardLogs,
  addTimeLog,
  updateTimeLog,
  deleteTimeLog,
  addQualityLog,
  updateQualityLog,
  deleteQualityLog,
  addDowntimeLog,
  deleteDowntimeLog
};
