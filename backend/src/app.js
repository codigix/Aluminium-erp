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

// 🔐 PRODUCTION API LOCKDOWN
const allowedProdApis = [
  '/api/auth/login',
  '/api/quotations/communications',
  '/api/quotation-requests',
  '/api/order'
];

const productionApiGuard = (req, res, next) => {
  const isProd = process.env.NODE_ENV?.trim() === 'production';
  
  if (!isProd) {
    return next();
  }

  // Allow health check
  if (req.path === '/' || req.path === '/api' || req.path === '/api/') {
    return res.send('ERP API Running');
  }

  const isAllowed = allowedProdApis.some(api => 
    req.path.includes(api) || req.originalUrl.includes(api)
  );

  if (!isAllowed && !req.path.startsWith('/uploads')) {
    console.log(`[PRODUCTION BLOCKED] ${req.method} ${req.path}`);
    return res.status(403).json({ 
      message: 'Access denied in production',
      path: req.path,
      allowed: allowedProdApis
    });
  }

  next();
};

app.use(productionApiGuard);

app.use('/api/auth', authRoutes);

// Remove the redundant secondary guard block below
app.use('/api/departments', departmentRoutes);

app.use(authenticate);

app.use('/api/users', userRoutes);
app.use('/api/access', departmentDocumentRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/customer-pos', customerPoRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/design-orders', designOrderRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/quotations/communications', quotationCommunicationRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/quotation-requests', quotationRequestRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/bom', bomRoutes);
app.use('/api/items', stockRoutes);
app.use('/api/drawings', drawingRoutes);
app.use('/api/po-receipts', poReceiptRoutes);
app.use('/api/grns', grnRoutes);
app.use('/api/grn-items', grnItemRoutes);
app.use('/api/qc-inspections', qcInspectionsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/warehouse-allocations', warehouseAllocationRoutes);
app.use('/api/inventory', inventoryDashboardRoutes);
app.use('/api/workstations', workstationRoutes);
app.use('/api/operations', operationRoutes);
app.use('/api/production-plans', productionPlanRoutes);
app.use('/api/material-requirements', materialRequirementsRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/job-cards', jobCardRoutes);
app.use('/api/material-issues', materialIssueRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

// Start real email receiver to fetch replies
emailReceiver.startEmailReceiver();

module.exports = app;
