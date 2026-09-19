const pool = require('./src/config/db');
const quotationService = require('./src/services/quotationService');

async function testClientMerge() {
  console.log('--- STARTING CLIENT NAME & MERGE E2E TEST ---');

  // Find two active received quotes for RK LASER UNIT 2 (vendor_id = 70)
  const [quotes] = await pool.query(`
    SELECT q.id, q.quote_number, q.vendor_id, q.status, q.is_merged,
           COALESCE(
             q.client_name,
             c_ord.company_name,
             c_so.company_name,
             c.company_name,
             'Internal'
           ) as resolved_client_name,
           COALESCE(
             q.project_name,
             so.project_name,
             (SELECT so2.project_name FROM sales_orders so2 JOIN production_plans pp ON so2.id = pp.sales_order_id WHERE pp.id = mr.plan_id),
             mr.purpose,
             'General Procurement'
           ) as resolved_project_name
    FROM quotations q
    LEFT JOIN vendors v ON v.id = q.vendor_id
    LEFT JOIN sales_orders so ON so.id = q.sales_order_id
    LEFT JOIN companies c ON c.id = so.company_id
    LEFT JOIN material_requests mr ON mr.id = q.mr_id
    LEFT JOIN procurement_rfqs r ON r.id = q.rfq_id
    LEFT JOIN production_plans pp ON mr.plan_id = pp.id
    LEFT JOIN orders o ON pp.sales_order_id = o.id
    LEFT JOIN companies c_ord ON o.client_id = c_ord.id
    LEFT JOIN sales_orders so_pp ON pp.sales_order_id = so_pp.id
    LEFT JOIN companies c_so ON so_pp.company_id = c_so.id
    WHERE q.vendor_id = 70 AND q.status = 'RECEIVED' AND q.is_merged = 0
    ORDER BY q.id DESC
  `);

  console.log(`Found ${quotes.length} eligible unmerged received quotes for vendor 70:`);
  console.table(quotes.map(q => ({
    id: q.id,
    quote_number: q.quote_number,
    client: q.resolved_client_name,
    project: q.resolved_project_name
  })));

  // Pick one with Sidel and one with Codigix if possible
  const sidelQuote = quotes.find(q => q.resolved_client_name.includes('Sidel'));
  const codigixQuote = quotes.find(q => q.resolved_client_name.includes('codigix'));

  if (!sidelQuote || !codigixQuote) {
    console.error('Could not find one Sidel and one Codigix quote among unmerged quotes.');
    process.exit(1);
  }

  console.log(`Testing merge with distinct clients:`);
  console.log(`- Source Quote 1: ID ${sidelQuote.id} (${sidelQuote.quote_number}) -> Client: ${sidelQuote.resolved_client_name}`);
  console.log(`- Source Quote 2: ID ${codigixQuote.id} (${codigixQuote.quote_number}) -> Client: ${codigixQuote.resolved_client_name}`);

  // Call mergeQuotations
  const result = await quotationService.mergeQuotations({
    sourceQuotationIds: [sidelQuote.id, codigixQuote.id],
    notes: 'Test merge with different clients'
  });

  console.log('\n--- MERGE RESULT ---');
  console.log(result);

  // 1. Query new quotation from DB
  const [newQuoteRows] = await pool.query(
    'SELECT id, quote_number, status, is_merged, client_name, project_name, total_amount, grand_total FROM quotations WHERE id = ?',
    [result.id]
  );
  console.log('\n--- NEW QUOTATION DB RECORD ---');
  console.table(newQuoteRows);

  if (newQuoteRows[0].client_name !== 'Multiple Clients') {
    throw new Error(`Expected client_name = 'Multiple Clients', got: ${newQuoteRows[0].client_name}`);
  }
  if (newQuoteRows[0].status !== 'RECEIVED' || newQuoteRows[0].is_merged !== 1) {
    throw new Error('New quotation status or is_merged incorrect');
  }

  // 2. Query items of new quotation
  const [itemRows] = await pool.query(
    'SELECT id, quotation_id, drawing_no, source_quotation_number, client_name, project_name, quantity, design_qty, unit_rate, amount FROM quotation_items WHERE quotation_id = ?',
    [result.id]
  );
  console.log('\n--- NEW QUOTATION LINE ITEMS DB RECORDS ---');
  console.table(itemRows);

  const clientNames = itemRows.map(i => i.client_name);
  console.log('Line items client_names:', clientNames);
  if (!clientNames.some(c => c.includes('Sidel')) || !clientNames.some(c => c.includes('codigix'))) {
    throw new Error('Expected line items to preserve individual source client names!');
  }

  // 3. Test getQuotations service call
  const list = await quotationService.getQuotations();
  const mergedInList = list.find(q => q.id === result.id);
  console.log('\n--- RETURNED BY GET QUOTATIONS SERVICE ---');
  console.log({
    id: mergedInList?.id,
    quote_number: mergedInList?.quote_number,
    company_name: mergedInList?.company_name,
    client_name: mergedInList?.client_name,
    project_name: mergedInList?.project_name,
    items_count: mergedInList?.items?.length
  });

  if (mergedInList?.company_name !== 'Multiple Clients') {
    throw new Error(`Expected company_name in list to be 'Multiple Clients', got: ${mergedInList?.company_name}`);
  }

  console.log('\nAll checks passed successfully!');

  // Cleanup test quote so browser test is pristine
  console.log('\nCleaning up test quote and restoring source quotes...');
  await pool.query('DELETE FROM quotation_items WHERE quotation_id = ?', [result.id]);
  await pool.query('DELETE FROM quotations WHERE id = ?', [result.id]);
  await pool.query(
    "UPDATE quotations SET status = 'RECEIVED', is_merged = 0, merged_into_quotation_id = NULL WHERE id IN (?, ?)",
    [sidelQuote.id, codigixQuote.id]
  );
  console.log('Cleanup completed. Source quotes restored to pristine unmerged RECEIVED status.');

  process.exit(0);
}

testClientMerge().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
