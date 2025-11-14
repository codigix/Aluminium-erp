import { v4 as uuidv4 } from 'uuid'

export class ItemModel {
  constructor(db) {
    this.db = db
  }

  async create(data) {
    try {
      const item_code = data.item_code || `ITEM-${Date.now()}`

      await this.db.execute(
        `INSERT INTO item (item_code, name, item_group, description, uom, hsn_code, gst_rate, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item_code,
          data.name,
          data.item_group,
          data.description,
          data.uom || 'PCS',
          data.hsn_code,
          data.gst_rate || 0,
          data.is_active !== false
        ]
      )

      return { item_code, status: 'created' }
    } catch (error) {
      throw new Error(`Failed to create item: ${error.message}`)
    }
  }

  async getById(item_code) {
    try {
      const [items] = await this.db.execute(
        `SELECT * FROM item WHERE item_code = ?`,
        [item_code]
      )

      if (items.length === 0) return null

      // Get stock information
      const [stock] = await this.db.execute(
        `SELECT warehouse_code, qty_on_hand, qty_available FROM stock WHERE item_code = ?`,
        [item_code]
      )

      return { ...items[0], stock }
    } catch (error) {
      throw new Error(`Failed to fetch item: ${error.message}`)
    }
  }

  async getAll(filters = {}) {
    try {
      let query = `SELECT * FROM item WHERE is_active = 1`
      const params = []

      if (filters.item_group) {
        query += ` AND item_group = ?`
        params.push(filters.item_group)
      }

      if (filters.search) {
        query += ` AND (name LIKE ? OR item_code LIKE ?)`
        const searchTerm = `%${filters.search}%`
        params.push(searchTerm, searchTerm)
      }

      const limit = filters.limit || 100
      const offset = filters.offset || 0
      query += ` ORDER BY name LIMIT ${limit} OFFSET ${offset}`

      const [items] = await this.db.execute(query, params)
      return items
    } catch (error) {
      throw new Error(`Failed to fetch items: ${error.message}`)
    }
  }

  async getItemGroups() {
    try {
      const [groups] = await this.db.execute(
        `SELECT DISTINCT item_group FROM item WHERE is_active = 1 ORDER BY item_group`
      )
      return groups.map(g => g.item_group)
    } catch (error) {
      throw new Error(`Failed to fetch item groups: ${error.message}`)
    }
  }

  async update(item_code, data) {
    try {
      const updateFields = []
      const params = []

      const allowedFields = ['name', 'item_group', 'description', 'uom', 'hsn_code', 'gst_rate', 'is_active']

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updateFields.push(`${field} = ?`)
          params.push(data[field])
        }
      }

      if (updateFields.length === 0) return { success: true }

      params.push(item_code)
      const query = `UPDATE item SET ${updateFields.join(', ')}, updated_at = NOW() WHERE item_code = ?`

      const [result] = await this.db.execute(query, params)
      return { affectedRows: result.affectedRows }
    } catch (error) {
      throw new Error(`Failed to update item: ${error.message}`)
    }
  }

  async getStockInfo(item_code) {
    try {
      const [stock] = await this.db.execute(
        `SELECT warehouse_code, qty_on_hand, qty_available, qty_reserved FROM stock WHERE item_code = ?`,
        [item_code]
      )
      return stock
    } catch (error) {
      throw new Error(`Failed to fetch stock info: ${error.message}`)
    }
  }

  async getTotalStock(item_code) {
    try {
      const [result] = await this.db.execute(
        `SELECT 
          SUM(qty_on_hand) as total_qty,
          SUM(qty_available) as available_qty,
          SUM(qty_reserved) as reserved_qty
         FROM stock WHERE item_code = ?`,
        [item_code]
      )
      return result[0] || { total_qty: 0, available_qty: 0, reserved_qty: 0 }
    } catch (error) {
      throw new Error(`Failed to calculate total stock: ${error.message}`)
    }
  }

  async delete(item_code) {
    try {
      // Only soft delete by marking as inactive
      await this.db.execute(
        `UPDATE item SET is_active = 0, updated_at = NOW() WHERE item_code = ?`,
        [item_code]
      )
      return { success: true }
    } catch (error) {
      throw new Error(`Failed to delete item: ${error.message}`)
    }
  }
}