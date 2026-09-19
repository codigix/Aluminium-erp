const quotationService = require('../backend/src/services/quotationService');

async function testGetQuotations() {
  console.log('Testing getQuotations()...');
  const quotes = await quotationService.getQuotations({});
  console.log(`getQuotations returned ${quotes.length} quotations.`);

  // Find id 673, 672, 671
  const q673 = quotes.find(q => q.id === 673);
  const q672 = quotes.find(q => q.id === 672);
  const q671 = quotes.find(q => q.id === 671);

  console.log('673 (NEW MERGED):', q673 ? { id: q673.id, quote_number: q673.quote_number, status: q673.status, is_merged: q673.is_merged } : 'NOT FOUND');
  console.log('672 (SOURCE):', q672 ? { id: q672.id, quote_number: q672.quote_number, status: q672.status, is_merged: q672.is_merged } : 'NOT FOUND');
  console.log('671 (SOURCE):', q671 ? { id: q671.id, quote_number: q671.quote_number, status: q671.status, is_merged: q671.is_merged } : 'NOT FOUND');

  process.exit(0);
}

testGetQuotations().catch(err => {
  console.error(err);
  process.exit(1);
});
