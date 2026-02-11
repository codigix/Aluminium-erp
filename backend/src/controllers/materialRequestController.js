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
            AND sb.warehouse = COALESCE(mri.warehouse, mr.source_warehouse, 'Consumables Store')
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

      const request = requests[0];

      const [items] = await pool.query(`
        SELECT mri.*, 
               COALESCE(mri.item_name, sb.material_name, sb.item_description, mri.item_code) as name, 
               COALESCE(mri.uom, sb.unit) as uom,
               COALESCE(mri.item_type, sb.material_type) as material_type
        FROM material_request_items mri
        LEFT JOIN (
          SELECT item_code, 
                 MAX(material_name) as material_name, 
                 MAX(item_description) as item_description, 
                 MAX(unit) as unit,
                 MAX(material_type) as material_type
          FROM stock_balance 
          GROUP BY item_code
        ) sb ON mri.item_code = sb.item_code
        WHERE mri.mr_id = ?
      `, [id]);

      // Fetch stock info for each item
      const selectedWh = warehouse || request.source_warehouse;
      
      let allItemsAvailable = true;

      for (let item of items) {
        let stockQuery = `
          SELECT warehouse as warehouse_name, current_balance as current_stock
          FROM stock_balance
          WHERE item_code = ?
        `;
        let params = [item.item_code];

        // Use item-specific warehouse if available, fallback to header warehouse
        const itemWh = item.warehouse || selectedWh;

        if (itemWh) {
          stockQuery += ` AND (warehouse = ? OR (warehouse IS NULL AND ? IS NULL)) `;
          params.push(itemWh, itemWh);
        }

        const [stockRows] = await pool.query(stockQuery, params);
        item.stocks = stockRows;
        
        // Also provide a direct stock level for the selected warehouse
        const matchingWh = stockRows.find(s => s.warehouse_name === itemWh);
        const availableQty = matchingWh ? parseFloat(matchingWh.current_stock) : 0;
        
        item.current_stock = availableQty;
        item.fulfillment_source = availableQty >= parseFloat(item.quantity) ? 'STOCK' : 'PURCHASE';
        
        if (item.fulfillment_source === 'PURCHASE') {
          allItemsAvailable = false;
        }
      }

      request.items = items;
      request.all_items_available = allItemsAvailable;
      request.suggested_fulfillment_mode = allItemsAvailable ? 'STOCK' : 'PURCHASE';

      res.json(request);
    } catch (error) {
      console.error('Error in getById:', error);
      res.status(500).json({ message: error.message });
    }
  },

  updateWarehouse: async (req, res) => {
    try {
      const { id } = req.params;
      const { source_warehouse, target_warehouse } = req.body;
      
      const updates = [];
      const params = [];
      
      if (source_warehouse !== undefined) {
        updates.push('source_warehouse = ?');
        params.push(source_warehouse);
      }
      
      if (target_warehouse !== undefined) {
        updates.push('target_warehouse = ?');
        params.push(target_warehouse);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ message: 'No warehouse provided' });
      }
      
      params.push(id);
      await pool.query(`UPDATE material_requests SET ${updates.join(', ')} WHERE id = ?`, params);
      
      res.json({ message: 'Warehouses updated successfully' });
    } catch (error) {
      console.error('Error in updateWarehouse:', error);
      res.status(500).json({ message: error.message });
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const normalizedStatus = status.toUpperCase();
      await pool.query('UPDATE material_requests SET status = ? WHERE id = ?', [normalizedStatus, id]);
      res.json({ message: `Material Request status updated to ${normalizedStatus}` });
    } catch (error) {
      console.error('Error in updateStatus:', error);
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
        [mrNumber, department, requesterId, requiredByDate, purpose, notes, 'DRAFT', targetWh, sourceWh]
      );

      const mrId = result.insertId;

      if (items && items.length > 0) {
        const itemValues = items.map(item => [
          mrId,
          item.item_code,
          item.item_name || null,
          item.item_type || null,
          item.quantity,
          item.unit_rate || 0,
          item.uom || 'pcs',
          item.warehouse || null
        ]);

        await connection.query(
          'INSERT INTO material_request_items (mr_id, item_code, item_name, item_type, quantity, unit_rate, uom, warehouse) VALUES ?',
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
  },

  delete: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const { id } = req.params;

      // Delete items first
      await connection.query('DELETE FROM material_request_items WHERE mr_id = ?', [id]);
      
      // Delete request
      const [result] = await connection.query('DELETE FROM material_requests WHERE id = ?', [id]);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Material Request not found' });
      }

      await connection.commit();
      res.json({ message: 'Material Request deleted successfully' });
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting material request:', error);
      res.status(500).json({ message: error.message });
    } finally {
      connection.release();
    }
  }
};

module.exports = materialRequestController;
