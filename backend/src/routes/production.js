import express from 'express'
import ProductionController from '../controllers/ProductionController.js'
import ProductionModel from '../models/ProductionModel.js'
import authMiddleware from '../middleware/authMiddleware.js'

export function createProductionRoutes(db) {
  const router = express.Router()
  const productionModel = new ProductionModel(db)
  const productionController = new ProductionController(productionModel)

  // ============= WORK ORDERS =============
  router.post(
    '/work-orders',
    authMiddleware,
    productionController.createWorkOrder.bind(productionController)
  )
  router.get(
    '/work-orders',
    authMiddleware,
    productionController.getWorkOrders.bind(productionController)
  )
  router.put(
    '/work-orders/:wo_id',
    authMiddleware,
    productionController.updateWorkOrder.bind(productionController)
  )

  // ============= PRODUCTION PLANS =============
  router.post(
    '/plans',
    authMiddleware,
    productionController.createProductionPlan.bind(productionController)
  )
  router.get(
    '/plans',
    authMiddleware,
    productionController.getProductionPlans.bind(productionController)
  )

  // ============= PRODUCTION ENTRIES =============
  router.post(
    '/entries',
    authMiddleware,
    productionController.createProductionEntry.bind(productionController)
  )
  router.get(
    '/entries',
    authMiddleware,
    productionController.getProductionEntries.bind(productionController)
  )

  // ============= REJECTIONS =============
  router.post(
    '/rejections',
    authMiddleware,
    productionController.recordRejection.bind(productionController)
  )
  router.get(
    '/rejections/analysis',
    authMiddleware,
    productionController.getRejectionAnalysis.bind(productionController)
  )

  // ============= MACHINES =============
  router.post(
    '/machines',
    authMiddleware,
    productionController.createMachine.bind(productionController)
  )
  router.get(
    '/machines',
    authMiddleware,
    productionController.getMachines.bind(productionController)
  )

  // ============= OPERATORS =============
  router.post(
    '/operators',
    authMiddleware,
    productionController.createOperator.bind(productionController)
  )
  router.get(
    '/operators',
    authMiddleware,
    productionController.getOperators.bind(productionController)
  )

  // ============= ANALYTICS =============
  router.get(
    '/analytics/dashboard',
    authMiddleware,
    productionController.getProductionDashboard.bind(productionController)
  )
  router.get(
    '/analytics/machine-utilization',
    authMiddleware,
    productionController.getMachineUtilization.bind(productionController)
  )
  router.get(
    '/analytics/operator-efficiency',
    authMiddleware,
    productionController.getOperatorEfficiency.bind(productionController)
  )

  return router
}

export default createProductionRoutes