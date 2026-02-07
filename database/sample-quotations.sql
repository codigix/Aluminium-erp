USE sales_erp;

INSERT INTO quotations (quote_number, vendor_id, status, valid_until, total_amount, notes)
VALUES
  (CONCAT('QT-', FLOOR(UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 5 DAY)) / 1000)), 1, 'SENT', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 0, 'Standard quotation request'),
  (CONCAT('QT-', FLOOR(UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 3 DAY)) / 1000)), 1, 'PENDING', DATE_ADD(CURDATE(), INTERVAL 22 DAY), 125000, 'Awaiting approval'),
  (CONCAT('QT-', FLOOR(UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) / 1000)), 2, 'SENT', DATE_ADD(CURDATE(), INTERVAL 31 DAY), 0, 'Electronics quotation'),
  (CONCAT('QT-', FLOOR(UNIX_TIMESTAMP(NOW()) / 1000)), 1, 'RECEIVED', DATE_ADD(CURDATE(), INTERVAL 15 DAY), 95000, 'Quote received from vendor');

INSERT INTO quotation_items (quotation_id, item_code, description, quantity, unit, unit_rate, amount)
VALUES
  (2, 'ELC-001', 'Electronic Component A', 100, 'NOS', 1000, 100000),
  (2, 'ELC-002', 'Electronic Component B', 50, 'NOS', 500, 25000),
  (4, 'MAT-001', 'Material Supply', 200, 'KG', 475, 95000);
