# Complete Implementation Example: Dispatch Module

This document shows how to implement the Dispatch module from scratch, using it as a template for other modules.

## Step 1: Create DispatchModel.js

File: `backend/src/models/DispatchModel.js`

```javascript
class DispatchModel {
  constructor(db) {
    this.db = db
  }

  // ============= DISPATCH ORDERS =============

  async createDispatchOrder(data) {
    try {
      const dispatch_id = `DISP-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO dispatch_order 
        (dispatch_id, sales_order_id, dispatch_date, expected_delivery_date, status, shipping_address, carrier)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [dispatch_id, data.sales_order_id, data.dispatch_date, data.expected_delivery_date, 
         'pending', data.shipping_address, data.carrier]
      )
      return { dispatch_id, ...data, status: 'pending' }
    } catch (error) {
      throw error
    }
  }

  async getDispatchOrders(filters = {}) {
    try {
      let query = `SELECT d.*, 
                   so.so_id as sales_order_no,
                   c.name as customer_name,
                   COUNT(di.id) as item_count
                   FROM dispatch_order d
                   LEFT JOIN sales_order so ON d.sales_order_id = so.sales_order_id
                   LEFT JOIN customer_master c ON so.customer_id = c.customer_id
                   LEFT JOIN dispatch_item di ON d.dispatch_id = di.dispatch_id
                   WHERE 1=1`

      const params = []

      if (filters.status) {
        query += ' AND d.status = ?'
        params.push(filters.status)
      }
      if (filters.date_from) {
        query += ' AND DATE(d.dispatch_date) >= ?'
        params.push(filters.date_from)
      }
      if (filters.date_to) {
        query += ' AND DATE(d.dispatch_date) <= ?'
        params.push(filters.date_to)
      }

      query += ' GROUP BY d.dispatch_id ORDER BY d.dispatch_date DESC'

      const [results] = await this.db.query(query, params)
      return results
    } catch (error) {
      throw error
    }
  }

  async updateDispatchStatus(dispatch_id, status, shipped_date = null) {
    try {
      let query = 'UPDATE dispatch_order SET status = ?'
      const params = [status]

      if (shipped_date && status === 'shipped') {
        query += ', shipped_date = ?'
        params.push(shipped_date)
      }

      query += ' WHERE dispatch_id = ?'
      params.push(dispatch_id)

      const [result] = await this.db.query(query, params)
      return result.affectedRows > 0
    } catch (error) {
      throw error
    }
  }

  // ============= DISPATCH ITEMS =============

  async addDispatchItem(data) {
    try {
      const [result] = await this.db.query(
        `INSERT INTO dispatch_item
        (dispatch_id, item_code, quantity, packed_quantity, batch_number)
        VALUES (?, ?, ?, ?, ?)`,
        [data.dispatch_id, data.item_code, data.quantity, 
         data.packed_quantity || 0, data.batch_number]
      )
      return { id: result.insertId, ...data }
    } catch (error) {
      throw error
    }
  }

  async getDispatchItems(dispatch_id) {
    try {
      const [results] = await this.db.query(
        `SELECT di.*, i.name as item_name, i.uom
         FROM dispatch_item di
         LEFT JOIN item i ON di.item_code = i.item_code
         WHERE di.dispatch_id = ?`,
        [dispatch_id]
      )
      return results
    } catch (error) {
      throw error
    }
  }

  // ============= DELIVERY CHALLANS =============

  async createDeliveryChallan(data) {
    try {
      const challan_id = `CHL-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO delivery_challan
        (challan_id, dispatch_id, challan_date, status, signed_by)
        VALUES (?, ?, ?, ?, ?)`,
        [challan_id, data.dispatch_id, data.challan_date, 'generated', data.signed_by]
      )
      return { challan_id, ...data }
    } catch (error) {
      throw error
    }
  }

  async getDeliveryChallans(filters = {}) {
    try {
      let query = `SELECT c.*, d.dispatch_id
                   FROM delivery_challan c
                   LEFT JOIN dispatch_order d ON c.dispatch_id = d.dispatch_id
                   WHERE 1=1`

      const params = []

      if (filters.dispatch_id) {
        query += ' AND c.dispatch_id = ?'
        params.push(filters.dispatch_id)
      }

      query += ' ORDER BY c.challan_date DESC'

      const [results] = await this.db.query(query, params)
      return results
    } catch (error) {
      throw error
    }
  }

  // ============= SHIPMENT TRACKING =============

  async updateShipmentTracking(dispatch_id, data) {
    try {
      const tracking_id = `TRK-${Date.now()}`
      const [result] = await this.db.query(
        `INSERT INTO shipment_tracking
        (tracking_id, dispatch_id, current_location, status, update_date)
        VALUES (?, ?, ?, ?, NOW())`,
        [tracking_id, dispatch_id, data.current_location, data.status]
      )
      return { tracking_id, ...data }
    } catch (error) {
      throw error
    }
  }

  async getShipmentTracking(dispatch_id) {
    try {
      const [results] = await this.db.query(
        `SELECT * FROM shipment_tracking 
         WHERE dispatch_id = ? 
         ORDER BY update_date DESC`,
        [dispatch_id]
      )
      return results
    } catch (error) {
      throw error
    }
  }

  // ============= DISPATCH ANALYTICS =============

  async getDispatchDashboard() {
    try {
      const [data] = await this.db.query(
        `SELECT 
         COUNT(*) as total_dispatch,
         SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
         SUM(CASE WHEN status IN ('pending', 'ready', 'shipped') THEN 1 ELSE 0 END) as pending,
         ROUND(AVG(DATEDIFF(shipped_date, dispatch_date)), 2) as avg_delivery_days,
         ROUND(SUM(CASE WHEN shipped_date <= expected_delivery_date THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as on_time_rate
         FROM dispatch_order
         WHERE dispatch_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      )
      return data[0] || {}
    } catch (error) {
      throw error
    }
  }

  async getDeliveryPerformance(date_from, date_to) {
    try {
      const [results] = await this.db.query(
        `SELECT 
         DATE(dispatch_date) as date,
         COUNT(*) as total_dispatches,
         SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
         ROUND(SUM(CASE WHEN shipped_date <= expected_delivery_date THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as on_time_percent
         FROM dispatch_order
         WHERE dispatch_date BETWEEN ? AND ?
         GROUP BY DATE(dispatch_date)
         ORDER BY date DESC`,
        [date_from, date_to]
      )
      return results
    } catch (error) {
      throw error
    }
  }

  async getCarrierPerformance(date_from, date_to) {
    try {
      const [results] = await this.db.query(
        `SELECT 
         carrier,
         COUNT(*) as total_shipments,
         SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
         ROUND(AVG(DATEDIFF(shipped_date, dispatch_date)), 2) as avg_days,
         ROUND(SUM(CASE WHEN shipped_date <= expected_delivery_date THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) as on_time_percent
         FROM dispatch_order
         WHERE dispatch_date BETWEEN ? AND ? AND carrier IS NOT NULL
         GROUP BY carrier
         ORDER BY on_time_percent DESC`,
        [date_from, date_to]
      )
      return results
    } catch (error) {
      throw error
    }
  }
}

export default DispatchModel
```

---

## Step 2: Create DispatchController.js

File: `backend/src/controllers/DispatchController.js`

```javascript
class DispatchController {
  constructor(dispatchModel) {
    this.dispatchModel = dispatchModel
  }

  // ============= DISPATCH ORDERS =============

  async createDispatchOrder(req, res) {
    try {
      const { sales_order_id, dispatch_date, expected_delivery_date, 
              shipping_address, carrier } = req.body

      if (!sales_order_id || !dispatch_date) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: sales_order_id, dispatch_date'
        })
      }

      const dispatch = await this.dispatchModel.createDispatchOrder({
        sales_order_id,
        dispatch_date,
        expected_delivery_date,
        shipping_address,
        carrier
      })

      res.status(201).json({
        success: true,
        message: 'Dispatch order created successfully',
        data: dispatch
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating dispatch order',
        error: error.message
      })
    }
  }

  async getDispatchOrders(req, res) {
    try {
      const { status, date_from, date_to } = req.query

      const orders = await this.dispatchModel.getDispatchOrders({
        status,
        date_from,
        date_to
      })

      res.status(200).json({
        success: true,
        data: orders,
        count: orders.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching dispatch orders',
        error: error.message
      })
    }
  }

  async updateDispatchStatus(req, res) {
    try {
      const { dispatch_id } = req.params
      const { status, shipped_date } = req.body

      const success = await this.dispatchModel.updateDispatchStatus(
        dispatch_id,
        status,
        shipped_date
      )

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Dispatch status updated successfully'
        })
      } else {
        res.status(404).json({
          success: false,
          message: 'Dispatch order not found'
        })
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating dispatch status',
        error: error.message
      })
    }
  }

  // ============= DISPATCH ITEMS =============

  async addDispatchItem(req, res) {
    try {
      const { dispatch_id, item_code, quantity, packed_quantity, batch_number } = req.body

      if (!dispatch_id || !item_code || !quantity) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        })
      }

      const item = await this.dispatchModel.addDispatchItem({
        dispatch_id,
        item_code,
        quantity,
        packed_quantity,
        batch_number
      })

      res.status(201).json({
        success: true,
        message: 'Dispatch item added successfully',
        data: item
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error adding dispatch item',
        error: error.message
      })
    }
  }

  async getDispatchItems(req, res) {
    try {
      const { dispatch_id } = req.params

      const items = await this.dispatchModel.getDispatchItems(dispatch_id)

      res.status(200).json({
        success: true,
        data: items,
        count: items.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching dispatch items',
        error: error.message
      })
    }
  }

  // ============= DELIVERY CHALLANS =============

  async createDeliveryChallan(req, res) {
    try {
      const { dispatch_id, challan_date, signed_by } = req.body

      if (!dispatch_id || !challan_date) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        })
      }

      const challan = await this.dispatchModel.createDeliveryChallan({
        dispatch_id,
        challan_date,
        signed_by
      })

      res.status(201).json({
        success: true,
        message: 'Delivery challan created successfully',
        data: challan
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating delivery challan',
        error: error.message
      })
    }
  }

  async getDeliveryChallans(req, res) {
    try {
      const { dispatch_id } = req.query

      const challans = await this.dispatchModel.getDeliveryChallans({
        dispatch_id
      })

      res.status(200).json({
        success: true,
        data: challans,
        count: challans.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching delivery challans',
        error: error.message
      })
    }
  }

  // ============= SHIPMENT TRACKING =============

  async updateTracking(req, res) {
    try {
      const { dispatch_id } = req.params
      const { current_location, status } = req.body

      if (!current_location || !status) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        })
      }

      const tracking = await this.dispatchModel.updateShipmentTracking(
        dispatch_id,
        { current_location, status }
      )

      res.status(201).json({
        success: true,
        message: 'Shipment tracking updated successfully',
        data: tracking
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating tracking',
        error: error.message
      })
    }
  }

  async getTracking(req, res) {
    try {
      const { dispatch_id } = req.params

      const tracking = await this.dispatchModel.getShipmentTracking(dispatch_id)

      res.status(200).json({
        success: true,
        data: tracking,
        count: tracking.length
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching tracking',
        error: error.message
      })
    }
  }

  // ============= ANALYTICS =============

  async getDashboard(req, res) {
    try {
      const dashboard = await this.dispatchModel.getDispatchDashboard()

      res.status(200).json({
        success: true,
        data: dashboard
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching dispatch dashboard',
        error: error.message
      })
    }
  }

  async getDeliveryPerformance(req, res) {
    try {
      const { date_from, date_to } = req.query

      if (!date_from || !date_to) {
        return res.status(400).json({
          success: false,
          message: 'date_from and date_to are required'
        })
      }

      const performance = await this.dispatchModel.getDeliveryPerformance(
        date_from,
        date_to
      )

      res.status(200).json({
        success: true,
        data: performance
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching delivery performance',
        error: error.message
      })
    }
  }

  async getCarrierPerformance(req, res) {
    try {
      const { date_from, date_to } = req.query

      if (!date_from || !date_to) {
        return res.status(400).json({
          success: false,
          message: 'date_from and date_to are required'
        })
      }

      const performance = await this.dispatchModel.getCarrierPerformance(
        date_from,
        date_to
      )

      res.status(200).json({
        success: true,
        data: performance
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching carrier performance',
        error: error.message
      })
    }
  }
}

export default DispatchController
```

---

## Step 3: Create Routes File

File: `backend/src/routes/dispatch.js`

```javascript
import express from 'express'
import DispatchController from '../controllers/DispatchController.js'
import DispatchModel from '../models/DispatchModel.js'
import authMiddleware from '../middleware/authMiddleware.js'

export function createDispatchRoutes(db) {
  const router = express.Router()
  const dispatchModel = new DispatchModel(db)
  const controller = new DispatchController(dispatchModel)

  // ============= DISPATCH ORDERS =============
  router.post(
    '/orders',
    authMiddleware,
    controller.createDispatchOrder.bind(controller)
  )
  router.get(
    '/orders',
    authMiddleware,
    controller.getDispatchOrders.bind(controller)
  )
  router.put(
    '/orders/:dispatch_id/status',
    authMiddleware,
    controller.updateDispatchStatus.bind(controller)
  )

  // ============= DISPATCH ITEMS =============
  router.post(
    '/items',
    authMiddleware,
    controller.addDispatchItem.bind(controller)
  )
  router.get(
    '/items/:dispatch_id',
    authMiddleware,
    controller.getDispatchItems.bind(controller)
  )

  // ============= DELIVERY CHALLANS =============
  router.post(
    '/challans',
    authMiddleware,
    controller.createDeliveryChallan.bind(controller)
  )
  router.get(
    '/challans',
    authMiddleware,
    controller.getDeliveryChallans.bind(controller)
  )

  // ============= SHIPMENT TRACKING =============
  router.post(
    '/tracking/:dispatch_id',
    authMiddleware,
    controller.updateTracking.bind(controller)
  )
  router.get(
    '/tracking/:dispatch_id',
    authMiddleware,
    controller.getTracking.bind(controller)
  )

  // ============= ANALYTICS =============
  router.get(
    '/analytics/dashboard',
    authMiddleware,
    controller.getDashboard.bind(controller)
  )
  router.get(
    '/analytics/delivery-performance',
    authMiddleware,
    controller.getDeliveryPerformance.bind(controller)
  )
  router.get(
    '/analytics/carrier-performance',
    authMiddleware,
    controller.getCarrierPerformance.bind(controller)
  )

  return router
}

export default createDispatchRoutes
```

---

## Step 4: Update app.js

In `backend/src/app.js`, add:

```javascript
// Add import at top
import { createDispatchRoutes } from './routes/dispatch.js'

// Add this line in the route setup section (after other module routes):
app.use('/api/dispatch', createDispatchRoutes(db))
```

---

## ✅ Testing the Dispatch Module

```bash
# 1. Create dispatch order
curl -X POST http://localhost:5000/api/dispatch/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "sales_order_id": "SO-123",
    "dispatch_date": "2025-01-10",
    "expected_delivery_date": "2025-01-15",
    "shipping_address": "123 Main St, City",
    "carrier": "FedEx"
  }'

# 2. Get all dispatch orders
curl -X GET "http://localhost:5000/api/dispatch/orders?status=pending" \
  -H "Authorization: Bearer <token>"

# 3. Update dispatch status
curl -X PUT http://localhost:5000/api/dispatch/orders/DISP-123/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status": "shipped", "shipped_date": "2025-01-11"}'

# 4. Get dispatch analytics
curl -X GET "http://localhost:5000/api/dispatch/analytics/dashboard" \
  -H "Authorization: Bearer <token>"
```

---

## 🎯 Summary

This Dispatch module is complete and ready to use. Follow this exact pattern for:
- Accounts Module
- HR Module  
- ToolRoom Module
- And update QC & Admin to have Controllers

That's it! Copy and customize for each remaining module. 🚀
