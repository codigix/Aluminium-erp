const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const pool = require('../config/db');

// Get all outward challans
router.get('/', authenticate, async (req, res) => {
  try {
    const [challans] = await pool.execute(`
      SELECT oc.*, v.vendor_name, jc.job_card_no, wo.wo_number 
      FROM outward_challans oc
      JOIN vendors v ON oc.vendor_id = v.id
      JOIN job_cards jc ON oc.job_card_id = jc.id
      JOIN work_orders wo ON oc.work_order_id = wo.id
      ORDER BY oc.created_at DESC
    `);
    res.json(challans);
  } catch (error) {
    console.error('Error fetching outward challans:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create outward challan
router.post('/', authenticate, authorize(['PROD_MANAGE']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { 
      jobCardId, workOrderId, vendorId, operationName, 
      plannedQty, expectedReturnDate, dispatchQty, dispatchDate,
      dispatchNotes, materialItems 
    } = req.body;

    // A. Validate remaining quantity to prevent duplicate or excessive dispatches
    const [jcRows] = await connection.execute(
      `SELECT planned_qty FROM job_cards WHERE id = ?`,
      [jobCardId]
    );
    if (jcRows.length === 0) {
      return res.status(404).json({ message: 'Job Card not found' });
    }
    const jcPlannedQty = parseFloat(jcRows[0].planned_qty || 0);

    const [receivedRows] = await connection.execute(
      `SELECT COALESCE(SUM(total_received_qty), 0) as total_received 
       FROM inward_challans 
       WHERE job_card_id = ?`,
      [jobCardId]
    );
    const totalReceivedQty = parseFloat(receivedRows[0].total_received || 0);

    const [challans] = await connection.execute(
      `SELECT id, dispatch_qty, status FROM outward_challans WHERE job_card_id = ?`,
      [jobCardId]
    );

    let openDispatchQty = 0;
    for (const ch of challans) {
      if (ch.status === 'DISPATCHED') {
        const [chRecRows] = await connection.execute(
          `SELECT COALESCE(SUM(total_received_qty), 0) as received 
           FROM inward_challans 
           WHERE outward_challan_id = ?`,
          [ch.id]
        );
        const chReceived = parseFloat(chRecRows[0].received || 0);
        openDispatchQty += Math.max(0, parseFloat(ch.dispatch_qty || 0) - chReceived);
      }
    }

    const remainingQty = jcPlannedQty - totalReceivedQty - openDispatchQty;

    if (parseFloat(dispatchQty) > remainingQty + 0.001) {
      return res.status(400).json({ 
        message: `Cannot dispatch ${dispatchQty} units. Available balance quantity is ${remainingQty.toFixed(3)} units.` 
      });
    }

    // 1. Create Outward Challan Header
    const challanNumber = `OC-${Date.now()}`;
    const [result] = await connection.execute(
      `INSERT INTO outward_challans 
       (challan_number, job_card_id, work_order_id, vendor_id, operation_name, planned_qty, dispatch_qty, dispatch_date, expected_return_date, notes, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISPATCHED')`,
      [challanNumber, jobCardId, workOrderId, vendorId, operationName, plannedQty, dispatchQty, dispatchDate || null, expectedReturnDate || null, dispatchNotes]
    );

    const challanId = result.insertId;

    // 2. Create Outward Challan Items
    if (materialItems && materialItems.length > 0) {
      for (const item of materialItems) {
        await connection.execute(
          `INSERT INTO outward_challan_items (challan_id, item_code, required_qty, release_qty) 
           VALUES (?, ?, ?, ?)`,
          [challanId, item.itemCode, item.requiredQty, item.releaseQty]
        );
      }
    }

    // 3. Update Job Card with outward challan info, vendor_id, and cumulative dispatch_qty
    const [sumRows] = await connection.execute(
      `SELECT COALESCE(SUM(dispatch_qty), 0) as total_dispatch 
       FROM outward_challans 
       WHERE job_card_id = ?`,
      [jobCardId]
    );
    const totalDispatch = parseFloat(sumRows[0].total_dispatch || 0);

    await connection.execute(
      `UPDATE job_cards SET outward_challan_id = ?, outward_challan_no = ?, dispatch_qty = ?, vendor_id = ? WHERE id = ?`,
      [challanId, challanNumber, totalDispatch, vendorId, jobCardId]
    );

    await connection.commit();
    res.status(201).json({ message: 'Outward Challan created', id: challanId, challanNumber });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating outward challan:', error);
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
});

// Create inward challan
router.post('/inward', authenticate, authorize(['PROD_MANAGE']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { 
      outwardChallanId, jobCardId, vendorId, receivedDate, 
      vendorInvoiceNo, totalReceivedQty, acceptedQty, rejectedQty, scrapQty, notes, items 
    } = req.body;

    // 1. Create Inward Challan Header
    const inwardNumber = `IC-${Date.now()}`;
    const [result] = await connection.execute(
      `INSERT INTO inward_challans 
       (inward_number, outward_challan_id, job_card_id, vendor_id, received_date, vendor_invoice_no, total_received_qty, notes, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED')`,
      [inwardNumber, outwardChallanId, jobCardId, vendorId, receivedDate || null, vendorInvoiceNo || null, totalReceivedQty, notes || null]
    );

    const inwardId = result.insertId;

    // 2. Create Inward Challan Items
    if (items && items.length > 0) {
      for (const item of items) {
        await connection.execute(
          `INSERT INTO inward_challan_items 
           (inward_challan_id, item_code, received_qty, accepted_qty, rejected_qty, scrap_qty, rate) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [inwardId, item.itemCode, item.receivedQty, item.acceptedQty, item.rejectedQty, item.scrapQty, item.rate || 0]
        );
      }
    }

    // 3. Get current quantities and info from Job Card
    const [jcRows] = await connection.execute(
      `SELECT work_order_id, sequence_no, produced_qty, accepted_qty, rejected_qty, scrap_qty, dispatch_qty, planned_qty 
       FROM job_cards 
       WHERE id = ?`,
      [jobCardId]
    );

    if (jcRows.length === 0) {
      throw new Error('Job Card not found');
    }

    const currentJc = jcRows[0];
    const currentProduced = parseFloat(currentJc.produced_qty || 0);
    const currentAccepted = parseFloat(currentJc.accepted_qty || 0);
    const currentRejected = parseFloat(currentJc.rejected_qty || 0);
    const currentScrap = parseFloat(currentJc.scrap_qty || 0);
    const dispatchQtyLimit = parseFloat(currentJc.dispatch_qty || currentJc.planned_qty || 0);

    const incomingReceived = parseFloat(totalReceivedQty || 0);
    const finalAccepted = acceptedQty !== undefined && acceptedQty !== null ? parseFloat(acceptedQty) : incomingReceived;
    const finalRejected = rejectedQty !== undefined && rejectedQty !== null ? parseFloat(rejectedQty) : 0;
    const incomingScrap = parseFloat(scrapQty || 0);

    const newProduced = currentProduced + incomingReceived;
    const newAccepted = currentAccepted + finalAccepted;
    const newRejected = currentRejected + finalRejected;
    const newScrap = currentScrap + incomingScrap;

    // Fetch this specific outward challan's details
    const [ocRows] = await connection.execute(
      `SELECT dispatch_qty FROM outward_challans WHERE id = ?`,
      [outwardChallanId]
    );
    if (ocRows.length === 0) {
      throw new Error('Outward Challan not found');
    }
    const ocDispatchQty = parseFloat(ocRows[0].dispatch_qty || 0);

    // Sum all received quantities for this outward challan (including the one just inserted)
    const [inwardSumRows] = await connection.execute(
      `SELECT COALESCE(SUM(total_received_qty), 0) as total_received 
       FROM inward_challans 
       WHERE outward_challan_id = ?`,
      [outwardChallanId]
    );
    const totalReceivedForChallan = parseFloat(inwardSumRows[0].total_received || 0);

    // Check if this specific outward challan is fully received
    const isChallanFullyReceived = totalReceivedForChallan >= ocDispatchQty;
    const newChallanStatus = isChallanFullyReceived ? 'RECEIVED' : 'DISPATCHED';

    // 4. Update Outward Challan Status
    await connection.execute(
      `UPDATE outward_challans SET status = ? WHERE id = ?`,
      [newChallanStatus, outwardChallanId]
    );

    // Check if Job Card is fully received (newProduced >= planned_qty)
    const isJcFullyReceived = newProduced >= parseFloat(currentJc.planned_qty || 0);
    const newStatus = isJcFullyReceived ? 'COMPLETED' : 'IN_PROGRESS';

    // 5. Update Job Card with cumulative quantities and new status
    await connection.execute(
      `UPDATE job_cards 
       SET produced_qty = ?, accepted_qty = ?, rejected_qty = ?, scrap_qty = ?, status = ? 
       WHERE id = ?`,
      [newProduced, newAccepted, newRejected, newScrap, newStatus, jobCardId]
    );

    // 6. Find next Job Card in sequence
    const [nextJcRows] = await connection.query(
      'SELECT id, status FROM job_cards WHERE work_order_id = ? AND sequence_no > ? ORDER BY sequence_no ASC, id ASC LIMIT 1',
      [currentJc.work_order_id, currentJc.sequence_no]
    );

    let targetJcId = null;
    let isParentJc = false;
    let targetJcStatus = null;

    if (nextJcRows.length > 0) {
      targetJcId = nextJcRows[0].id;
      targetJcStatus = nextJcRows[0].status;
    } else {
      // If no next operation in the same work order, check if this is a child work order
      const [woRows] = await connection.query(
        'SELECT parent_wo_id FROM work_orders WHERE id = ?',
        [currentJc.work_order_id]
      );
      const parentWoId = woRows[0]?.parent_wo_id;
      if (parentWoId) {
        // Find the first job card in the parent work order
        const [parentJcRows] = await connection.query(
          'SELECT id, status FROM job_cards WHERE work_order_id = ? ORDER BY sequence_no ASC, id ASC LIMIT 1',
          [parentWoId]
        );
        if (parentJcRows.length > 0) {
          targetJcId = parentJcRows[0].id;
          targetJcStatus = parentJcRows[0].status;
          isParentJc = true;
        }
      }
    }

    // 7. Quantity Transfer to Next Operation
    if (targetJcId) {
      if (isParentJc) {
        if (targetJcStatus === 'PENDING') {
          await connection.execute(
            "UPDATE job_cards SET planned_qty = ?, status = 'IN_PROGRESS', actual_start_date = COALESCE(actual_start_date, CURRENT_DATE()) WHERE id = ?",
            [incomingReceived, targetJcId]
          );
        } else {
          await connection.execute(
            'UPDATE job_cards SET planned_qty = COALESCE(planned_qty, 0) + ? WHERE id = ?',
            [incomingReceived, targetJcId]
          );
        }
      } else {
        if (targetJcStatus === 'PENDING') {
          await connection.execute(
            "UPDATE job_cards SET planned_qty = ?, status = 'IN_PROGRESS', actual_start_date = COALESCE(actual_start_date, CURRENT_DATE()) WHERE id = ?",
            [incomingReceived, targetJcId]
          );
        } else {
          await connection.execute(
            'UPDATE job_cards SET planned_qty = COALESCE(planned_qty, 0) + ? WHERE id = ?',
            [incomingReceived, targetJcId]
          );
        }
      }

      // Update transferred_qty on the current job card
      await connection.execute(
        'UPDATE job_cards SET transferred_qty = COALESCE(transferred_qty, 0) + ? WHERE id = ?',
        [incomingReceived, jobCardId]
      );
    }

    // 8. Update Work Order status if needed
    const [allJcs] = await connection.query(
      'SELECT status FROM job_cards WHERE work_order_id = ?',
      [currentJc.work_order_id]
    );
    if (allJcs.length > 0) {
      let newWoStatus = 'RELEASED';
      if (allJcs.some(jc => jc.status === 'IN_PROGRESS')) {
        newWoStatus = 'IN_PROGRESS';
      } else if (allJcs.every(jc => jc.status === 'COMPLETED')) {
        newWoStatus = 'COMPLETED';
      } else if (allJcs.some(jc => jc.status === 'COMPLETED' || jc.status === 'PENDING')) {
        const hasStarted = allJcs.some(jc => jc.status === 'COMPLETED');
        if (hasStarted) newWoStatus = 'IN_PROGRESS';
      }

      await connection.execute('UPDATE work_orders SET status = ? WHERE id = ?', [newWoStatus, currentJc.work_order_id]);
    }

    await connection.commit();
    res.status(201).json({ message: 'Inward Challan created', id: inwardId, inwardNumber });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating inward challan:', error);
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
});

// Get outward challan by job card ID
router.get('/job-card/:jobCardId', authenticate, async (req, res) => {
  try {
    const { jobCardId } = req.params;
    const [challans] = await pool.execute(
      `SELECT oc.*,
              COALESCE((SELECT SUM(total_received_qty) FROM inward_challans WHERE outward_challan_id = oc.id), 0) as received_qty
       FROM outward_challans oc 
       WHERE oc.job_card_id = ? 
       ORDER BY oc.created_at DESC`,
      [jobCardId]
    );

    if (challans.length === 0) {
      return res.status(404).json({ message: 'Outward challan not found for this job card' });
    }

    const challan = { ...challans[0] };

    // Get outward challan items
    const [items] = await pool.execute(
      `SELECT oci.* 
       FROM outward_challan_items oci
       WHERE oci.challan_id = ?`,
      [challan.id]
    );

    challan.items = items;
    challan.allChallans = challans; // Include all challans for the Job Card
    res.json(challan);
  } catch (error) {
    console.error('Error fetching outward challan:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update outward challan
router.put('/:id', authenticate, authorize(['PROD_MANAGE']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { 
      vendorId, expectedReturnDate, dispatchQty, dispatchDate,
      dispatchNotes, materialItems 
    } = req.body;

    // A. Fetch Job Card ID for the current challan
    const [challanRows] = await connection.execute(
      `SELECT job_card_id FROM outward_challans WHERE id = ?`,
      [id]
    );
    if (challanRows.length === 0) {
      return res.status(404).json({ message: 'Outward Challan not found' });
    }
    const jobCardId = challanRows[0].job_card_id;

    // B. Validate remaining quantity (excluding the current challan being edited)
    const [jcRows] = await connection.execute(
      `SELECT planned_qty FROM job_cards WHERE id = ?`,
      [jobCardId]
    );
    if (jcRows.length === 0) {
      return res.status(404).json({ message: 'Job Card not found' });
    }
    const jcPlannedQty = parseFloat(jcRows[0].planned_qty || 0);

    const [receivedRows] = await connection.execute(
      `SELECT COALESCE(SUM(total_received_qty), 0) as total_received 
       FROM inward_challans 
       WHERE job_card_id = ?`,
      [jobCardId]
    );
    const totalReceivedQty = parseFloat(receivedRows[0].total_received || 0);

    const [allChallans] = await connection.execute(
      `SELECT id, dispatch_qty, status FROM outward_challans WHERE job_card_id = ?`,
      [jobCardId]
    );

    let openDispatchQty = 0;
    for (const ch of allChallans) {
      if (ch.id === parseInt(id)) continue; // Skip the current challan being updated
      if (ch.status === 'DISPATCHED') {
        const [chRecRows] = await connection.execute(
          `SELECT COALESCE(SUM(total_received_qty), 0) as received 
           FROM inward_challans 
           WHERE outward_challan_id = ?`,
          [ch.id]
        );
        const chReceived = parseFloat(chRecRows[0].received || 0);
        openDispatchQty += Math.max(0, parseFloat(ch.dispatch_qty || 0) - chReceived);
      }
    }

    const remainingQty = jcPlannedQty - totalReceivedQty - openDispatchQty;

    if (parseFloat(dispatchQty) > remainingQty + 0.001) {
      return res.status(400).json({ 
        message: `Cannot update dispatch quantity to ${dispatchQty} units. Available balance quantity is ${remainingQty.toFixed(3)} units.` 
      });
    }

    // 1. Update Outward Challan Header
    await connection.execute(
      `UPDATE outward_challans 
       SET vendor_id = ?, dispatch_qty = ?, dispatch_date = ?, expected_return_date = ?, notes = ?
       WHERE id = ?`,
      [vendorId, dispatchQty, dispatchDate || null, expectedReturnDate || null, dispatchNotes, id]
    );

    // 2. Delete existing Outward Challan Items
    await connection.execute(
      `DELETE FROM outward_challan_items WHERE challan_id = ?`,
      [id]
    );

    // 3. Insert new Outward Challan Items
    if (materialItems && materialItems.length > 0) {
      for (const item of materialItems) {
        await connection.execute(
          `INSERT INTO outward_challan_items (challan_id, item_code, required_qty, release_qty) 
           VALUES (?, ?, ?, ?)`,
          [id, item.itemCode, item.requiredQty, item.releaseQty]
        );
      }
    }

    // 4. Recalculate and update Job Card with cumulative dispatch quantity
    const [sumRows] = await connection.execute(
      `SELECT COALESCE(SUM(dispatch_qty), 0) as total_dispatch 
       FROM outward_challans 
       WHERE job_card_id = ?`,
      [jobCardId]
    );
    const totalDispatch = parseFloat(sumRows[0].total_dispatch || 0);

    await connection.execute(
      `UPDATE job_cards SET dispatch_qty = ?, vendor_id = ? WHERE id = ?`,
      [totalDispatch, vendorId, jobCardId]
    );

    await connection.commit();
    res.json({ message: 'Outward Challan updated' });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating outward challan:', error);
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
});

router.get('/job-card/:jobCardId/items', authenticate, async (req, res) => {
  try {
    const { jobCardId } = req.params;
    const { challanId } = req.query;
    
    let query = `
      SELECT oci.*, oc.challan_number 
      FROM outward_challan_items oci
      JOIN outward_challans oc ON oci.challan_id = oc.id
      WHERE oc.job_card_id = ?
    `;
    let params = [jobCardId];
    
    if (challanId) {
      query += ` AND oc.id = ?`;
      params.push(challanId);
    }
    
    const [items] = await pool.execute(query, params);
    res.json(items);
  } catch (error) {
    console.error('Error fetching outward challan items:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get inward challan by job card ID
router.get('/inward/job-card/:jobCardId', authenticate, async (req, res) => {
  try {
    const { jobCardId } = req.params;
    const { challanId } = req.query;
    
    let query = `SELECT * FROM inward_challans WHERE job_card_id = ?`;
    let params = [jobCardId];
    
    if (challanId) {
      query += ` AND outward_challan_id = ?`;
      params.push(challanId);
    }
    
    query += ` ORDER BY created_at DESC LIMIT 1`;
    
    const [inwards] = await pool.execute(query, params);

    if (inwards.length === 0) {
      return res.status(404).json({ message: 'Inward challan not found for this job card' });
    }

    const inward = inwards[0];

    // Get inward challan items
    const [items] = await pool.execute(
      `SELECT * FROM inward_challan_items WHERE inward_challan_id = ?`,
      [inward.id]
    );

    inward.items = items;
    res.json(inward);
  } catch (error) {
    console.error('Error fetching inward challan:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get inward challans
router.get('/inward', authenticate, async (req, res) => {
  try {
    const [inwards] = await pool.execute(`
      SELECT ic.*, oc.challan_number as outward_challan_no, v.vendor_name, jc.job_card_no 
      FROM inward_challans ic
      JOIN outward_challans oc ON ic.outward_challan_id = oc.id
      JOIN vendors v ON ic.vendor_id = v.id
      JOIN job_cards jc ON ic.job_card_id = jc.id
      ORDER BY ic.created_at DESC
    `);
    res.json(inwards);
  } catch (error) {
    console.error('Error fetching inward challans:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get outward challan PDF by ID
router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const [challans] = await pool.execute(
      `SELECT oc.*, v.vendor_name, v.vendor_code, jc.job_card_no, wo.wo_number 
       FROM outward_challans oc
       JOIN vendors v ON oc.vendor_id = v.id
       JOIN job_cards jc ON oc.job_card_id = jc.id
       JOIN work_orders wo ON oc.work_order_id = wo.id
       WHERE oc.id = ?`,
      [id]
    );

    if (challans.length === 0) {
      return res.status(404).json({ message: 'Outward challan not found' });
    }

    const challan = challans[0];

    // Get outward challan items
    const [items] = await pool.execute(
      `SELECT oci.* 
       FROM outward_challan_items oci
       WHERE oci.challan_id = ?`,
      [challan.id]
    );

    challan.items = items;

    const generateOutwardChallanPdf = require('../utils/generateOutwardChallanPdf');
    const pdfPath = await generateOutwardChallanPdf(challan);
    
    res.download(pdfPath, `Outward_Challan_${challan.challan_number}.pdf`, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });
  } catch (error) {
    console.error('Outward PDF Generation/Download Error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get outward challan by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const [challans] = await pool.execute(
      `SELECT oc.*, v.vendor_name, jc.job_card_no, wo.wo_number 
       FROM outward_challans oc
       JOIN vendors v ON oc.vendor_id = v.id
       JOIN job_cards jc ON oc.job_card_id = jc.id
       JOIN work_orders wo ON oc.work_order_id = wo.id
       WHERE oc.id = ?`,
      [id]
    );

    if (challans.length === 0) {
      return res.status(404).json({ message: 'Outward challan not found' });
    }

    const challan = challans[0];

    // Get outward challan items
    const [items] = await pool.execute(
      `SELECT oci.* 
       FROM outward_challan_items oci
       WHERE oci.challan_id = ?`,
      [challan.id]
    );

    challan.items = items;
    res.json(challan);
  } catch (error) {
    console.error('Error fetching outward challan by ID:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
