const pool = require('../config/db');

const materialRequestController = {
  getAll: async (req, res) => {
    try {
      const [rows] = await pool.query(`
        SELECT mr.*, CONCAT(u.first_name, ' ', u.last_name) as requester_name,
        (
          SELECT CASE 
            WHEN COUNT(*) = SUM(CASE WHEN COALESCE(sb.current_balance, 0) >= mri.quantity THEN 1 ELSE 0 END) THEN 'available'
            ELSE 'unavailable'
          END
          FROM material_request_items mri
          LEFT JOIN stock_balance sb ON mri.item_code = sb.item_code 
            AND sb.warehouse = COALESCE(mr.source_warehouse, 'Consumables Store')
          WHERE mri.mr_id = mr.id
        ) as availability
        FROM material_requests mr
        LEFT JOIN users u ON mr.requested_by = u.id
        ORDER BY mr.created_at DESC
      `);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const { warehouse } = req.query;
      const [requests] = await pool.query(`
        SELECT mr.*, CONCAT(u.first_name, ' ', u.last_name) as requester_name 
        FROM material_requests mr
        LEFT JOIN users u ON mr.requested_by = u.id
        WHERE mr.id = ?
      `, [id]);

      if (requests.length === 0) {
        return res.status(404).json({ message: 'Material Request not found' });
      }

      const [items] = await pool.query(`
        SELECT mri.*, 
               COALESCE(sb.material_name, sb.item_description, mri.item_code) as name, 
               COALESCE(mri.uom, sb.unit) as uom
        FROM material_request_items mri
        LEFT JOIN (
          SELECT item_code, material_name, item_description, unit 
          FROM stock_balance 
          GROUP BY item_code
        ) sb ON mri.item_code = sb.item_code
        WHERE mri.mr_id = ?
      `, [id]);

      // Fetch stock info for each item
      for (let item of items) {
        let stockQuery = `
          SELECT warehouse as warehouse_name, current_balance as current_stock
          FROM stock_balance
          WHERE item_code = ?
        `;
        let params = [item.item_code];

        if (warehouse) {
          stockQuery += ` AND warehouse = ? `;
          params.push(warehouse);
        }

        const [stock] = await pool.query(stockQuery, params);
        item.stocks = stock;
      }

      const request = requests[0];
      request.items = items;

      res.json(request);
    } catch (error) {
      console.error('Error in getById:', error);
      res.status(500).json({ message: error.message });
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      await pool.query('UPDATE material_requests SET status = ? WHERE id = ?', [status, id]);
      res.json({ message: `Material Request status updated to ${status}` });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  create: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { department, requested_by, required_by, purpose, notes, items, target_warehouse, source_warehouse } = req.body;

      // Handle optional fields
      const requesterId = requested_by && requested_by !== '' ? requested_by : null;
      const requiredByDate = required_by && required_by !== '' ? required_by : null;
      const targetWh = target_warehouse && target_warehouse !== '' ? target_warehouse : null;
      const sourceWh = source_warehouse && source_warehouse !== '' ? source_warehouse : null;

      // Generate MR Number: MR-YYYYMMDD-XXX
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const [lastMr] = await connection.query(
        'SELECT mr_number FROM material_requests WHERE mr_number LIKE ? ORDER BY id DESC LIMIT 1',
        [`MR-${dateStr}-%`]
      );

      let nextNum = 1;
      if (lastMr && lastMr.length > 0) {
        const lastMrNum = lastMr[0].mr_number;
        const parts = lastMrNum.split('-');
        const lastSeq = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSeq)) {
          nextNum = lastSeq + 1;
        }
      }
      const mrNumber = `MR-${dateStr}-${nextNum.toString().padStart(3, '0')}`;

      const [result] = await connection.query(
        'INSERT INTO material_requests (mr_number, department, requested_by, required_by, purpose, notes, status, target_warehouse, source_warehouse) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [mrNumber, department, requesterId, requiredByDate, purpose, notes, 'Draft', targetWh, sourceWh]
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
      console.error('Error creating material request:', error);
      res.status(500).json({ message: error.message });
    } finally {
      connection.release();
    }
  }
};

module.exports = materialRequestController;
