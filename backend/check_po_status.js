const pool = require('./src/config/db');

async function checkPOStatus() {
  try {
    console.log('🔍 Checking purchase_orders status column...\n');

    // Get the column info
    const [columns] = await pool.query(`
      SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'sales_erp' 
      AND TABLE_NAME = 'purchase_orders' 
      AND COLUMN_NAME = 'status'
    `);

    if (columns.length === 0) {
      console.log('❌ Status column not found!');
      process.exit(1);
    }

    const columnType = columns[0].COLUMN_TYPE;
    console.log('📊 Current status column type:');
    console.log(`   ${columnType}\n`);

    // Extract enum values
    const enumMatch = columnType.match(/enum\((.*)\)/i);
    if (enumMatch) {
      const enumValues = enumMatch[1]
        .split(',')
        .map(v => v.trim().replace(/'/g, ''));
      
      console.log(`📋 Enum values (${enumValues.length}):`);
      enumValues.forEach(val => {
        const icon = val.includes('PAYMENT') ? '🟢' : '⚪';
        console.log(`   ${icon} ${val}`);
      });

      const hasPendingPayment = enumValues.includes('PENDING_PAYMENT');
      const hasApproved = enumValues.includes('APPROVED');
      const hasPaid = enumValues.includes('PAID');

      console.log('\n✅ Required values:');
      console.log(`   ${hasPendingPayment ? '✅' : '❌'} PENDING_PAYMENT`);
      console.log(`   ${hasApproved ? '✅' : '❌'} APPROVED`);
      console.log(`   ${hasPaid ? '✅' : '❌'} PAID`);

      if (!hasPendingPayment || !hasApproved || !hasPaid) {
        console.log('\n⚠️  Missing required ENUM values!');
        console.log('Need to run migration 012-add-payment-statuses.sql');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkPOStatus();
