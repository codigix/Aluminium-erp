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

    // 3. Update Job Card with outward challan info and vendor_id
    await connection.execute(
      `UPDATE job_cards SET outward_challan_id = ?, outward_challan_no = ?, dispatch_qty = ?, vendor_id = ? WHERE id = ?`,
      [challanId, challanNumber, dispatchQty, vendorId, jobCardId]
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
      [inwardNumber, outwardChallanId, jobCardId, vendorId, receivedDate || null, vendorInvoiceNo, totalReceivedQty, notes]
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

    // 3. Update Outward Challan Status
    await connection.execute(
      `UPDATE outward_challans SET status = 'RECEIVED' WHERE id = ?`,
      [outwardChallanId]
    );

    // 4. Update Job Card status to COMPLETED and save quantities
    const finalAccepted = acceptedQty !== undefined && acceptedQty !== null ? acceptedQty : totalReceivedQty;
    const finalRejected = rejectedQty !== undefined && rejectedQty !== null ? rejectedQty : 0;
    
    await connection.execute(
      `UPDATE job_cards 
       SET produced_qty = ?, accepted_qty = ?, rejected_qty = ?, status = 'COMPLETED' 
       WHERE id = ?`,
      [totalReceivedQty, finalAccepted, finalRejected, jobCardId]
    );

    // 5. Update Work Order status if needed
    const [allJcs] = await connection.query('SELECT status FROM job_cards WHERE work_order_id = (SELECT work_order_id FROM job_cards WHERE id = ?)', [jobCardId]);
    if (allJcs.length > 0) {
      const [jcRow] = await connection.query('SELECT work_order_id FROM job_cards WHERE id = ?', [jobCardId]);
      const workOrderId = jcRow[0].work_order_id;
      
      let newWoStatus = 'RELEASED';
      if (allJcs.some(jc => jc.status === 'IN_PROGRESS')) {
        newWoStatus = 'IN_PROGRESS';
      } else if (allJcs.every(jc => jc.status === 'COMPLETED')) {
        newWoStatus = 'COMPLETED';
      } else if (allJcs.some(jc => jc.status === 'COMPLETED' || jc.status === 'PENDING')) {
        const hasStarted = allJcs.some(jc => jc.status === 'COMPLETED');
        if (hasStarted) newWoStatus = 'IN_PROGRESS';
      }

      await connection.execute('UPDATE work_orders SET status = ? WHERE id = ?', [newWoStatus, workOrderId]);
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
      `SELECT * FROM outward_challans WHERE job_card_id = ? ORDER BY created_at DESC LIMIT 1`,
      [jobCardId]
    );

    if (challans.length === 0) {
      return res.status(404).json({ message: 'Outward challan not found for this job card' });
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

    // 4. Update Job Card with dispatch quantity and vendor id
    const [challanRows] = await connection.execute(
      `SELECT job_card_id FROM outward_challans WHERE id = ?`,
      [id]
    );
    if (challanRows.length > 0) {
      const jobCardId = challanRows[0].job_card_id;
      await connection.execute(
        `UPDATE job_cards SET dispatch_qty = ?, vendor_id = ? WHERE id = ?`,
        [dispatchQty, vendorId, jobCardId]
      );
    }

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
    const [items] = await pool.execute(
      `SELECT oci.*, oc.challan_number 
       FROM outward_challan_items oci
       JOIN outward_challans oc ON oci.challan_id = oc.id
       WHERE oc.job_card_id = ?`,
      [jobCardId]
    );
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
    const [inwards] = await pool.execute(
      `SELECT * FROM inward_challans WHERE job_card_id = ? ORDER BY created_at DESC LIMIT 1`,
      [jobCardId]
    );

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
