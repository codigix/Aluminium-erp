require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const companyRoutes = require('./routes/companyRoutes');
const customerPoRoutes = require('./routes/customerPoRoutes');
const salesOrderRoutes = require('./routes/salesOrderRoutes');
const designOrderRoutes = require('./routes/designOrderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentDocumentRoutes = require('./routes/departmentDocumentRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const quotationRequestRoutes = require('./routes/quotationRequestRoutes');
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
const grnService = require('./services/grnService');
const qcService = require('./services/qcInspectionsService');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/authMiddleware');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);

// Public PDF routes - must be defined before authenticated routes
app.get('/api/sales-orders/:id/pdf', require('./controllers/salesOrderController').generateSalesOrderPDF);
app.get('/api/quotations/:quotationId/pdf', require('./controllers/quotationController').getQuotationPDF);

app.use('/api/users', authenticate, userRoutes);
app.use('/api/access', authenticate, departmentDocumentRoutes);
app.use('/api/companies', authenticate, companyRoutes);
app.use('/api/customer-pos', authenticate, customerPoRoutes);
app.use('/api/sales-orders', authenticate, salesOrderRoutes);
app.use('/api/design-orders', authenticate, designOrderRoutes);
app.use('/api/vendors', authenticate, vendorRoutes);
app.use('/api/quotations', authenticate, quotationRoutes);
app.use('/api/quotation-requests', authenticate, quotationRequestRoutes);
app.use('/api/purchase-orders', authenticate, purchaseOrderRoutes);
app.use('/api/bom', authenticate, bomRoutes);
app.use('/api/drawings', authenticate, drawingRoutes);
app.use('/api/po-receipts', authenticate, poReceiptRoutes);
app.use('/api/grns', authenticate, grnRoutes);
app.use('/api/grn-items', authenticate, grnItemRoutes);
app.use('/api/qc-inspections', authenticate, qcInspectionsRoutes);
app.use('/api/stock', authenticate, stockRoutes);
app.use('/api/warehouse-allocations', authenticate, warehouseAllocationRoutes);
app.use('/api/inventory', authenticate, inventoryDashboardRoutes);
app.use('/api/workstations', authenticate, workstationRoutes);
app.use('/api/operations', authenticate, operationRoutes);
app.use('/api/production-plans', authenticate, productionPlanRoutes);
app.use('/api/material-requirements', authenticate, materialRequirementsRoutes);
app.use('/api/work-orders', authenticate, workOrderRoutes);
app.use('/api/job-cards', authenticate, jobCardRoutes);
app.use('/api/material-issues', authenticate, materialIssueRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);

app.get('/api/grn-stats', authenticate, async (req, res) => {
  try {
    const stats = await grnService.getGRNStats();
    res.json(stats);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.get('/api/qc-stats', authenticate, async (req, res) => {
  try {
    const stats = await qcService.getQCStats();
    res.json(stats);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
