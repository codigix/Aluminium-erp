# Aluminium ERP System Analysis & Database Management

## System Overview
This ERP system manages the end-to-end workflow for an aluminium manufacturing business, from initial customer inquiry to final shipment and payment.

### Key Workflows
1. **Sales to Design**: Sales orders trigger drawing requirements.
2. **Design to Procurement**: BOM submission triggers material requirements.
3. **Procurement to Production**: Material availability allows production to start.
4. **Production to QC**: Completed items undergo final quality checks.
5. **QC to Shipment**: Approved items are cleared for dispatch.

## Database Table Summary
| Category | Tables |
|----------|--------|
| **Core** | `departments`, `roles`, `users`, `permissions`, `role_permissions` |
| **Sales** | `companies`, `company_addresses`, `contacts`, `customer_pos`, `customer_po_items`, `sales_orders`, `sales_order_items` |
| **Procurement** | `vendors`, `quotations`, `quotation_items`, `purchase_orders`, `purchase_order_items` |
| **Operations** | `production_plans`, `work_orders`, `operations`, `bom`, `bom_items` |
| **Inventory/QC**| `grns`, `qc_inspections`, `stock_ledger`, `stock_balances` |

---

## Full Code: Truncate All Tables Script
This Node.js script connects to the database, retrieves all table names, and truncates them while maintaining schema integrity.

```javascript
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function truncateAllTables() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sales_erp'
    };

    const connection = await mysql.createConnection(config);

    try {
        console.log('Starting database truncation...');
        
        // 1. Disable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // 2. Get all tables in the database
        const [tables] = await connection.query('SHOW TABLES');
        const tableKey = `Tables_in_${config.database}`;

        for (const tableRow of tables) {
            const tableName = tableRow[tableKey];
            
            // Skip master tables if you want to keep them (uncomment below if needed)
            // const skipTables = ['departments', 'roles', 'permissions', 'role_permissions', 'users'];
            // if (skipTables.includes(tableName)) continue;

            console.log(`Truncating table: ${tableName}`);
            await connection.query(`TRUNCATE TABLE ${tableName}`);
        }

        // 3. Enable foreign key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('Successfully truncated all tables.');
    } catch (error) {
        console.error('Error during truncation:', error);
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        await connection.end();
    }
}

truncateAllTables();
```
