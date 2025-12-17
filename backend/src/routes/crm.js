import express from 'express'
import { SetupController } from '../controllers/SetupController.js'

const router = express.Router()

// CRM Routes
router.get('/contact-persons', SetupController.getContactPersons)
router.get('/sales-partners', SetupController.getSalesPartners)

export default router
