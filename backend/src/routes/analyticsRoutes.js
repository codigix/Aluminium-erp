import express from 'express';
import BuyingAnalyticsController from '../controllers/BuyingAnalyticsController.js';

const router = express.Router();

// Analytics Summary
router.get('/buying/summary', BuyingAnalyticsController.getSummary);

// Trends and Forecasting
router.get('/buying/po-trends', BuyingAnalyticsController.getPOTrends);
router.get('/buying/cost-analysis', BuyingAnalyticsController.getCostAnalysis);

// Supplier Analytics
router.get('/buying/top-suppliers', BuyingAnalyticsController.getTopSuppliers);
router.get('/buying/supplier/:supplierId', BuyingAnalyticsController.getSupplierPerformance);

// Item Analytics
router.get('/buying/items', BuyingAnalyticsController.getItemPOSummary);
router.get('/buying/category', BuyingAnalyticsController.getPurchaseByCategory);

// Receipt Analytics
router.get('/buying/receipts', BuyingAnalyticsController.getReceiptAnalytics);
router.get('/buying/pending-grns', BuyingAnalyticsController.getPendingGRNs);

// Invoice Analytics
router.get('/buying/invoices', BuyingAnalyticsController.getInvoiceAnalytics);
router.get('/buying/aging', BuyingAnalyticsController.getAgingAnalysis);

// Status Alerts
router.get('/buying/overdue-pos', BuyingAnalyticsController.getOverduePOs);

export default router;