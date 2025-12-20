class SalesOrderModel {
  constructor(db) {
    this.db = db
  }

  async initializeSchema() {
    try {
      const statements = [
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS bom_id VARCHAR(50)`,
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1`,
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS source_warehouse VARCHAR(100)`,
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'Sales'`,
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)`,
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS customer_email VARCHAR(100)`,
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20)`,
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS series VARCHAR(50)`,
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS cost_center VARCHAR(100)`,
        `ALTER TABLE selling_sales_order ADD COLUMN IF NOT EXISTS project VARCHAR(100)`
      ]

      for (const statement of statements) {
        try {
          await this.db.execute(statement)
        } catch (err) {
          if (!err.message.includes('Duplicate')) {
            console.log('Schema update result:', err.message)
          }
        }
      }
    } catch (error) {
      console.log('Schema initialization status:', error.message)
    }
  }

  async createSalesOrder(data) {
    try {
      const sales_order_id = `SO-${Date.now()}`
      const series = data.series || 'SO'
      const date = data.date || new Date().toISOString().split('T')[0]
      
      await this.db.execute(
        `INSERT INTO selling_sales_order 
         (sales_order_id, customer_id, order_amount, delivery_date, status, created_by, bom_id, 
          quantity, source_warehouse, order_type, customer_name, customer_email, customer_phone, series, cost_center, project)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sales_order_id,
          data.customer_id || '',
          data.order_amount || 0,
          data.delivery_date || null,
          data.status || 'draft',
          data.created_by || null,
          data.bom_id || null,
          data.quantity || 1,
          data.source_warehouse || null,
          data.order_type || 'Sales',
          data.customer_name || '',
          data.customer_email || '',
          data.customer_phone || '',
          series,
          data.cost_center || null,
          data.project || null
        ]
      )

      return { sales_order_id, ...data }
    } catch (error) {
      throw error
    }
  }

  async getSalesOrders(filters = {}) {
    try {
      let query = 'SELECT * FROM selling_sales_order WHERE deleted_at IS NULL'
      const params = []

      if (filters.status) {
        query += ' AND status = ?'
        params.push(filters.status)
      }

      if (filters.customer_id) {
        query += ' AND customer_id = ?'
        params.push(filters.customer_id)
      }

      if (filters.bom_id) {
        query += ' AND bom_id = ?'
        params.push(filters.bom_id)
      }

      query += ' ORDER BY created_at DESC'

      const [orders] = await this.db.execute(query, params)
      return orders
    } catch (error) {
      throw error
    }
  }

  async getSalesOrderById(id) {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM selling_sales_order WHERE sales_order_id = ? AND deleted_at IS NULL',
        [id]
      )
      
      if (!rows || rows.length === 0) {
        return null
      }

      const order = rows[0]

      const [items] = await this.db.execute(
        'SELECT * FROM sales_order_items WHERE sales_order_id = ? ORDER BY id ASC',
        [id]
      )

      order.items = items || []

      if (order.bom_id) {
        const [bom] = await this.db.execute(
          'SELECT * FROM bom WHERE bom_id = ?',
          [order.bom_id]
        )
        if (bom && bom.length > 0) {
          order.bom_details = bom[0]
          
          const [bomLines] = await this.db.execute(
            'SELECT * FROM bom_line WHERE bom_id = ? ORDER BY idx ASC',
            [order.bom_id]
          )
          order.bom_details.materials = bomLines || []
        }
      }

      return order
    } catch (error) {
      throw error
    }
  }

  async updateSalesOrder(id, data) {
    try {
      const fields = []
      const values = []

      const updateableFields = [
        'customer_id', 'order_amount', 'delivery_date', 'status',
        'bom_id', 'quantity', 'source_warehouse', 'order_type',
        'customer_name', 'customer_email', 'customer_phone',
        'cost_center', 'project', 'order_terms'
      ]

      for (const field of updateableFields) {
        if (data[field] !== undefined) {
          fields.push(`${field} = ?`)
          values.push(data[field])
        }
      }

      if (fields.length === 0) return false

      fields.push('updated_at = NOW()')
      values.push(id)

      const query = `UPDATE selling_sales_order SET ${fields.join(', ')} WHERE sales_order_id = ?`
      const result = await this.db.execute(query, values)

      return result[0].affectedRows > 0
    } catch (error) {
      throw error
    }
  }

  async deleteSalesOrder(id) {
    try {
      await this.db.execute(
        'UPDATE selling_sales_order SET deleted_at = NOW() WHERE sales_order_id = ?',
        [id]
      )
      return true
    } catch (error) {
      throw error
    }
  }

  async getBOMForSalesOrder(bom_id) {
    try {
      const [bom] = await this.db.execute(
        'SELECT * FROM bom WHERE bom_id = ?',
        [bom_id]
      )

      if (!bom || bom.length === 0) {
        return null
      }

      const bomData = bom[0]

      const [lines] = await this.db.execute(
        'SELECT * FROM bom_line WHERE bom_id = ? ORDER BY idx ASC',
        [bom_id]
      )

      const [scrap] = await this.db.execute(
        'SELECT * FROM bom_scrap WHERE bom_id = ? ORDER BY idx ASC',
        [bom_id]
      )

      const [operations] = await this.db.execute(
        'SELECT * FROM bom_operation WHERE bom_id = ? ORDER BY idx ASC',
        [bom_id]
      )

      bomData.materials = lines || []
      bomData.scrap_items = scrap || []
      bomData.operations = operations || []

      return bomData
    } catch (error) {
      throw error
    }
  }

  async getBOMsForCustomer(customer_id) {
    try {
      const [boms] = await this.db.execute(
        `SELECT DISTINCT bom.* FROM bom 
         LEFT JOIN bom_line ON bom.bom_id = bom_line.bom_id
         WHERE bom.status = 'active' OR bom.status = 'draft'
         ORDER BY bom.created_at DESC`
      )
      return boms || []
    } catch (error) {
      throw error
    }
  }

  async getSalesOrderAnalytics(startDate = null, endDate = null) {
    try {
      let query = `SELECT 
        COUNT(*) as total_orders,
        SUM(order_amount) as total_sales,
        AVG(order_amount) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers,
        status,
        DATE(created_at) as order_date
      FROM selling_sales_order
      WHERE deleted_at IS NULL`

      const params = []

      if (startDate) {
        query += ' AND created_at >= ?'
        params.push(startDate)
      }

      if (endDate) {
        query += ' AND created_at <= ?'
        params.push(endDate)
      }

      query += ' GROUP BY status, DATE(created_at) ORDER BY order_date DESC'

      const [analytics] = await this.db.execute(query, params)
      return analytics
    } catch (error) {
      throw error
    }
  }

  async getSalesOrdersByBOM(bomId) {
    try {
      const [orders] = await this.db.execute(
        `SELECT * FROM selling_sales_order 
         WHERE bom_id = ? AND deleted_at IS NULL 
         ORDER BY created_at DESC`,
        [bomId]
      )
      return orders || []
    } catch (error) {
      throw error
    }
  }

  async confirmSalesOrder(id) {
    try {
      await this.db.execute(
        'UPDATE selling_sales_order SET status = ?, confirmed_at = NOW() WHERE sales_order_id = ?',
        ['confirmed', id]
      )
      return true
    } catch (error) {
      throw error
    }
  }

  async addItemToOrder(salesOrderId, itemData) {
    try {
      await this.db.execute(
        `INSERT INTO sales_order_items 
         (sales_order_id, item_code, item_name, qty, rate, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          salesOrderId,
          itemData.item_code,
          itemData.item_name,
          itemData.qty,
          itemData.rate,
          itemData.amount
        ]
      )
      return true
    } catch (error) {
      throw error
    }
  }

  async getOrderAnalysisByBOM(bomId) {
    try {
      const [analysis] = await this.db.execute(
        `SELECT 
          COUNT(*) as total_orders,
          SUM(quantity) as total_quantity,
          SUM(order_amount) as total_amount,
          AVG(order_amount) as avg_amount,
          COUNT(DISTINCT customer_id) as unique_customers,
          MIN(created_at) as first_order_date,
          MAX(created_at) as last_order_date
        FROM selling_sales_order
        WHERE bom_id = ? AND deleted_at IS NULL`,
        [bomId]
      )
      return analysis && analysis.length > 0 ? analysis[0] : null
    } catch (error) {
      throw error
    }
  }

  async getOrderAnalysisByCustomer(customerId) {
    try {
      const [analysis] = await this.db.execute(
        `SELECT 
          COUNT(*) as total_orders,
          SUM(order_amount) as total_amount,
          AVG(order_amount) as avg_amount,
          MIN(created_at) as first_order_date,
          MAX(created_at) as last_order_date,
          status,
          DATE(created_at) as order_date
        FROM selling_sales_order
        WHERE customer_id = ? AND deleted_at IS NULL
        GROUP BY status, DATE(created_at)
        ORDER BY order_date DESC`,
        [customerId]
      )
      return analysis || []
    } catch (error) {
      throw error
    }
  }
}

export default SalesOrderModel
