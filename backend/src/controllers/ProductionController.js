class ProductionController {
  constructor(productionModel) {
    this.productionModel = productionModel
  }

  // ============= WORK ORDERS =============

  // Create work order
  async createWorkOrder(req, res) {
    try {
      const { sales_order_id, item_code, quantity, unit_cost, required_date, assigned_to_id, priority, notes } = req.body

      // Validation
      if (!item_code || !quantity || !unit_cost || !required_date) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: item_code, quantity, unit_cost, required_date'
        })
      }

      const workOrder = await this.productionModel.createWorkOrder({
        sales_order_id,
        item_code,
        quantity,
        unit_cost,
        required_date,
        assigned_to_id,
        priority,
        notes
      })

      res.status(201).json({
        success: true,
        message: 'Work order created successfully',
        data: workOrder
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating work order',
        error: error.message
      })
    }
  }

  // Get work orders
  async getWorkOrders(req, res) {
    try {
      const { status, search, assigned_to_id } = req.query

      const workOrders = await this.productionModel.getWorkOrders({
        status,
        search,
        assigned_to_id
      })

      res.status(200).json({
        success: true,
        data: workOrders,
        count: workOrders.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching work orders',
        error: error.message
      })
    }
  }

  // Update work order
  async updateWorkOrder(req, res) {
    try {
      const { wo_id } = req.params
      const data = req.body

      const success = await this.productionModel.updateWorkOrder(wo_id, data)

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Work order updated successfully'
        })
      } else {
        res.status(404).json({
          success: false,
          message: 'Work order not found'
        })
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating work order',
        error: error.message
      })
    }
  }

  // ============= PRODUCTION PLANS =============

  // Create production plan
  async createProductionPlan(req, res) {
    try {
      const { plan_date, week_number, planned_by_id, items } = req.body

      if (!plan_date || !week_number || !planned_by_id) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: plan_date, week_number, planned_by_id'
        })
      }

      const plan = await this.productionModel.createProductionPlan({
        plan_date,
        week_number,
        planned_by_id
      })

      // Add items if provided
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await this.productionModel.addPlanItem(plan.plan_id, item)
        }
      }

      res.status(201).json({
        success: true,
        message: 'Production plan created successfully',
        data: plan
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating production plan',
        error: error.message
      })
    }
  }

  // Get production plans
  async getProductionPlans(req, res) {
    try {
      const { status, week_number } = req.query

      const plans = await this.productionModel.getProductionPlans({
        status,
        week_number
      })

      res.status(200).json({
        success: true,
        data: plans,
        count: plans.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching production plans',
        error: error.message
      })
    }
  }

  // ============= PRODUCTION ENTRIES =============

  // Create production entry (daily production)
  async createProductionEntry(req, res) {
    try {
      const { work_order_id, machine_id, operator_id, entry_date, shift_no, quantity_produced, quantity_rejected, hours_worked, remarks } = req.body

      if (!work_order_id || !entry_date || !quantity_produced) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: work_order_id, entry_date, quantity_produced'
        })
      }

      const entry = await this.productionModel.createProductionEntry({
        work_order_id,
        machine_id,
        operator_id,
        entry_date,
        shift_no,
        quantity_produced,
        quantity_rejected: quantity_rejected || 0,
        hours_worked: hours_worked || 0,
        remarks
      })

      res.status(201).json({
        success: true,
        message: 'Production entry created successfully',
        data: entry
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating production entry',
        error: error.message
      })
    }
  }

  // Get production entries
  async getProductionEntries(req, res) {
    try {
      const { entry_date, machine_id, work_order_id } = req.query

      const entries = await this.productionModel.getProductionEntries({
        entry_date,
        machine_id,
        work_order_id
      })

      res.status(200).json({
        success: true,
        data: entries,
        count: entries.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching production entries',
        error: error.message
      })
    }
  }

  // ============= REJECTIONS =============

  // Record rejection
  async recordRejection(req, res) {
    try {
      const { production_entry_id, rejection_reason, rejection_count, root_cause, corrective_action, reported_by_id } = req.body

      if (!production_entry_id || !rejection_reason || !rejection_count) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: production_entry_id, rejection_reason, rejection_count'
        })
      }

      const rejection = await this.productionModel.recordRejection({
        production_entry_id,
        rejection_reason,
        rejection_count,
        root_cause,
        corrective_action,
        reported_by_id
      })

      res.status(201).json({
        success: true,
        message: 'Rejection recorded successfully',
        data: rejection
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error recording rejection',
        error: error.message
      })
    }
  }

  // Get rejection analysis
  async getRejectionAnalysis(req, res) {
    try {
      const { date_from, date_to } = req.query

      const analysis = await this.productionModel.getRejectionAnalysis({
        date_from,
        date_to
      })

      res.status(200).json({
        success: true,
        data: analysis
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching rejection analysis',
        error: error.message
      })
    }
  }

  // ============= MACHINES =============

  // Create machine
  async createMachine(req, res) {
    try {
      const { name, type, model, capacity, purchase_date, cost, maintenance_interval } = req.body

      if (!name || !type) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: name, type'
        })
      }

      const machine = await this.productionModel.createMachine({
        name,
        type,
        model,
        capacity,
        purchase_date,
        cost,
        maintenance_interval
      })

      res.status(201).json({
        success: true,
        message: 'Machine created successfully',
        data: machine
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating machine',
        error: error.message
      })
    }
  }

  // Get machines
  async getMachines(req, res) {
    try {
      const { status, type } = req.query

      const machines = await this.productionModel.getMachines({
        status,
        type
      })

      res.status(200).json({
        success: true,
        data: machines,
        count: machines.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching machines',
        error: error.message
      })
    }
  }

  // ============= OPERATORS =============

  // Create operator
  async createOperator(req, res) {
    try {
      const { employee_id, name, qualification, experience_years, machines_skilled_on } = req.body

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: name'
        })
      }

      const operator = await this.productionModel.createOperator({
        employee_id,
        name,
        qualification,
        experience_years,
        machines_skilled_on
      })

      res.status(201).json({
        success: true,
        message: 'Operator created successfully',
        data: operator
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating operator',
        error: error.message
      })
    }
  }

  // Get operators
  async getOperators(req, res) {
    try {
      const { status } = req.query

      const operators = await this.productionModel.getOperators({
        status
      })

      res.status(200).json({
        success: true,
        data: operators,
        count: operators.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching operators',
        error: error.message
      })
    }
  }

  // ============= ANALYTICS =============

  // Get production dashboard
  async getProductionDashboard(req, res) {
    try {
      const { date } = req.query
      const dashboardDate = date || new Date().toISOString().split('T')[0]

      const dashboard = await this.productionModel.getProductionDashboard(dashboardDate)

      res.status(200).json({
        success: true,
        data: dashboard
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching production dashboard',
        error: error.message
      })
    }
  }

  // Get machine utilization
  async getMachineUtilization(req, res) {
    try {
      const { date_from, date_to } = req.query

      if (!date_from || !date_to) {
        return res.status(400).json({
          success: false,
          message: 'date_from and date_to are required'
        })
      }

      const utilization = await this.productionModel.getMachineUtilization(date_from, date_to)

      res.status(200).json({
        success: true,
        data: utilization
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching machine utilization',
        error: error.message
      })
    }
  }

  // Get operator efficiency
  async getOperatorEfficiency(req, res) {
    try {
      const { date_from, date_to } = req.query

      if (!date_from || !date_to) {
        return res.status(400).json({
          success: false,
          message: 'date_from and date_to are required'
        })
      }

      const efficiency = await this.productionModel.getOperatorEfficiency(date_from, date_to)

      res.status(200).json({
        success: true,
        data: efficiency
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching operator efficiency',
        error: error.message
      })
    }
  }
}

export default ProductionController