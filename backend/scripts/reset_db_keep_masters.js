const pool = require('../src/config/db');

async function resetDatabase() {
  const tablesToTruncate = [
    'production_plan_materials',
    'production_plan_operations',
    'production_plan_sub_assemblies',
    'production_plan_items',
    'production_plans',
    'job_card_time_logs',
    'job_card_quality_logs',
    'job_card_downtime_logs',
    'job_card_inward_item_rates',
    'job_cards',
    'work_order_material_consumption',
    'work_orders',
    'material_issue_items',
    'material_issues',
    'material_request_items',
    'material_requests',
    'grn_items',
    'grns',
    'grn_excess_approvals',
    'stock_entry_items',
    'stock_entries',
    'stock_ledger',
    'stock_balance',
    'delivery_challan_items',
    'delivery_challans',
    'inward_challan_items',
    'inward_challans',
    'outward_challan_items',
    'outward_challans',
    'purchase_order_items',
    'purchase_orders',
    'procurement_rfq_items',
    'procurement_rfqs',
    'po_receipt_items',
    'po_receipts',
    'sales_order_item_materials',
    'sales_order_item_components',
    'sales_order_item_operations',
    'sales_order_item_scrap',
    'sales_order_items',
    'sales_orders',
    'order_item_materials',
    'order_item_components',
    'order_item_operations',
    'order_item_scrap',
    'order_items',
    'orders',
    'quotation_items',
    'quotation_communications',
    'quotations',
    'quotation_requests',
    'customer_po_item_subassemblies',
    'customer_po_items',
    'customer_pos',
    'payments',
    'payment_receipts',
    'payment_vouchers',
    'customer_payments',
    'customer_ledger',
    'vendor_ledger',
    'shipment_order_items',
    'shipment_orders',
    'shipment_return_items',
    'shipment_returns',
    'shipment_tracking_logs',
    'inventory_postings',
    'inventory_dashboard',
    'inventory',
    'design_orders',
    'design_rejections',
    'qc_inspection_items',
    'qc_inspections',
    'qc_attachments',
    'bom_items',
    'bom_approval_history',
    'bom',
    'document_access_logs',
    'warehouse_allocations'
  ];

  const connection = await pool.getConnection();
  try {
    console.log('Starting database reset (keeping masters)...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tablesToTruncate) {
      try {
        await connection.query(`TRUNCATE TABLE ${table}`);
        console.log(`Truncated table: ${table}`);
      } catch (err) {
        console.warn(`Could not truncate table ${table}: ${err.message}`);
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Database reset completed successfully.');
  } catch (error) {
    console.error('Error resetting database:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

resetDatabase();
