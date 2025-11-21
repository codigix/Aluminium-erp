import GRNRequestModel from '../models/GRNRequestModel.js'
import StockEntryModel from '../models/StockEntryModel.js'

export const createGRNRequest = async (req, res) => {
  try {
    const { grn_no, po_no, supplier_id, supplier_name, receipt_date, items, notes } = req.body
    const userId = req.user?.id

    if (!grn_no || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    const grnRequest = await GRNRequestModel.create({
      grn_no,
      po_no,
      supplier_id,
      supplier_name,
      receipt_date,
      created_by: userId,
      items,
      notes
    })

    res.status(201).json({ success: true, data: grnRequest, message: 'GRN request created successfully' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getGRNRequest = async (req, res) => {
  try {
    const grn = await GRNRequestModel.getById(req.params.id)
    if (!grn) {
      return res.status(404).json({ success: false, error: 'GRN request not found' })
    }
    res.json({ success: true, data: grn })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getAllGRNRequests = async (req, res) => {
  try {
    const { status, assigned_to, search, created_by } = req.query
    const filters = { status, assigned_to, search, created_by }

    const grns = await GRNRequestModel.getAll(filters)
    res.json({ success: true, data: grns, count: grns.length })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const startInspection = async (req, res) => {
  try {
    const userId = req.user?.id
    const grn = await GRNRequestModel.markInspecting(req.params.id, userId)

    res.json({ success: true, data: grn, message: 'Inspection started' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const sendToInventory = async (req, res) => {
  try {
    const { approvedItems } = req.body
    const userId = req.user?.id
    const grnId = req.params.id

    if (!approvedItems || approvedItems.length === 0) {
      return res.status(400).json({ success: false, error: 'No items to send' })
    }

    const grn = await GRNRequestModel.sendToInventory(grnId, userId, approvedItems)
    res.json({ success: true, data: grn, message: 'GRN sent to inventory department for approval' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const inventoryApproveGRN = async (req, res) => {
  try {
    const userId = req.user?.id
    const grnId = req.params.id

    const grn = await GRNRequestModel.inventoryApprove(grnId, userId)

    const stockEntryItems = grn.items
      ?.filter(item => item.accepted_qty > 0)
      .map(item => ({
        item_code: item.item_code,
        qty: item.accepted_qty,
        uom: 'Kg',
        valuation_rate: 0,
        warehouse: item.warehouse_name
      })) || []

    if (stockEntryItems.length > 0) {
      try {
        const entry_no = await StockEntryModel.generateEntryNo('Material Receipt')
        
        await StockEntryModel.create({
          entry_no,
          entry_date: new Date(),
          entry_type: 'Material Receipt',
          from_warehouse_id: null,
          to_warehouse_id: null,
          purpose: `GRN Approved - ${grn.grn_no}`,
          reference_doctype: 'GRN Request',
          reference_name: grn.grn_no,
          remarks: `Auto-generated from GRN Request ${grn.grn_no} - Inventory Approved`,
          created_by: userId,
          items: stockEntryItems
        })
      } catch (stockError) {
        console.error('Error creating stock entry:', stockError)
      }
    }

    res.json({ success: true, data: grn, message: 'GRN approved by inventory and items stored' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const approveGRNRequest = async (req, res) => {
  return sendToInventory(req, res)
}

export const rejectGRNRequest = async (req, res) => {
  try {
    const { reason } = req.body
    const userId = req.user?.id

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Rejection reason required' })
    }

    const grn = await GRNRequestModel.reject(req.params.id, userId, reason)

    res.json({ success: true, data: grn, message: 'GRN request rejected' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const sendBackGRNRequest = async (req, res) => {
  try {
    const { reason } = req.body
    const userId = req.user?.id

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Reason required' })
    }

    const grn = await GRNRequestModel.sendBack(req.params.id, userId, reason)

    res.json({ success: true, data: grn, message: 'GRN request sent back' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateItemStatus = async (req, res) => {
  try {
    const { itemId, status, notes } = req.body

    await GRNRequestModel.updateItemStatus(itemId, status, notes)

    res.json({ success: true, message: 'Item status updated' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const inspectItem = async (req, res) => {
  try {
    const { itemId, status, notes, accepted_qty, rejected_qty, qc_checks } = req.body
    const grnId = req.params.id

    if (!itemId || !status) {
      return res.status(400).json({ success: false, error: 'Missing required fields' })
    }

    await GRNRequestModel.inspectItem(itemId, {
      status,
      notes,
      accepted_qty: accepted_qty || 0,
      rejected_qty: rejected_qty || 0,
      qc_checks: qc_checks || {}
    })

    const grn = await GRNRequestModel.getById(grnId)
    res.json({ success: true, data: grn, message: 'Item inspection recorded' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
}
