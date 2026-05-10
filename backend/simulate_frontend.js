const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'aluminium_user',
    password: process.env.DB_PASSWORD || 'C0digix$309',
    database: process.env.DB_NAME || 'sales_erp',
    port: process.env.DB_PORT || 3307
  });

  try {
    const status = 'SENT,DRAFT,REVISED,Revised,Approved,Accepted,REJECTED,Completed';
    const statusArray = status.split(',').map(s => s.trim());
    const query = `
      SELECT qr.*, c.company_name 
      FROM quotation_requests qr
      JOIN companies c ON c.id = qr.company_id
      WHERE TRIM(qr.status) IN (${statusArray.map(() => '?').join(',')})
      ORDER BY qr.created_at DESC
    `;
    const [data] = await connection.query(query, statusArray);

    console.log('Exact statuses in DB:');
    console.log(data.map(r => r.status));

    // 1. Group items by their batch_id AND version
    const versionBatches = {};
    data.forEach(quote => {
      const bId = quote.batch_id ? `${quote.batch_id}_v${quote.version || 1}` : `legacy_${quote.company_id}_${Math.floor(new Date(quote.created_at).getTime() / 60000)}_v${quote.version || 1}`;
      if (!versionBatches[bId]) {
        versionBatches[bId] = {
          version: quote.version || 1,
          created_at: quote.created_at,
          items: []
        };
      }
      versionBatches[bId].items.push(quote);
    });

    console.log(`Version Batches count: ${Object.keys(versionBatches).length}`);

    // 2. Consolidate Versions into Quotation Chains
    const grouped = {};
    Object.values(versionBatches).forEach(batch => {
      const statusPriority = { 'REVISED': 5, 'SENT': 4, 'DRAFT': 3, 'APPROVED': 2, 'COMPLETED': 1, 'COMPONENT': 0 };
      const getPriority = (s) => statusPriority[(s || '').trim().toUpperCase()] || 0;

      const leadItem = [...batch.items].sort((a, b) => getPriority(b.status) - getPriority(a.status))[0] || batch.items[0];
      const rootId = leadItem.parent_id || leadItem.id;
      const chainKey = `chain_${rootId}`;

      const currentVer = parseInt(batch.version || 1);

      if (!grouped[chainKey]) {
        grouped[chainKey] = {
          id: leadItem.id,
          display_id: rootId,
          status: leadItem.status,
          version: currentVer,
          company_name: leadItem.company_name
        };
      } else {
        if (currentVer > grouped[chainKey].version || (currentVer === grouped[chainKey].version && getPriority(leadItem.status) > getPriority(grouped[chainKey].status))) {
          grouped[chainKey].id = leadItem.id;
          grouped[chainKey].status = leadItem.status;
          grouped[chainKey].version = currentVer;
        }
      }
    });

    console.log(`Grouped Chains count: ${Object.keys(grouped).length}`);
    console.log('Chains:', grouped);

    // 3. Filter chains
    const filtered = Object.values(grouped).filter(group => {
      const s = (group.status || '').trim().toUpperCase();
      return ['SENT', 'DRAFT', 'REVISED'].includes(s);
    });

    console.log(`Filtered count: ${filtered.length}`);
    console.log('Filtered:', filtered);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

check();
