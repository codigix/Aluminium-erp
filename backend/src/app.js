require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const companyRoutes = require('./routes/companyRoutes');
const customerPoRoutes = require('./routes/customerPoRoutes');
const salesOrderRoutes = require('./routes/salesOrderRoutes');
const orderRoutes = require('./routes/orderRoutes');
const designOrderRoutes = require('./routes/designOrderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentDocumentRoutes = require('./routes/departmentDocumentRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const quotationRequestRoutes = require('./routes/quotationRequestRoutes');
const quotationCommunicationRoutes = require('./routes/quotationCommunicationRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const bomRoutes = require('./routes/bomRoutes');
const drawingRoutes = require('./routes/drawingRoutes');
const poReceiptRoutes = require('./routes/poReceiptRoutes');
const grnRoutes = require('./routes/grnRoutes');
const grnItemRoutes = require('./routes/grnItemRoutes');
const qcInspectionsRoutes = require('./routes/qcInspectionsRoutes');
const stockRoutes = require('./routes/stockRoutes');
const stockEntryRoutes = require('./routes/stockEntryRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const warehouseAllocationRoutes = require('./routes/warehouseAllocationRoutes');
const inventoryDashboardRoutes = require('./routes/inventoryDashboardRoutes');
const workstationRoutes = require('./routes/workstationRoutes');
const operationRoutes = require('./routes/operationRoutes');
const productionPlanRoutes = require('./routes/productionPlanRoutes');
const materialRequirementsRoutes = require('./routes/materialRequirementsRoutes');
const workOrderRoutes = require('./routes/workOrderRoutes');
const jobCardRoutes = require('./routes/jobCardRoutes');
const materialIssueRoutes = require('./routes/materialIssueRoutes');
const materialRequestRoutes = require('./routes/materialRequestRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const finalQCRoutes = require('./routes/finalQCRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const deliveryChallanRoutes = require('./routes/deliveryChallanRoutes');
const customerPaymentRoutes = require('./routes/customerPaymentRoutes');
const bankAccountRoutes = require('./routes/bankAccountRoutes');
const emailReceiver = require('./utils/realEmailReceiver');
const grnService = require('./services/grnService');
const qcService = require('./services/qcInspectionsService');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/authMiddleware');
const { uploadsPath } = require('./config/uploadConfig');
const app = express();

// 1. ABSOLUTE PRIORITY: Public Uploads (No Auth)
// This catches requests before ANY other middleware can interfere
app.use((req, res, next) => {
  const url = (req.originalUrl || req.url).toLowerCase();
  if (url.includes('/uploads/')) {
    const parts = url.split('/uploads/');
    const fileName = parts[parts.length - 1].split('?')[0];
    
    // Try serving directly from configured uploadsPath
    return res.sendFile(path.join(uploadsPath, fileName), { headers: { 'X-Public-Upload': 'true' } }, (err) => {
      if (!err) return;
      
      // Fallback 1: Root uploads folder
      res.sendFile(path.join(process.cwd(), 'uploads', fileName), (err1) => {
        if (!err1) return;
        
        // Fallback 2: backend/uploads folder
        res.sendFile(path.join(process.cwd(), 'backend', 'uploads', fileName), (err2) => {
          if (err2) {
            // If file really doesn't exist, return 404 immediately to prevent hitting Private API
            res.status(404).json({ error: 'File not found on server', path: fileName });
          }
        });
      });
    });
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Route Grouping ---
const publicRouter = express.Router();
publicRouter.use('/auth', authRoutes);
publicRouter.use('/departments', departmentRoutes);

const privateRouter = express.Router();
privateRouter.use(authenticate);
privateRouter.use('/users', userRoutes);
privateRouter.use('/access', departmentDocumentRoutes);
privateRouter.use('/companies', companyRoutes);
privateRouter.use('/customer-pos', customerPoRoutes);
privateRouter.use('/sales-orders', salesOrderRoutes);
privateRouter.use('/order', orderRoutes);
privateRouter.use('/design-orders', designOrderRoutes);
privateRouter.use('/vendors', vendorRoutes);
privateRouter.use('/suppliers', vendorRoutes);
privateRouter.use('/quotations/communications', quotationCommunicationRoutes);
privateRouter.use('/quotations', quotationRoutes);
privateRouter.use('/quotation-requests', quotationRequestRoutes);
privateRouter.use('/purchase-orders', purchaseOrderRoutes);
privateRouter.use('/bom', bomRoutes);
privateRouter.use('/items', stockRoutes);
privateRouter.use('/drawings', drawingRoutes);
privateRouter.use('/po-receipts', poReceiptRoutes);
privateRouter.use('/grns', grnRoutes);
privateRouter.use('/grn-items', grnItemRoutes);
privateRouter.use('/qc-inspections', qcInspectionsRoutes);
privateRouter.use('/stock', stockRoutes);
privateRouter.use('/stock-entries', stockEntryRoutes);
privateRouter.use('/warehouses', warehouseRoutes);
privateRouter.use('/warehouse-allocations', warehouseAllocationRoutes);
privateRouter.use('/inventory', inventoryDashboardRoutes);
privateRouter.use('/workstations', workstationRoutes);
privateRouter.use('/operations', operationRoutes);
privateRouter.use('/production-plans', productionPlanRoutes);
privateRouter.use('/material-requirements', materialRequirementsRoutes);
privateRouter.use('/work-orders', workOrderRoutes);
privateRouter.use('/job-cards', jobCardRoutes);
privateRouter.use('/material-issues', materialIssueRoutes);
privateRouter.use('/material-requests', materialRequestRoutes);
privateRouter.use('/payments', paymentRoutes);
privateRouter.use('/customer-payments', customerPaymentRoutes);
privateRouter.use('/bank-accounts', bankAccountRoutes);
privateRouter.use('/final-qc', finalQCRoutes);
privateRouter.use('/shipments', shipmentRoutes);
privateRouter.use('/delivery-challans', deliveryChallanRoutes);
privateRouter.use('/dashboard', dashboardRoutes);

const apiRouter = express.Router();
apiRouter.use(publicRouter);
apiRouter.use(privateRouter);

app.use('/api', apiRouter);
app.use('/', apiRouter);

// Also serve at the root level just in case
app.use('/uploads', express.static(uploadsPath));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(notFound);
app.use(errorHandler);

// Start real email receiver to fetch replies
try {
  emailReceiver.startEmailReceiver();
} catch (error) {
  console.error('[App] Failed to start email receiver:', error.message);
}

module.exports = app;
