const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const pool = require('../config/db');

router.post('/', authenticate, authorize(['PROD_MANAGE']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { 
      jobCardId, workOrderId, vendorId, operationName, 
      plannedQty, expectedReturnDate, dispatchQty, 
      dispatchNotes, materialItems 
    } = req.body;

    // 1. Create Outward Challan Header
    const challanNumber = `OC-${Date.now()}`;
    const [result] = await connection.execute(
      `INSERT INTO outward_challans 
       (challan_number, job_card_id, work_order_id, vendor_id, operation_name, planned_qty, dispatch_qty, expected_return_date, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [challanNumber, jobCardId, workOrderId, vendorId, operationName, plannedQty, dispatchQty, expectedReturnDate || null, dispatchNotes]
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

module.exports = router;
