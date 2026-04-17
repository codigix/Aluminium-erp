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

    // 3. Update Job Card with outward challan info
    await connection.execute(
      `UPDATE job_cards SET outward_challan_id = ?, outward_challan_no = ?, dispatch_qty = ? WHERE id = ?`,
      [challanId, challanNumber, dispatchQty, jobCardId]
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
      vendorInvoiceNo, totalReceivedQty, notes, items 
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

module.exports = router;
