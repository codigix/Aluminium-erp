const path = require('path');
const routes = {
  companyRoutes: './src/routes/companyRoutes',
  customerPoRoutes: './src/routes/customerPoRoutes',
  salesOrderRoutes: './src/routes/salesOrderRoutes',
  orderRoutes: './src/routes/orderRoutes',
  designOrderRoutes: './src/routes/designOrderRoutes',
  dashboardRoutes: './src/routes/dashboardRoutes',
  authRoutes: './src/routes/authRoutes',
  departmentRoutes: './src/routes/departmentRoutes',
  userRoutes: './src/routes/userRoutes',
  departmentDocumentRoutes: './src/routes/departmentDocumentRoutes',
  vendorRoutes: './src/routes/vendorRoutes',
  quotationRoutes: './src/routes/quotationRoutes',
  quotationRequestRoutes: './src/routes/quotationRequestRoutes',
  quotationCommunicationRoutes: './src/routes/quotationCommunicationRoutes',
  purchaseOrderRoutes: './src/routes/purchaseOrderRoutes',
  bomRoutes: './src/routes/bomRoutes',
  drawingRoutes: './src/routes/drawingRoutes',
  poReceiptRoutes: './src/routes/poReceiptRoutes',
  grnRoutes: './src/routes/grnRoutes',
  grnItemRoutes: './src/routes/grnItemRoutes',
  qcInspectionsRoutes: './src/routes/qcInspectionsRoutes',
  stockRoutes: './src/routes/stockRoutes',
  warehouseAllocationRoutes: './src/routes/warehouseAllocationRoutes',
  inventoryDashboardRoutes: './src/routes/inventoryDashboardRoutes',
  workstationRoutes: './src/routes/workstationRoutes',
  operationRoutes: './src/routes/operationRoutes',
  productionPlanRoutes: './src/routes/productionPlanRoutes',
  materialRequirementsRoutes: './src/routes/materialRequirementsRoutes',
  workOrderRoutes: './src/routes/workOrderRoutes',
  jobCardRoutes: './src/routes/jobCardRoutes',
  materialIssueRoutes: './src/routes/materialIssueRoutes'
};

for (const [name, routePath] of Object.entries(routes)) {
  try {
    const route = require(routePath);
    if (!route) {
      console.log(`❌ ${name} is UNDEFINED`);
    } else if (typeof route !== 'function' && Object.keys(route).length === 0) {
        console.log(`❌ ${name} is an EMPTY OBJECT`);
    } else {
      console.log(`✅ ${name} is OK`);
    }
  } catch (error) {
    console.log(`💥 ${name} failed to load: ${error.message}`);
  }
}
