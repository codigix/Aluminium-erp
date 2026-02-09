const pool = require('../config/db');

const materialRequestController = {
  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT mr.*, u.name as requester_name 
        FROM material_requests mr
        LEFT JOIN users u ON mr.requested_by = u.id
        ORDER BY mr.created_at DESC
      `);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  create: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { department, requested_by, required_by, purpose, notes, items } = req.body;

      // Generate MR Number
      const [lastMr] = await connection.query('SELECT mr_number FROM material_requests ORDER BY id DESC LIMIT 1');
      let mrNumber = 'MR-MR-1770615584750'; // Starting with a similar format as requested
      if (lastMr.length > 0) {
        const lastNum = parseInt(lastMr[0].mr_number.split('-').pop());
        mrNumber = `MR-MR-${lastNum + 1}`;
      } else {
        // Fallback or initial number
        mrNumber = `MR-MR-${Date.now()}`;
      }

      const [result] = await connection.query(
        'INSERT INTO material_requests (mr_number, department, requested_by, required_by, purpose, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [mrNumber, department, requested_by, required_by, purpose, notes, 'Draft']
      );

      const mrId = result.insertId;

      if (items && items.length > 0) {
        const itemValues = items.map(item => [
          mrId,
          item.item_code,
          item.quantity,
          item.uom || 'pcs'
        ]);

        await connection.query(
          'INSERT INTO material_request_items (mr_id, item_code, quantity, uom) VALUES ?',
          [itemValues]
        );
      }

      await connection.commit();
      res.status(201).json({ message: 'Material Request created successfully', id: mrId, mr_number: mrNumber });
    } catch (error) {
      await connection.rollback();
      res.status(500).json({ message: error.message });
    } finally {
      connection.release();
    }
  }
};

module.exports = materialRequestController;
