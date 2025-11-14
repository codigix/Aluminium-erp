import { v4 as uuidv4 } from 'uuid'

class ProductionModel {
  constructor(db) {
    this.db = db
  }

  // ============= WORK ORDERS =============

  // Create work order
  async createWorkOrder(data) {
    try {
      const wo_id = `WO-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO work_order 
        (wo_id, sales_order_id, item_code, quantity, unit_cost, total_cost, required_date, status, assigned_to_id, priority, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [wo_id, data.sales_order_id, data.item_code, data.quantity, data.unit_cost, 
         data.quantity * data.unit_cost, data.required_date, data.status || 'draft', 
         data.assigned_to_id, data.priority || 'medium', data.notes]
      )
      return { wo_id, ...data }
    } catch (error) {
      throw error
    }
  }

  // Get all work orders with filters
  async getWorkOrders(filters = {}) {
    try {
      let query = `SELECT wo.*, 
                   so.so_id as sales_order_no,
                   i.name as item_name
                   FROM work_order wo
                   LEFT JOIN sales_order so ON wo.sales_order_id = so.sales_order_id
                   LEFT JOIN item i ON wo.item_code = i.item_code
                   WHERE 1=1`

      const params = []

      if (filters.status) {
        query += ' AND wo.status = ?'
        params.push(filters.status)
      }
      if (filters.search) {
        query += ' AND (wo.wo_id LIKE ? OR i.name LIKE ?)'
        params.push(`%${filters.search}%`, `%${filters.search}%`)
      }
      if (filters.assigned_to_id) {
        query += ' AND wo.assigned_to_id = ?'
        params.push(filters.assigned_to_id)
      }

      query += ' ORDER BY wo.created_at DESC'

      const [results] = await this.db.query(query, params)
      return results
    } catch (error) {
      throw error
    }
  }

  // Update work order
  async updateWorkOrder(wo_id, data) {
    try {
      let query = 'UPDATE work_order SET '
      const params = []
      const fields = []

      Object.entries(data).forEach(([key, value]) => {
        fields.push(`${key} = ?`)
        params.push(value)
      })

      query += fields.join(', ')
      query += ' WHERE wo_id = ?'
      params.push(wo_id)

      const [result] = await this.db.query(query, params)
      return result.affectedRows > 0
    } catch (error) {
      throw error
    }
  }

  // ============= PRODUCTION PLANS =============

  // Create production plan
  async createProductionPlan(data) {
    try {
      const plan_id = `PP-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO production_plan 
        (plan_id, plan_date, week_number, planned_by_id, status)
        VALUES (?, ?, ?, ?, ?)`,
        [plan_id, data.plan_date, data.week_number, data.planned_by_id, 'draft']
      )
      return { plan_id, ...data }
    } catch (error) {
      throw error
    }
  }

  // Add items to production plan
  async addPlanItem(plan_id, item) {
    try {
      const [result] = await this.db.query(
        `INSERT INTO production_plan_item
        (plan_id, work_order_id, machine_id, operator_id, scheduled_date, shift_no, planned_quantity, estimated_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [plan_id, item.work_order_id, item.machine_id, item.operator_id, 
         item.scheduled_date, item.shift_no, item.planned_quantity, item.estimated_hours]
      )
      return true
    } catch (error) {
      throw error
    }
  }

  // Get production plans
  async getProductionPlans(filters = {}) {
    try {
      let query = `SELECT pp.*, 
                   COUNT(ppi.id) as total_items
                   FROM production_plan pp
                   LEFT JOIN production_plan_item ppi ON pp.plan_id = ppi.plan_id
                   WHERE 1=1`

      const params = []

      if (filters.status) {
        query += ' AND pp.status = ?'
        params.push(filters.status)
      }
      if (filters.week_number) {
        query += ' AND pp.week_number = ?'
        params.push(filters.week_number)
      }

      query += ' GROUP BY pp.plan_id ORDER BY pp.plan_date DESC'

      const [results] = await this.db.query(query, params)
      return results
    } catch (error) {
      throw error
    }
  }

  // ============= PRODUCTION ENTRIES (Daily Production) =============

  // Create production entry
  async createProductionEntry(data) {
    try {
      const entry_id = `PE-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO production_entry
        (entry_id, work_order_id, machine_id, operator_id, entry_date, shift_no, 
         quantity_produced, quantity_rejected, hours_worked, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry_id, data.work_order_id, data.machine_id, data.operator_id, 
         data.entry_date, data.shift_no, data.quantity_produced, data.quantity_rejected, 
         data.hours_worked, data.remarks]
      )
      return { entry_id, ...data }
    } catch (error) {
      throw error
    }
  }

  // Get production entries
  async getProductionEntries(filters = {}) {
    try {
      let query = `SELECT pe.*, 
                   wo.wo_id,
                   mm.name as machine_name,
                   om.name as operator_name
                   FROM production_entry pe
                   LEFT JOIN work_order wo ON pe.work_order_id = wo.wo_id
                   LEFT JOIN machine_master mm ON pe.machine_id = mm.machine_id
                   LEFT JOIN operator_master om ON pe.operator_id = om.operator_id
                   WHERE 1=1`

      const params = []

      if (filters.entry_date) {
        query += ' AND DATE(pe.entry_date) = ?'
        params.push(filters.entry_date)
      }
      if (filters.machine_id) {
        query += ' AND pe.machine_id = ?'
        params.push(filters.machine_id)
      }
      if (filters.work_order_id) {
        query += ' AND pe.work_order_id = ?'
        params.push(filters.work_order_id)
      }

      query += ' ORDER BY pe.entry_date DESC, pe.shift_no DESC'

      const [results] = await this.db.query(query, params)
      return results
    } catch (error) {
      throw error
    }
  }

  // ============= PRODUCTION REJECTIONS =============

  // Record rejection
  async recordRejection(data) {
    try {
      const rejection_id = `REJ-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO production_rejection
        (rejection_id, production_entry_id, rejection_reason, rejection_count, 
         root_cause, corrective_action, reported_by_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [rejection_id, data.production_entry_id, data.rejection_reason, 
         data.rejection_count, data.root_cause, data.corrective_action, data.reported_by_id]
      )
      return { rejection_id, ...data }
    } catch (error) {
      throw error
    }
  }

  // Get rejection analysis
  async getRejectionAnalysis(filters = {}) {
    try {
      let query = `SELECT 
                   pr.rejection_reason,
                   COUNT(*) as count,
                   SUM(pr.rejection_count) as total_quantity,
                   ROUND(AVG(pr.rejection_count), 2) as avg_quantity
                   FROM production_rejection pr
                   WHERE 1=1`

      const params = []

      if (filters.date_from) {
        query += ' AND DATE(pr.created_at) >= ?'
        params.push(filters.date_from)
      }
      if (filters.date_to) {
        query += ' AND DATE(pr.created_at) <= ?'
        params.push(filters.date_to)
      }

      query += ' GROUP BY pr.rejection_reason ORDER BY count DESC'

      const [results] = await this.db.query(query, params)
      return results
    } catch (error) {
      throw error
    }
  }

  // ============= MACHINES =============

  // Create machine
  async createMachine(data) {
    try {
      const machine_id = `M-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO machine_master
        (machine_id, name, type, model, capacity, status, purchase_date, cost, maintenance_interval)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [machine_id, data.name, data.type, data.model, data.capacity, 
         'active', data.purchase_date, data.cost, data.maintenance_interval]
      )
      return { machine_id, ...data }
    } catch (error) {
      throw error
    }
  }

  // Get machines
  async getMachines(filters = {}) {
    try {
      let query = `SELECT * FROM machine_master WHERE 1=1`
      const params = []

      if (filters.status) {
        query += ' AND status = ?'
        params.push(filters.status)
      }
      if (filters.type) {
        query += ' AND type = ?'
        params.push(filters.type)
      }

      query += ' ORDER BY name'

      const [results] = await this.db.query(query, params)
      return results
    } catch (error) {
      throw error
    }
  }

  // ============= OPERATORS =============

  // Create operator
  async createOperator(data) {
    try {
      const operator_id = `OP-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO operator_master
        (operator_id, employee_id, name, qualification, experience_years, machines_skilled_on, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [operator_id, data.employee_id, data.name, data.qualification, 
         data.experience_years, data.machines_skilled_on, 'active']
      )
      return { operator_id, ...data }
    } catch (error) {
      throw error
    }
  }

  // Get operators
  async getOperators(filters = {}) {
    try {
      let query = `SELECT * FROM operator_master WHERE 1=1`
      const params = []

      if (filters.status) {
        query += ' AND status = ?'
        params.push(filters.status)
      }

      query += ' ORDER BY name'

      const [results] = await this.db.query(query, params)
      return results
    } catch (error) {
      throw error
    }
  }

  // ============= PRODUCTION ANALYTICS =============

  // Get production dashboard data
  async getProductionDashboard(date) {
    try {
      const [data] = await this.db.query(
        `SELECT 
         COUNT(DISTINCT work_order_id) as active_wo,
         SUM(quantity_produced) as total_produced,
         SUM(quantity_rejected) as total_rejected,
         ROUND(SUM(quantity_rejected) / SUM(quantity_produced) * 100, 2) as rejection_rate,
         SUM(hours_worked) as total_hours
         FROM production_entry
         WHERE DATE(entry_date) = ?`,
        [date]
      )
      return data[0] || {}
    } catch (error) {
      throw error
    }
  }

  // Get machine utilization
  async getMachineUtilization(date_from, date_to) {
    try {
      const [results] = await this.db.query(
        `SELECT 
         mm.machine_id,
         mm.name as machine_name,
         COUNT(pe.entry_id) as production_days,
         SUM(pe.hours_worked) as total_hours,
         SUM(pe.quantity_produced) as total_produced,
         ROUND(SUM(pe.hours_worked) / (48 * COUNT(DISTINCT DATE(pe.entry_date))) * 100, 2) as utilization_percent
         FROM machine_master mm
         LEFT JOIN production_entry pe ON mm.machine_id = pe.machine_id 
         AND pe.entry_date BETWEEN ? AND ?
         GROUP BY mm.machine_id, mm.name
         ORDER BY utilization_percent DESC`,
        [date_from, date_to]
      )
      return results
    } catch (error) {
      throw error
    }
  }

  // Get operator efficiency
  async getOperatorEfficiency(date_from, date_to) {
    try {
      const [results] = await this.db.query(
        `SELECT 
         om.operator_id,
         om.name as operator_name,
         COUNT(pe.entry_id) as production_days,
         SUM(pe.quantity_produced) as total_produced,
         SUM(pe.quantity_rejected) as total_rejected,
         ROUND(SUM(pe.quantity_produced) / SUM(pe.hours_worked), 2) as units_per_hour,
         ROUND((1 - SUM(pe.quantity_rejected) / SUM(pe.quantity_produced)) * 100, 2) as quality_score
         FROM operator_master om
         LEFT JOIN production_entry pe ON om.operator_id = pe.operator_id 
         AND pe.entry_date BETWEEN ? AND ?
         GROUP BY om.operator_id, om.name
         ORDER BY quality_score DESC`,
        [date_from, date_to]
      )
      return results
    } catch (error) {
      throw error
    }
  }
}

export default ProductionModel