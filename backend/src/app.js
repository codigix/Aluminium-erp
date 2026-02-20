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
const emailReceiver = require('./utils/realEmailReceiver');
const grnService = require('./services/grnService');
const qcService = require('./services/qcInspectionsService');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/authMiddleware');
const { uploadsPath } = require('./config/uploadConfig');
const app = express();

app.use(cors());

// GLOBAL CATCH-ALL FOR UPLOADS (No Authentication can ever touch this)
// This handles /api/uploads, /uploads, and nested /uploads/uploads
app.use((req, res, next) => {
  // Use originalUrl as well for cases where req.url is modified by previous middleware or proxy
  const url = (req.originalUrl || req.url).toLowerCase();
  
  if (url.includes('/uploads/')) {
    const parts = url.split('/uploads/');
    let fileName = parts[parts.length - 1];
    
    // Remove query strings if any
    fileName = fileName.split('?')[0];
    
    const tryPaths = [
      path.join(uploadsPath, fileName),
      path.join(process.cwd(), 'uploads', fileName),
      path.join(process.cwd(), 'backend', 'uploads', fileName)
    ];

    const tryServe = (index) => {
      if (index >= tryPaths.length) return next();
      res.sendFile(tryPaths[index], (err) => {
        if (err) tryServe(index + 1);
      });
    };
    
    return tryServe(0);
  }
  next();
});

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
