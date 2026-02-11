
const pool = require('./src/config/db');

async function run() {
    try {
        console.log('Database connection successful');
        
        const [plans] = await pool.query('SELECT * FROM production_plans ORDER BY id DESC LIMIT 5');
        console.log('--- Recent Plans ---');
        console.table(plans.map(p => ({ id: p.id, plan_identity: p.plan_identity, sales_order_id: p.sales_order_id })));

        if (plans.length > 0) {
            const planId = plans[0].id;
            const [items] = await pool.query('SELECT * FROM production_plan_items WHERE plan_id = ?', [planId]);
            console.log(`--- Items for Plan ${planId} ---`);
            console.table(items.map(i => ({ 
                id: i.id, 
                item_code: i.item_code, 
                description: i.description, 
                sales_order_item_id: i.sales_order_item_id 
            })));
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

run();
