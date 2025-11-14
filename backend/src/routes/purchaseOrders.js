import express from 'express'
import * as controller from '../controllers/purchaseOrderController.js'

const router = express.Router()

// CRUD Operations
router.post('/', controller.createPurchaseOrder)
router.get('/', controller.listPurchaseOrders)
router.get('/:po_no', controller.getPurchaseOrder)
router.put('/:po_no', controller.updatePurchaseOrder)
router.delete('/:po_no', controller.deletePurchaseOrder)

// Actions
router.post('/:po_no/submit', controller.submitPurchaseOrder)

export default router