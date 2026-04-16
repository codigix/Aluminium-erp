const pool = require('../config/db');
const jobCardService = require('../services/jobCardService');

const getPendingQualityQueue = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ql.*, jc.job_card_no as jobId, o.operation_name as operation
      FROM job_card_quality_logs ql
      JOIN job_cards jc ON ql.job_card_id = jc.id
      LEFT JOIN operations o ON jc.operation_id = o.id
      ORDER BY ql.created_at DESC
    `);

    const formattedRows = rows.map(row => ({
      id: row.id,
      jobId: row.jobId,
      date: row.check_date,
      shift: row.shift === 'SHIFT_A' ? 'A' : row.shift === 'SHIFT_B' ? 'B' : 'C',
      operation: row.operation,
      producedQty: row.inspected_qty,
      acceptedQty: row.accepted_qty,
      rejectedQty: row.rejected_qty,
      rejectionReason: row.rejection_reason,
      status: row.status
    }));

    res.json(formattedRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addToQualityQueue = async (req, res) => {
  try {
    const { jcId, jobId, operation, inspectedQty, date, shift, status } = req.body;

    console.log('[DEBUG] addToQualityQueue payload:', { jcId, jobId, operation, inspectedQty, date, shift, status });

    let jobCardId = jcId;

    // 1. Find the job card ID if not provided (fallback to jobId lookup)
    if (!jobCardId) {
      if (!jobId) {
        return res.status(400).json({ message: 'Missing Job Card ID (jcId or jobId)' });
      }
      const [jcRows] = await pool.query('SELECT id FROM job_cards WHERE job_card_no = ?', [jobId]);
      if (jcRows.length === 0) {
        return res.status(404).json({ message: `Job Card not found with number: ${jobId}` });
      }
      jobCardId = jcRows[0].id;
    }

    // 2. Prepare data for addQualityLog
    const data = {
      jobCardId,
      checkDate: date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      shift: shift === 'A' ? 'SHIFT_A' : shift === 'B' ? 'SHIFT_B' : 'SHIFT_C',
      inspectedQty: inspectedQty || 0,
      status: status || 'PENDING',
      acceptedQty: 0,
      rejectedQty: 0,
      scrapQty: 0,
      rejectionReason: null,
      notes: 'Sent from Production'
    };

    console.log('[DEBUG] Calling addQualityLog with:', data);
    const logId = await jobCardService.addQualityLog(data);
    res.status(201).json({ id: logId });
  } catch (error) {
    console.error('[ERROR] addToQualityQueue:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getPendingQualityQueue,
  addToQualityQueue
};
