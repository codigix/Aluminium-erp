const pool = require('../src/config/db');

async function test() {
  try {
    const planId = 1;
    const [planOps] = await pool.query('SELECT * FROM production_plan_operations WHERE plan_id = ?', [planId]);
    const [wos] = await pool.query('SELECT * FROM work_orders WHERE plan_id = ?', [planId]);

    console.log('--- Input Plan Operations ---');
    console.table(planOps.map(op => ({ name: op.operation_name, source: op.source_item, type: op.item_type })));

    for (const wo of wos) {
      console.log(`\nTesting WO: ${wo.wo_number} (${wo.item_code}, ${wo.source_type})`);
      
      const [woDetails] = await pool.query('SELECT drawing_no, item_code FROM sales_order_items WHERE id = ?', [wo.sales_order_item_id]);
      const woDrawing = woDetails[0]?.drawing_no || wo.bom_no;
      const woSoiCode = woDetails[0]?.item_code;

      const matchedOps = planOps.filter(op => {
        const opSource = (op.source_item || op.sourceItem || '').toUpperCase();
        const opType = (op.item_type || op.itemType || '').toUpperCase();
        
        const targetCode = (wo.item_code || '').toUpperCase();
        const targetDrawing = (woDrawing || '').toUpperCase();
        const targetSoiCode = (woSoiCode || '').toUpperCase();
        const targetName = (wo.item_name || '').toUpperCase();
        const targetSourceFg = (wo.source_fg || '').toUpperCase();

        const isFG = wo.source_type === 'FG';
        const isSA = wo.source_type === 'SA';
        const opIsFG = ['FG', 'FINISHED GOOD', 'FINISHED GOODS'].includes(opType);
        const opIsSA = ['SA', 'SUB ASSEMBLY', 'SUB-ASSEMBLY', 'SUBASSEMBLY'].includes(opType);

        // Priority 1: Direct match by source item code, drawing, name, source_fg, or SOI code
        if (opSource) {
          const sourceMatches = (opSource === targetCode || 
                                 (targetDrawing && opSource === targetDrawing) ||
                                 (targetSoiCode && opSource === targetSoiCode) ||
                                 (targetName && opSource === targetName) ||
                                 (targetSourceFg && opSource === targetSourceFg));
          
          const typeMatches = (isFG && opIsFG) || (isSA && opIsSA);
          if (sourceMatches && typeMatches) return true;
        }

        // Priority 2: If opSource is NOT specified, fallback to matching strictly by type
        if (!opSource) {
          if (isFG && opIsFG) return true;
          if (isSA && opIsSA) return true;
        }

        return false;
      });

      console.log('Matched Operations:');
      console.table(matchedOps.map(op => ({ name: op.operation_name, source: op.source_item })));
    }

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

test();
