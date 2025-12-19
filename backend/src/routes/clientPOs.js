import express from 'express'
import { ClientPOController } from '../controllers/ClientPOController.js'

const router = express.Router()

// Client PO Routes
router.post('/client-pos/create-full', ClientPOController.createFull)
router.post('/client-pos', ClientPOController.saveClientInfo)
router.get('/client-pos', ClientPOController.getAll)
router.get('/client-pos/:po_id', ClientPOController.getById)
router.get('/client-pos/:po_id/review', ClientPOController.getPOForReview)
router.get('/client-pos/:po_id/template', ClientPOController.renderPOTemplate)
router.get('/client-pos/:po_id/step-status', ClientPOController.getStepStatus)

// Step-wise save endpoints
router.post('/client-pos/:po_id/project', ClientPOController.saveProjectInfo)
router.post('/client-pos/:po_id/drawings', ClientPOController.saveDrawings)
router.post('/client-pos/:po_id/commercials', ClientPOController.saveCommercials)
router.post('/client-pos/:po_id/terms', ClientPOController.saveTermsAndAttachments)
router.post('/client-pos/:po_id/submit', ClientPOController.submitForApproval)
router.post('/client-pos/:po_id/accept', ClientPOController.acceptPO)

// Download endpoints
router.get('/client-pos/:po_id/download/pdf', ClientPOController.downloadPDF)
router.get('/client-pos/:po_id/download/excel', ClientPOController.downloadExcel)

// Import endpoint
router.post('/client-pos/import', ClientPOController.importFromExcel)

// Delete
router.delete('/client-pos/:po_id', ClientPOController.delete)

export default router
