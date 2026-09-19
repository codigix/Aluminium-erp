const pool = require('../backend/src/config/db');
const quotationService = require('../backend/src/services/quotationService');

async function runTest() {
  console.log('=== TESTING MERGE RECEIVED QUOTATIONS ===');

  // 1. Find 2 received quotations for the same vendor that are not already merged
  const [quotes] = await pool.query(`
    SELECT q.id, q.quote_number, q.vendor_id, q.status, q.grand_total, v.vendor_name
    FROM quotations q
    JOIN vendors v ON v.id = q.vendor_id
    WHERE q.status = 'RECEIVED'
      AND (q.is_merged IS NULL OR q.is_merged = 0)
      AND q.merged_into_quotation_id IS NULL
    ORDER BY q.vendor_id, q.id DESC
  `);

  console.log(`Found ${quotes.length} eligible received quotations.`);

  // Group by vendor
  const vendorMap = {};
  for (const q of quotes) {
    if (!vendorMap[q.vendor_id]) vendorMap[q.vendor_id] = [];
    vendorMap[q.vendor_id].push(q);
  }

  const eligibleVendorId = Object.keys(vendorMap).find(vId => vendorMap[vId].length >= 2);

  if (!eligibleVendorId) {
    console.log('No vendor has 2+ received quotations currently. Creating 2 mock received quotations for testing...');
    
    // Pick first vendor
    const [allVendors] = await pool.query('SELECT id, vendor_name FROM vendors LIMIT 1');
    const vendorId = allVendors[0].id;

    // Create quote A
    const quoteA = await quotationService.createQuotation({
      vendorId,
      status: 'RECEIVED',
      items: [
        {
          item_code: 'TEST-ITEM-1',
          description: 'Test Item 1',
          drawing_no: 'DWG-001',
          material_name: 'Aluminium Plate',
          quantity: 2,
          design_qty: 2,
          uom: 'Nos',
          unit_rate: 10,
          gst_percentage: 18
        }
      ]
    });

    // Create quote B
    const quoteB = await quotationService.createQuotation({
      vendorId,
      status: 'RECEIVED',
      items: [
        {
          item_code: 'TEST-ITEM-2',
          description: 'Test Item 2',
          drawing_no: 'DWG-002',
          material_name: 'Aluminium Bar',
          quantity: 5,
          design_qty: 5,
          uom: 'Nos',
          unit_rate: 20,
          gst_percentage: 18
        }
      ]
    });

    console.log(`Created test quotes: A=${quoteA.quote_number} (ID: ${quoteA.id}), B=${quoteB.quote_number} (ID: ${quoteB.id})`);

    const mergeResult = await quotationService.mergeQuotations({
      sourceQuotationIds: [quoteA.id, quoteB.id],
      notes: 'Test merge automated check'
    });

    console.log('Merge Result:', JSON.stringify(mergeResult, null, 2));
    await verifyMergeResult(mergeResult.id, [quoteA.id, quoteB.id]);
  } else {
    const candidateQuotes = vendorMap[eligibleVendorId].slice(0, 2);
    console.log(`Using vendor ${candidateQuotes[0].vendor_name} (ID: ${eligibleVendorId}) with quotes:`,
      candidateQuotes.map(q => `${q.quote_number} (ID: ${q.id})`)
    );

    const mergeResult = await quotationService.mergeQuotations({
      sourceQuotationIds: candidateQuotes.map(q => q.id),
      notes: 'Test merge of existing received quotes'
    });

    console.log('Merge Result:', JSON.stringify(mergeResult, null, 2));
    await verifyMergeResult(mergeResult.id, candidateQuotes.map(q => q.id));
  }

  process.exit(0);
}

async function verifyMergeResult(newQuotationId, sourceIds) {
  console.log('\n--- VERIFYING MERGE RESULT ---');

  // 1. Verify new quotation header
  const [newQuotes] = await pool.query('SELECT * FROM quotations WHERE id = ?', [newQuotationId]);
  const newQ = newQuotes[0];
  console.log(`New Quotation: ID=${newQ.id}, QuoteNo=${newQ.quote_number}, Status=${newQ.status}, is_merged=${newQ.is_merged}`);
  if (newQ.status !== 'RECEIVED') {
    throw new Error(`Expected new quotation status 'RECEIVED', got '${newQ.status}'`);
  }
  if (newQ.is_merged !== 1) {
    throw new Error(`Expected new quotation is_merged=1, got ${newQ.is_merged}`);
  }

  // 2. Verify source quotations status
  const [srcQuotes] = await pool.query('SELECT id, quote_number, status, is_merged, merged_into_quotation_id FROM quotations WHERE id IN (?)', [sourceIds]);
  for (const sq of srcQuotes) {
    console.log(`Source Quote: ID=${sq.id}, QuoteNo=${sq.quote_number}, Status=${sq.status}, is_merged=${sq.is_merged}, merged_into=${sq.merged_into_quotation_id}`);
    if (sq.status !== 'MERGED') {
      throw new Error(`Expected source quote ${sq.id} status 'MERGED', got '${sq.status}'`);
    }
    if (sq.merged_into_quotation_id !== newQuotationId) {
      throw new Error(`Expected source quote ${sq.id} merged_into_quotation_id ${newQuotationId}, got ${sq.merged_into_quotation_id}`);
    }
  }

  // 3. Verify items
  const [items] = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = ?', [newQuotationId]);
  console.log(`New Quotation has ${items.length} items:`);
  for (const item of items) {
    console.log(`  Item: Code=${item.item_code}, Dwg=${item.drawing_no}, DesignQty=${item.design_qty} ${item.uom}, QuotedQty=${item.quantity} ${item.uom}, Rate=₹${item.unit_rate}, Amount=₹${item.amount}, Total=₹${item.total_amount}, SrcQuote=${item.source_quotation_number} (ID: ${item.source_quotation_id})`);
    if (!item.source_quotation_number || !item.source_quotation_id) {
      throw new Error('Item missing source quotation traceability');
    }
  }

  console.log('\n=== ALL VERIFICATIONS PASSED! ===');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
