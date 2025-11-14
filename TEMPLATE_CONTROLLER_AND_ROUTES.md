# Quick Template for Creating Remaining Controllers & Routes

## Template Pattern

### 1. Model Template
```javascript
// Example: DispatchModel.js

class DispatchModel {
  constructor(db) {
    this.db = db
  }

  // CRUD Methods following this pattern:
  async create(data) {
    try {
      const id = `ID-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO table_name (col1, col2, col3) VALUES (?, ?, ?)`,
        [data.col1, data.col2, data.col3]
      )
      return { id, ...data }
    } catch (error) {
      throw error
    }
  }

  async getAll(filters = {}) {
    try {
      let query = `SELECT * FROM table_name WHERE 1=1`
      const params = []
      
      if (filters.status) {
        query += ' AND status = ?'
        params.push(filters.status)
      }
      
      query += ' ORDER BY created_at DESC'
      const [results] = await this.db.query(query, params)
      return results
    } catch (error) {
      throw error
    }
  }

  async update(id, data) {
    try {
      let query = 'UPDATE table_name SET '
      const params = []
      const fields = []
      
      Object.entries(data).forEach(([key, value]) => {
        fields.push(`${key} = ?`)
        params.push(value)
      })
      
      query += fields.join(', ')
      query += ' WHERE id = ?'
      params.push(id)
      
      const [result] = await this.db.query(query, params)
      return result.affectedRows > 0
    } catch (error) {
      throw error
    }
  }
}

export default DispatchModel
```

### 2. Controller Template
```javascript
// Example: DispatchController.js

class DispatchController {
  constructor(dispatchModel) {
    this.dispatchModel = dispatchModel
  }

  async create(req, res) {
    try {
      const { field1, field2, field3 } = req.body

      // Validation
      if (!field1 || !field2) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        })
      }

      const result = await this.dispatchModel.create({
        field1,
        field2,
        field3
      })

      res.status(201).json({
        success: true,
        message: 'Record created successfully',
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating record',
        error: error.message
      })
    }
  }

  async getAll(req, res) {
    try {
      const { status, search } = req.query

      const results = await this.dispatchModel.getAll({
        status,
        search
      })

      res.status(200).json({
        success: true,
        data: results,
        count: results.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching records',
        error: error.message
      })
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params
      const data = req.body

      const success = await this.dispatchModel.update(id, data)

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Record updated successfully'
        })
      } else {
        res.status(404).json({
          success: false,
          message: 'Record not found'
        })
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating record',
        error: error.message
      })
    }
  }
}

export default DispatchController
```

### 3. Routes Template
```javascript
// Example: routes/dispatch.js

import express from 'express'
import DispatchController from '../controllers/DispatchController.js'
import DispatchModel from '../models/DispatchModel.js'
import authMiddleware from '../middleware/authMiddleware.js'

export function createDispatchRoutes(db) {
  const router = express.Router()
  const dispatchModel = new DispatchModel(db)
  const controller = new DispatchController(dispatchModel)

  // CRUD Endpoints
  router.post('/', authMiddleware, controller.create.bind(controller))
  router.get('/', authMiddleware, controller.getAll.bind(controller))
  router.put('/:id', authMiddleware, controller.update.bind(controller))

  return router
}

export default createDispatchRoutes
```

### 4. Register in App.js
```javascript
// In backend/src/app.js

import { createDispatchRoutes } from './routes/dispatch.js'

// Inside route setup section:
app.use('/api/dispatch', createDispatchRoutes(db))
```

---

## Module-Specific Templates

### DISPATCH Module

**Key Tables**: dispatch_order, dispatch_item, delivery_challan, shipment_tracking

**Model Methods**:
```javascript
// DispatchModel.js - Key methods to implement:
- createDispatchOrder(data)
- getDispatchOrders(filters)
- updateDispatchStatus(id, status)
- createDeliveryChallan(data)
- updateShipmentTracking(id, location, status)
- getDeliveryPerformance(date_from, date_to)
```

**Controller Methods**:
```javascript
// DispatchController.js
- createDispatchOrder
- getDispatchOrders
- updateDispatchOrder
- createDeliveryChallan
- trackShipment
- getDeliveryAnalytics
```

---

### ACCOUNTS Module

**Key Tables**: account_ledger, vendor_payment, customer_payment, expense_master, costing_report

**Model Methods**:
```javascript
// AccountsModel.js
- recordPayment(data)              // vendor/customer payment
- getPaymentHistory(filters)
- recordExpense(data)
- getLedgerEntries(filters)
- createCostingReport(wo_id)
- getOutstandingAmounts()
- getMonthlyRevenue()
- getExpenseBreakdown()
```

**Controller Methods**:
```javascript
// AccountsController.js
- createPayment
- getPayments
- recordExpense
- getExpenses
- getLedger
- getCostingReport
- getFinancialAnalytics
```

---

### HR Module

**Key Tables**: employee_master, attendance_log, shift_allocation, payroll

**Model Methods**:
```javascript
// HRModel.js
- createEmployee(data)
- getEmployees(filters)
- recordAttendance(data)
- getAttendanceReport(filters)
- assignShift(data)
- generatePayroll(data)
- getPayrollHistory(filters)
- getAttendanceTrend(date_from, date_to)
```

**Controller Methods**:
```javascript
// HRController.js
- createEmployee
- getEmployees
- recordAttendance
- getAttendanceReport
- assignShift
- generatePayroll
- getPayrollReport
- getHRAnalytics
```

---

### TOOLROOM Module

**Key Tables**: tool_master, die_register, die_rework_log, maintenance_schedule, maintenance_history

**Model Methods**:
```javascript
// ToolRoomModel.js
- createTool(data)
- getTool(filters)
- createDieRegister(data)
- getDies(filters)
- scheduleMaintenance(data)
- recordMaintenance(data)
- getMaintenance(filters)
- logRework(data)
- getReworkLog(filters)
- getToolUtilization(date_from, date_to)
```

**Controller Methods**:
```javascript
// ToolRoomController.js
- createTool
- getTools
- createDie
- getDies
- scheduleMaintenance
- recordMaintenance
- getMaintenance
- logRework
- getReworkLog
- getToolAnalytics
```

---

## QC Controller (Remaining)

```javascript
// QCController.js

class QCController {
  constructor(qcModel) {
    this.qcModel = qcModel
  }

  async createInspection(req, res) {
    try {
      const { reference_type, reference_id, checklist_id, inspection_date, 
              inspector_id, quantity_inspected, quantity_passed, 
              quantity_rejected, remarks } = req.body

      if (!checklist_id || !quantity_inspected) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        })
      }

      const inspection = await this.qcModel.createInspection({
        reference_type,
        reference_id,
        checklist_id,
        inspection_date,
        inspector_id,
        quantity_inspected,
        quantity_passed: quantity_passed || 0,
        quantity_rejected: quantity_rejected || 0,
        result: quantity_rejected === 0 ? 'pass' : 'fail',
        remarks
      })

      res.status(201).json({
        success: true,
        message: 'Inspection created successfully',
        data: inspection
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating inspection',
        error: error.message
      })
    }
  }

  async getInspections(req, res) {
    try {
      const { result, date_from, date_to } = req.query
      const inspections = await this.qcModel.getInspections({
        result,
        date_from,
        date_to
      })
      res.status(200).json({
        success: true,
        data: inspections,
        count: inspections.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching inspections',
        error: error.message
      })
    }
  }

  // ... other methods follow same pattern
}

export default QCController
```

---

## Quick Checklist for Each Module

- [ ] Create Model.js with all CRUD and analytics methods
- [ ] Create Controller.js with all request handlers
- [ ] Create routes/moduleName.js with all endpoints
- [ ] Import routes in app.js
- [ ] Test all endpoints with Postman
- [ ] Create corresponding frontend pages
- [ ] Integrate with frontend forms and tables
- [ ] Test end-to-end functionality

---

## Common Patterns

### Error Handling
```javascript
try {
  // logic
  res.status(200).json({ success: true, data })
} catch (error) {
  res.status(500).json({ success: false, error: error.message })
}
```

### Filtering
```javascript
let query = `SELECT * FROM table WHERE 1=1`
const params = []

if (filter.status) {
  query += ' AND status = ?'
  params.push(filter.status)
}
// Add more filters as needed

const [results] = await this.db.query(query, params)
```

### ID Generation
```javascript
const id = `PREFIX-${Date.now()}`  // Timestamp-based
// Or use UUID
const id = uuidv4()
```

### Analytics Query Pattern
```javascript
const [data] = await this.db.query(`
  SELECT 
    COUNT(*) as total,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    DATE(date_field) as date
  FROM table
  WHERE date_field BETWEEN ? AND ?
  GROUP BY DATE(date_field)
`)
```
