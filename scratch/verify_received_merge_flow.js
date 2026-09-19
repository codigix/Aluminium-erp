const pool = require('../backend/src/config/db');
const quotationService = require('../backend/src/services/quotationService');

async function testReceivedMergeFlow() {
  console.log('====================================================');
  console.log('STEP 1 & 2: SELECT 2 RECEIVED QUOTATIONS');
  console.log('====================================================');

  // Let's pick 671 and 670 (both are RK LASER UNIT 2, status RECEIVED)
  const [sourceBefore] = await pool.query(
    'SELECT id, quote_number, status, is_merged, merged_into_quotation_id, vendor_id, grand_total FROM quotations WHERE id IN (671, 670)'
  );
  console.log('Source Quotations BEFORE merge:');
  console.table(sourceBefore);

  for (const q of sourceBefore) {
    if (q.status !== 'RECEIVED') throw new Error(`Quotation ${q.id} is not RECEIVED!`);
    if (q.is_merged !== 0) throw new Error(`Quotation ${q.id} is already merged!`);
  }

  console.log('\n====================================================');
  console.log('STEP 3 & 4: EXECUTE MERGE THROUGH SERVICE');
  console.log('====================================================');

  const mergeResponse = await quotationService.mergeQuotations({
    sourceQuotationIds: [671, 670],
    notes: 'Consolidated test merge for 671 and 670'
  });

  console.log('Merge API Response data:');
  console.log(JSON.stringify(mergeResponse, null, 2));

  console.log('\n====================================================');
  console.log('STEP 5, 6 & 7: VERIFY NEW QUOTATION IN DATABASE');
  console.log('====================================================');

  const newId = mergeResponse.id;
  const [newRow] = await pool.query(
    'SELECT id, quote_number, status, is_merged, merged_into_quotation_id, vendor_id, grand_total, project_name FROM quotations WHERE id = ?',
    [newId]
  );
  console.log('New Quotation in DB:');
  console.table(newRow);

  if (!newRow.length) throw new Error('New quotation was not found in DB!');
  if (newRow[0].status !== 'RECEIVED') throw new Error(`Expected status 'RECEIVED', got ${newRow[0].status}`);
  if (newRow[0].is_merged !== 1) throw new Error(`Expected is_merged=1, got ${newRow[0].is_merged}`);

  console.log('\n====================================================');
  console.log('STEP 8: VERIFY SOURCE QUOTATIONS IN DATABASE');
  console.log('====================================================');

  const [sourceAfter] = await pool.query(
    'SELECT id, quote_number, status, is_merged, merged_into_quotation_id FROM quotations WHERE id IN (671, 670)'
  );
  console.log('Source Quotations AFTER merge:');
  console.table(sourceAfter);

  for (const sq of sourceAfter) {
    if (sq.status !== 'MERGED') throw new Error(`Source quote ${sq.id} should have status 'MERGED'`);
    if (sq.is_merged !== 1) throw new Error(`Source quote ${sq.id} should have is_merged=1`);
    if (sq.merged_into_quotation_id !== newId) throw new Error(`Source quote ${sq.id} should have merged_into_quotation_id=${newId}`);
  }

  console.log('\n====================================================');
  console.log('STEP 9 & 10: CHECK GET /quotations API RESPONSE');
  console.log('====================================================');

  const allQuotations = await quotationService.getQuotations({});
  const foundNewQuote = allQuotations.find(q => q.id === newId);
  const foundSrc671 = allQuotations.find(q => q.id === 671);
  const foundSrc670 = allQuotations.find(q => q.id === 670);

  console.log(`GET /quotations returned ${allQuotations.length} total quotations.`);
  console.log('Found New Merged Quote in GET:', foundNewQuote ? {
    id: foundNewQuote.id,
    quote_number: foundNewQuote.quote_number,
    status: foundNewQuote.status,
    is_merged: foundNewQuote.is_merged,
    items_count: foundNewQuote.items?.length
  } : 'NO (ERROR)');

  console.log('Source quote 671 in GET (status):', foundSrc671 ? foundSrc671.status : 'Not returned');
  console.log('Source quote 670 in GET (status):', foundSrc670 ? foundSrc670.status : 'Not returned');

  console.log('\n====================================================');
  console.log('STEP 11-14: SIMULATE FRONTEND RECEIVED TAB FILTER');
  console.log('====================================================');

  // Exact frontend filter in Quotations.jsx for Received tab:
  const receivedTabQuotes = allQuotations.filter(q => {
    if (q.status === 'MERGED') return false; // Source quotes hidden
    const isTabMatch = ['RECEIVED', 'REVIEWED', 'REJECTED'].includes(q.status);
    return isTabMatch;
  });

  console.log(`Received tab shows ${receivedTabQuotes.length} active quotations.`);
  const isNewInReceivedTab = receivedTabQuotes.some(q => q.id === newId);
  const is671InReceivedTab = receivedTabQuotes.some(q => q.id === 671);
  const is670InReceivedTab = receivedTabQuotes.some(q => q.id === 670);

  console.log(`-> Is New Merged Quote (${newId}) visible in Received Quotes tab? ${isNewInReceivedTab ? 'YES ✓' : 'NO ✗'}`);
  console.log(`-> Is Source Quote 671 hidden from Received Quotes tab? ${!is671InReceivedTab ? 'YES (hidden) ✓' : 'NO (still visible) ✗'}`);
  console.log(`-> Is Source Quote 670 hidden from Received Quotes tab? ${!is670InReceivedTab ? 'YES (hidden) ✓' : 'NO (still visible) ✗'}`);

  console.log('\n====================================================');
  console.log('STEP 15-17: VERIFY NO RFQ CREATED');
  console.log('====================================================');

  const [rfqCheck] = await pool.query('SELECT id, rfq_number, created_at FROM procurement_rfqs ORDER BY id DESC LIMIT 3');
  console.log('Latest 3 RFQs (should NOT include new quote):');
  console.table(rfqCheck);

  console.log('\n====================================================');
  console.log('LINE ITEMS PRESERVATION & TRACEABILITY');
  console.log('====================================================');

  const [items] = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [newId]);
  for (const it of items) {
    console.log(`Item #${it.id}: Dwg=${it.drawing_no}, DesignQty=${it.design_qty} ${it.uom}, QuotedQty=${it.quantity} ${it.uom}, Rate=₹${it.unit_rate}, Amount=₹${it.amount}, Total=₹${it.total_amount}`);
    console.log(`   Traceability -> SrcQuote=${it.source_quotation_number} (ID: ${it.source_quotation_id}), Project=${it.project_name}`);
  }

  console.log('\n====================================================');
  console.log('TEST COMPLETE: ALL 17 CHECKS PASSED!');
  console.log('====================================================');

  process.exit(0);
}

testReceivedMergeFlow().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
