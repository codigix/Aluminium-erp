class StockEntryModel {
  static getDb() {
    return global.db
  }

  // Get all stock entries
  static async getAll(filters = {}) {
    try {
      const db = this.getDb()
      let query = `
        SELECT 
          se.*,
          fw.warehouse_code as from_warehouse_code,
          fw.warehouse_name as from_warehouse_name,
          tw.warehouse_code as to_warehouse_code,
          tw.warehouse_name as to_warehouse_name,
          u.full_name as created_by_user
        FROM stock_entries se
        LEFT JOIN warehouses fw ON se.from_warehouse_id = fw.id
        LEFT JOIN warehouses tw ON se.to_warehouse_id = tw.id
        LEFT JOIN users u ON se.created_by = u.user_id
        WHERE 1=1
      `
      const params = []

      if (filters.status) {
        query += ' AND se.status = ?'
        params.push(filters.status)
      }

      if (filters.entryType) {
        query += ' AND se.entry_type = ?'
        params.push(filters.entryType)
      }

      if (filters.warehouseId) {
        query += ' AND (se.from_warehouse_id = ? OR se.to_warehouse_id = ?)'
        params.push(filters.warehouseId, filters.warehouseId)
      }

      if (filters.startDate) {
        query += ' AND DATE(se.entry_date) >= ?'
        params.push(filters.startDate)
      }

      if (filters.endDate) {
        query += ' AND DATE(se.entry_date) <= ?'
        params.push(filters.endDate)
      }

      if (filters.search) {
        query += ' AND se.entry_no LIKE ?'
        params.push(`%${filters.search}%`)
      }

      query += ' ORDER BY se.entry_date DESC'

      const [rows] = await db.query(query, params)
      return rows
    } catch (error) {
      throw new Error(`Failed to fetch stock entries: ${error.message}`)
    }
  }

  // Get stock entry by ID
  static async getById(id) {
    try {
      const db = this.getDb()
      const [entryRows] = await db.query(
        `SELECT 
          se.*,
          fw.warehouse_code as from_warehouse_code,
          fw.warehouse_name as from_warehouse_name,
          tw.warehouse_code as to_warehouse_code,
          tw.warehouse_name as to_warehouse_name,
          u.full_name as created_by_user
        FROM stock_entries se
        LEFT JOIN warehouses fw ON se.from_warehouse_id = fw.id
        LEFT JOIN warehouses tw ON se.to_warehouse_id = tw.id
        LEFT JOIN users u ON se.created_by = u.user_id
        WHERE se.id = ?`,
        [id]
      )

      if (!entryRows[0]) return null

      const entry = entryRows[0]

      // Get items
      const [items] = await db.query(
        `SELECT 
          sei.*,
          i.item_code,
          i.name as item_name,
          i.uom
        FROM stock_entry_items sei
        JOIN item i ON sei.item_id = i.id
        WHERE sei.stock_entry_id = ?`,
        [id]
      )

      entry.items = items
      return entry
    } catch (error) {
      throw new Error(`Failed to fetch stock entry: ${error.message}`)
    }
  }

  // Get stock entry by entry number
  static async getByEntryNo(entryNo) {
    try {
      const db = this.getDb()
      const [rows] = await db.query(
        'SELECT * FROM stock_entries WHERE entry_no = ?',
        [entryNo]
      )
      return rows[0] || null
    } catch (error) {
      throw new Error(`Failed to fetch stock entry: ${error.message}`)
    }
  }

  // Create stock entry
  static async create(data) {
    try {
      const db = this.getDb()
      const {
        entry_no,
        entry_date,
        entry_type,
        from_warehouse_id,
        to_warehouse_id,
        purpose,
        reference_doctype,
        reference_name,
        remarks,
        created_by,
        items = []
      } = data

      // Start transaction
      const connection = await db.getConnection()
      await connection.beginTransaction()

      try {
        // Create entry
        const [result] = await connection.query(
          `INSERT INTO stock_entries (
            entry_no, entry_date, entry_type, from_warehouse_id, to_warehouse_id,
            purpose, reference_doctype, reference_name, status, remarks, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?)`,
          [
            entry_no, entry_date, entry_type, from_warehouse_id, to_warehouse_id,
            purpose, reference_doctype, reference_name, remarks, created_by
          ]
        )

        const entryId = result.insertId
        let totalQty = 0
        let totalValue = 0

        // Add items
        for (const item of items) {
          const itemValue = item.qty * (item.valuation_rate || 0)
          totalQty += item.qty
          totalValue += itemValue

          await connection.query(
            `INSERT INTO stock_entry_items (
              stock_entry_id, item_id, qty, uom, valuation_rate, 
              transaction_value, batch_no, serial_no, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              entryId, item.item_id, item.qty, item.uom || 'Kg',
              item.valuation_rate || 0, itemValue, item.batch_no,
              item.serial_no, item.remarks
            ]
          )
        }

        // Update total
        await connection.query(
          'UPDATE stock_entries SET total_qty = ?, total_value = ? WHERE id = ?',
          [totalQty, totalValue, entryId]
        )

        await connection.commit()
        return this.getById(entryId)
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      throw new Error(`Failed to create stock entry: ${error.message}`)
    }
  }

  // Update stock entry
  static async update(id, data) {
    try {
      const db = this.getDb()
      const { purpose, remarks, updated_by } = data

      await db.query(
        `UPDATE stock_entries SET purpose = ?, remarks = ?, updated_by = ? WHERE id = ? AND status = 'Draft'`,
        [purpose, remarks, updated_by, id]
      )

      return this.getById(id)
    } catch (error) {
      throw new Error(`Failed to update stock entry: ${error.message}`)
    }
  }

  // Submit stock entry
  static async submit(id, userId) {
    try {
      const db = this.getDb()
      const connection = await db.getConnection()
      await connection.beginTransaction()

      try {
        // Update status
        await connection.query(
          `UPDATE stock_entries SET status = 'Submitted', submitted_at = NOW(), approved_by = ? WHERE id = ?`,
          [userId, id]
        )

        // Get entry details
        const entry = await this.getById(id)

        // Create stock ledger entries for each item
        for (const item of entry.items) {
          const transactionDate = entry.entry_date
          const qtyIn = ['Purchase Receipt', 'Manufacturing Return', 'Repack'].includes(entry.entry_type) ? item.qty : 0
          const qtyOut = ['Material Issue', 'Transfer', 'Scrap Entry'].includes(entry.entry_type) ? item.qty : 0
          const warehouseId = entry.entry_type === 'Transfer' ? entry.to_warehouse_id : entry.from_warehouse_id

          await connection.query(
            `INSERT INTO stock_ledger (
              item_id, warehouse_id, transaction_date, transaction_type,
              qty_in, qty_out, valuation_rate, reference_doctype, reference_name,
              created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.item_id, warehouseId, transactionDate, entry.entry_type,
              qtyIn, qtyOut, item.valuation_rate, 'Stock Entry', entry.entry_no, userId
            ]
          )
        }

        await connection.commit()
        return this.getById(id)
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } catch (error) {
      throw new Error(`Failed to submit stock entry: ${error.message}`)
    }
  }

  // Cancel stock entry
  static async cancel(id, userId) {
    try {
      const db = this.getDb()
      await db.query(
        `UPDATE stock_entries SET status = 'Cancelled', updated_by = ? WHERE id = ?`,
        [userId, id]
      )
      return this.getById(id)
    } catch (error) {
      throw new Error(`Failed to cancel stock entry: ${error.message}`)
    }
  }

  // Delete stock entry (only if Draft)
  static async delete(id) {
    try {
      const db = this.getDb()
      const entry = await this.getById(id)
      if (entry && entry.status !== 'Draft') {
        throw new Error('Cannot delete submitted or cancelled stock entries')
      }

      await db.query('DELETE FROM stock_entry_items WHERE stock_entry_id = ?', [id])
      const [result] = await db.query('DELETE FROM stock_entries WHERE id = ?', [id])
      return result.affectedRows > 0
    } catch (error) {
      throw new Error(`Failed to delete stock entry: ${error.message}`)
    }
  }

  // Generate next entry number
  static async generateEntryNo(entryType) {
    try {
      const db = this.getDb()
      const prefix = entryType.substring(0, 2).toUpperCase()
      const date = new Date()
      const yearMonth = date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0')
      
      const [result] = await db.query(
        `SELECT MAX(CAST(SUBSTRING(entry_no, -6) AS UNSIGNED)) as max_no 
        FROM stock_entries 
        WHERE entry_no LIKE ?`,
        [`${prefix}-${yearMonth}-%`]
      )

      const nextNo = (result[0].max_no || 0) + 1
      return `${prefix}-${yearMonth}-${String(nextNo).padStart(6, '0')}`
    } catch (error) {
      throw new Error(`Failed to generate entry number: ${error.message}`)
    }
  }
}

export default StockEntryModel
