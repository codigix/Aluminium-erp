import { PurchaseOrderModel } from '../models/PurchaseOrderModel.js'

export async function createPurchaseOrder(req, res) {
  try {
    const db = req.app.locals.db
    const model = new PurchaseOrderModel(db)

    const result = await model.create(req.body)
    res.status(201).json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
}

export async function getPurchaseOrder(req, res) {
  try {
    const db = req.app.locals.db
    const model = new PurchaseOrderModel(db)

    const po = await model.getById(req.params.po_no)
    if (!po) {
      return res.status(404).json({ success: false, error: 'Purchase Order not found' })
    }

    res.json({ success: true, data: po })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
}

export async function listPurchaseOrders(req, res) {
  try {
    const db = req.app.locals.db
    const model = new PurchaseOrderModel(db)

    const filters = {
      supplier_id: req.query.supplier_id,
      status: req.query.status,
      order_date_from: req.query.order_date_from,
      order_date_to: req.query.order_date_to,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    }

    const pos = await model.getAll(filters)
    res.json({ success: true, data: pos })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
}

export async function updatePurchaseOrder(req, res) {
  try {
    const db = req.app.locals.db
    const model = new PurchaseOrderModel(db)

    const result = await model.update(req.params.po_no, req.body)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
}

export async function submitPurchaseOrder(req, res) {
  try {
    const db = req.app.locals.db
    const model = new PurchaseOrderModel(db)

    const result = await model.submit(req.params.po_no)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
}

export async function deletePurchaseOrder(req, res) {
  try {
    const db = req.app.locals.db
    const model = new PurchaseOrderModel(db)

    const result = await model.delete(req.params.po_no)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
}