USE sales_erp;

INSERT IGNORE INTO vendors (vendor_name, vendor_code, category, email, phone, location, rating, status, total_orders, total_value) 
VALUES 
  ('Sudarshan Kale', 'SUDAK001', 'Electronics', 'kalesudarshan146@gmail.com', '9322552352', 'Wagholi', 3.0, 'ACTIVE', 0, 0),
  ('ABC Electronics', 'ABCEL001', 'Electronics', 'contact@abcelectronics.com', '9876543210', 'Pune', 4.5, 'ACTIVE', 12, 500000),
  ('Material Supplier Inc', 'MATIN001', 'Material Supplier', 'info@materialsupplier.com', '9123456789', 'Mumbai', 4.0, 'ACTIVE', 8, 250000),
  ('Tech Components', 'TECCO001', 'Electronics', 'sales@techcomponents.com', '9988776655', 'Bangalore', 3.5, 'INACTIVE', 5, 150000),
  ('Industrial Supplies', 'INDSU001', 'Raw Materials', 'contact@industrialsupplies.com', '9456123789', 'Hyderabad', 2.5, 'BLOCKED', 2, 50000);
