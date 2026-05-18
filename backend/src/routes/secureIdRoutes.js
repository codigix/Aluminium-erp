const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/resolve', async (req, res, next) => {
  const { uuid, type } = req.query;
  if (!uuid || !type) {
    return res.status(400).json({ error: 'Missing uuid or type parameter' });
  }

  try {
    let tableName = '';
    if (type === 'drawing') {
      tableName = 'customer_drawings';
    } else if (type === 'sales_order') {
      tableName = 'sales_orders';
    } else {
      return res.status(400).json({ error: 'Invalid type parameter' });
    }

    // Try resolving by public_id
    const [rows] = await pool.query(
      `SELECT id FROM ${tableName} WHERE public_id = ? LIMIT 1`,
      [uuid]
    );

    if (rows.length === 0) {
      // Fallback: if the ID is already numeric (legacy link), return it directly
      if (/^\d+$/.test(uuid)) {
        return res.json({ id: parseInt(uuid, 10) });
      }
      return res.status(404).json({ error: `${type} not found for ID: ${uuid}` });
    }

    res.json({ id: rows[0].id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
