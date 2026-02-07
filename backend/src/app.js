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
const warehouseAllocationRoutes = require('./routes/warehouseAllocationRoutes');
const inventoryDashboardRoutes = require('./routes/inventoryDashboardRoutes');
const workstationRoutes = require('./routes/workstationRoutes');
const operationRoutes = require('./routes/operationRoutes');
const productionPlanRoutes = require('./routes/productionPlanRoutes');
const materialRequirementsRoutes = require('./routes/materialRequirementsRoutes');
const workOrderRoutes = require('./routes/workOrderRoutes');
const jobCardRoutes = require('./routes/jobCardRoutes');
const materialIssueRoutes = require('./routes/materialIssueRoutes');
const emailReceiver = require('./utils/realEmailReceiver');
const grnService = require('./services/grnService');
const qcService = require('./services/qcInspectionsService');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/authMiddleware');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

const allowedProdApis = require('./config/allowedProdApis');

const productionApiGuard = (req, res, next) => {
  const isProd = process.env.NODE_ENV?.trim() === 'production';
  
  if (!isProd) {
    return next();
  }

  const requestedPath = req.path || '';
  const originalUrl = req.originalUrl || '';

  // Allow health check
  if (requestedPath === '/' || requestedPath === '/health' || requestedPath === '/api/health') {
    if (req.method === 'GET') {
      return res.send('ERP API Running');
    }
    return next();
  }

  // Always allow auth and uploads in production
  if (requestedPath.startsWith('/auth') || requestedPath.startsWith('/uploads')) {
    return next();
  }

  // Ensure allowedProdApis is handled safely
  const apis = Array.isArray(allowedProdApis) ? allowedProdApis : [];
  
  const isAllowed = apis.some(api => {
    if (!api) return false;
    const cleanApi = api.startsWith('/') ? api : `/${api}`;
    return requestedPath.startsWith(cleanApi) || originalUrl.includes(cleanApi);
  });

  if (!isAllowed) {
    console.log(`[PRODUCTION BLOCKED] ${req.method} ${requestedPath}`);
    return res.status(403).json({ 
      message: 'Access denied in production',
      path: requestedPath,
      allowed: apis
    });
  }

  next();
};

app.use(productionApiGuard);

app.use('/auth', authRoutes);
app.use('/departments', departmentRoutes);

app.use(authenticate);

app.use('/users', userRoutes);
app.use('/access', departmentDocumentRoutes);
app.use('/companies', companyRoutes);
app.use('/customer-pos', customerPoRoutes);
app.use('/sales-orders', salesOrderRoutes);
app.use('/order', orderRoutes);
app.use('/design-orders', designOrderRoutes);
app.use('/vendors', vendorRoutes);
app.use('/quotations/communications', quotationCommunicationRoutes);
app.use('/quotations', quotationRoutes);
app.use('/quotation-requests', quotationRequestRoutes);
app.use('/purchase-orders', purchaseOrderRoutes);
app.use('/bom', bomRoutes);
app.use('/items', stockRoutes);
app.use('/drawings', drawingRoutes);
app.use('/po-receipts', poReceiptRoutes);
app.use('/grns', grnRoutes);
app.use('/grn-items', grnItemRoutes);
app.use('/qc-inspections', qcInspectionsRoutes);
app.use('/stock', stockRoutes);
app.use('/warehouse-allocations', warehouseAllocationRoutes);
app.use('/inventory', inventoryDashboardRoutes);
app.use('/workstations', workstationRoutes);
app.use('/operations', operationRoutes);
app.use('/production-plans', productionPlanRoutes);
app.use('/material-requirements', materialRequirementsRoutes);
app.use('/work-orders', workOrderRoutes);
app.use('/job-cards', jobCardRoutes);
app.use('/material-issues', materialIssueRoutes);
app.use('/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

// Start real email receiver to fetch replies
try {
  emailReceiver.startEmailReceiver();
} catch (error) {
  console.error('[App] Failed to start email receiver:', error.message);
}

module.exports = app;
