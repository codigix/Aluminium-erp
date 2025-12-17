import express from 'express'
import { SetupController } from '../controllers/SetupController.js'

const router = express.Router()

// Setup Master Data Routes
router.get('/payment-terms', SetupController.getPaymentTerms)
router.get('/letter-heads', SetupController.getLetterHeads)
router.get('/campaigns', SetupController.getCampaigns)
router.get('/territories', SetupController.getTerritories)
router.get('/lead-sources', SetupController.getLeadSources)
router.get('/lost-reasons', SetupController.getLostReasons)
router.get('/tax-categories', SetupController.getTaxCategories)
router.get('/shipping-rules', SetupController.getShippingRules)
router.get('/incoterms', SetupController.getIncoterms)
router.get('/sales-taxes-charges-template', SetupController.getSalesTaxesChargesTemplate)
router.get('/cost-centers', SetupController.getCostCenters)
router.get('/projects', SetupController.getProjects)
router.get('/price-lists', SetupController.getPriceLists)
router.get('/account-heads', SetupController.getAccountHeads)

export default router
