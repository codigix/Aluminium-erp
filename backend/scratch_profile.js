const mysql = require('mysql2/promise');
require('dotenv').config();

async function profile() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3307,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spTech_dev'
  };

  console.log('Connecting to database:', { host: config.host, port: config.port, database: config.database });
  const connection = await mysql.createConnection(config);

  const startRange = '2026-04-01';
  const endRange = new Date().toISOString().split('T')[0];
  const customer = 'All';

  let dateFilter = ' AND DATE(created_at) BETWEEN ? AND ?';
  let params = [startRange, endRange];

  let customerFilter = '';
  if (customer && customer !== 'All') {
    customerFilter = ' AND c.company_name = ?';
  }

  const runQuery = async (name, sql, queryParams) => {
    const t0 = Date.now();
    const [rows] = await connection.execute(sql, queryParams);
    const duration = Date.now() - t0;
    console.log(`Query "${name}" took ${duration} ms (returned ${rows.length === undefined ? 1 : rows.length} rows)`);
    return duration;
  };

  try {
    // Query 1
    await runQuery('1. Quotation Activity', `
      SELECT 
        COUNT(DISTINCT COALESCE(qr.parent_id, qr.id)) as totalQuotes,
        COUNT(DISTINCT CASE WHEN qr.status IN ('SENT', 'RECEIVED') THEN COALESCE(qr.parent_id, qr.id) END) as sentQuotes,
        COUNT(DISTINCT CASE WHEN qr.status IN ('Approved', 'Approved ', 'COMPLETED', 'Completed', 'ACCEPTED', 'Accepted', 'APPROVED') THEN COALESCE(qr.parent_id, qr.id) END) as approvedQuotes,
        COUNT(DISTINCT CASE WHEN qr.status = 'REJECTED' THEN COALESCE(qr.parent_id, qr.id) END) as rejectedQuotes
      FROM quotation_requests qr
      JOIN companies c ON qr.company_id = c.id
      WHERE 1=1
      ${dateFilter.replace('created_at', 'qr.created_at')}
      ${customerFilter}
    `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

    // Query 2
    await runQuery('2. Converted Orders & All Orders', `
      SELECT 
        COUNT(*) as totalSalesOrders,
        SUM(CASE WHEN o.source_type = 'QUOTATION' OR o.source_type = 'DRAWING' THEN 1 ELSE 0 END) as convertedOrders 
      FROM orders o
      JOIN companies c ON o.client_id = c.id
      WHERE o.status != 'CANCELLED'
      ${dateFilter.replace('created_at', 'o.created_at')}
      ${customerFilter}
    `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

    // Query 3
    await runQuery('2.1 Customer POs Activity', `
      SELECT 
        COUNT(*) as totalCustomerPos
      FROM customer_pos cp
      JOIN companies c ON cp.company_id = c.id
      WHERE cp.status != 'CANCELLED'
      ${dateFilter.replace('created_at', 'cp.created_at')}
      ${customerFilter}
    `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

    // Query 4
    await runQuery('3. Sales Trend', `
      SELECT 
        DATE_FORMAT(date_list.date, '%d %b') as name,
        COALESCE(SUM(o.grand_total), 0) as value
      FROM (
        SELECT CURRENT_DATE - INTERVAL 29 DAY as date UNION ALL
        SELECT CURRENT_DATE - INTERVAL 28 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 27 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 26 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 25 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 24 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 23 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 22 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 21 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 20 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 19 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 18 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 17 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 16 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 15 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 14 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 13 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 12 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 11 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 10 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 9 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 8 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 7 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 6 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 5 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 4 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 3 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 2 DAY UNION ALL
        SELECT CURRENT_DATE - INTERVAL 1 DAY UNION ALL
        SELECT CURRENT_DATE
      ) date_list
      LEFT JOIN orders o ON DATE(o.created_at) = date_list.date AND o.status != 'CANCELLED'
      LEFT JOIN companies c ON o.client_id = c.id
      WHERE 1=1 ${customerFilter}
      GROUP BY date_list.date
      ORDER BY date_list.date ASC
    `, customer && customer !== 'All' ? [customer] : []);

    // Query 5
    await runQuery('5. Recent Activity', `
      (SELECT 
        'QUOTE_APPROVED' as type,
        CONCAT('QRT-', LPAD(qr.id, 4, '0')) as ref,
        'Approved' as status,
        c.company_name as customer,
        qr.created_at as time
      FROM quotation_requests qr
      JOIN companies c ON c.id = qr.company_id
      WHERE qr.status IN ('Approved', 'Approved ', 'COMPLETED', 'Completed', 'APPROVED')
      ${customerFilter}
      ORDER BY qr.created_at DESC LIMIT 3)
      UNION ALL
      (SELECT 
        'ORDER_CREATED' as type,
        order_no as ref,
        'Created' as status,
        c.company_name as customer,
        o.created_at as time
      FROM orders o
      JOIN companies c ON c.id = o.client_id
      WHERE 1=1 ${customerFilter}
      ORDER BY o.created_at DESC LIMIT 2)
      ORDER BY time DESC LIMIT 5
    `, [...(customer && customer !== 'All' ? [customer, customer] : [])]);

    // Query 6
    await runQuery('6. Approved Quotations', `
      SELECT 
        CONCAT('QRT-', LPAD(qr.id, 4, '0')) as id,
        c.company_name as customer,
        qr.total_amount as amount,
        DATE_FORMAT(qr.created_at, '%d %b %Y') as date
      FROM quotation_requests qr
      JOIN companies c ON qr.company_id = c.id
      WHERE qr.status IN ('Approved', 'Approved ', 'COMPLETED', 'Completed', 'APPROVED')
      ${dateFilter.replace('created_at', 'qr.created_at')}
      ${customerFilter}
      ORDER BY qr.created_at DESC LIMIT 50
    `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

    // Query 7
    await runQuery('7. Active Clients', `
      SELECT 
        c.id,
        c.company_name as name,
        LEFT(c.company_name, 2) as initials,
        c.company_code as sub,
        COUNT(o.id) as orders,
        SUM(o.grand_total) as value,
        DATE_FORMAT(MAX(o.created_at), '%d %b %Y') as lastDate
      FROM companies c
      JOIN orders o ON c.id = o.client_id
      WHERE o.status != 'CANCELLED'
      ${dateFilter.replace('created_at', 'o.created_at')}
      GROUP BY c.id
      ORDER BY value DESC LIMIT 50
    `, params);

    // Query 8
    await runQuery('8. Sales Orders Detailed Table', `
      SELECT 
        o.id as id_val,
        o.public_id,
        o.order_no as id,
        c.company_name as customer,
        LEFT(c.company_name, 2) as initials,
        c.company_code as sub,
        DATE_FORMAT(o.created_at, '%d %b %Y') as date,
        DATE_FORMAT(o.delivery_date, '%d %b %Y') as delivery,
        o.grand_total as total,
        o.status
      FROM orders o
      JOIN companies c ON o.client_id = c.id
      WHERE o.status != 'CANCELLED'
      ${dateFilter.replace('created_at', 'o.created_at')}
      ${customerFilter}
      ORDER BY o.created_at DESC LIMIT 50
    `, [...params, ...(customer && customer !== 'All' ? [customer] : [])]);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

profile();
