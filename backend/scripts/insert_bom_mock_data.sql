-- ==========================================
-- BOM MOCK DATA INSERTION SCRIPT
-- ==========================================
-- This script inserts comprehensive mock data for testing the BOM module
-- Includes: BOMs, BOM Lines, BOM Operations, and BOM Scrap items

-- ==========================================
-- CLEAR EXISTING DATA (Optional - Comment out if not needed)
-- ==========================================
-- DELETE FROM bom_scrap;
-- DELETE FROM bom_operation;
-- DELETE FROM bom_line;
-- DELETE FROM bom;
-- ALTER TABLE bom AUTO_INCREMENT = 1;
-- ALTER TABLE bom_line AUTO_INCREMENT = 1;
-- ALTER TABLE bom_operation AUTO_INCREMENT = 1;
-- ALTER TABLE bom_scrap AUTO_INCREMENT = 1;

-- ==========================================
-- INSERT BOM MASTER DATA
-- ==========================================

-- BOM-1: Standard Aluminum Frame (Active)
INSERT INTO bom (bom_id, item_code, product_name, description, quantity, uom, status, revision, is_active, is_default, effective_date, created_by, process_loss_percentage, total_cost, created_at, updated_at)
VALUES (
  'BOM-STD-ALUM-FRAME-001',
  'ITEM-ALUMINIUMS',
  'Standard Aluminum Frame',
  'Standard aluminum frame for industrial use',
  1.0,
  'Kg',
  'Active',
  1,
  1,
  1,
  CURDATE(),
  'admin',
  2.5,
  1250.00,
  NOW(),
  NOW()
);

-- BOM-2: Premium Aluminum Frame (Active)
INSERT INTO bom (bom_id, item_code, product_name, description, quantity, uom, status, revision, is_active, is_default, effective_date, created_by, process_loss_percentage, total_cost, created_at, updated_at)
VALUES (
  'BOM-PREM-ALUM-FRAME-002',
  'ITEM-ALUMINIUMS',
  'Premium Aluminum Frame',
  'Premium quality aluminum frame with enhanced finishing',
  1.0,
  'Kg',
  'Active',
  1,
  1,
  0,
  CURDATE(),
  'admin',
  1.5,
  1850.00,
  NOW(),
  NOW()
);

-- BOM-3: Basic Aluminum Sheet (Draft)
INSERT INTO bom (bom_id, item_code, product_name, description, quantity, uom, status, revision, is_active, is_default, effective_date, created_by, process_loss_percentage, total_cost, created_at, updated_at)
VALUES (
  'BOM-BASIC-SHEET-003',
  'ITEM-ALUMINIUMS',
  'Basic Aluminum Sheet',
  'Basic aluminum sheet for construction',
  10.0,
  'Kg',
  'Draft',
  1,
  1,
  NULL,
  CURDATE(),
  'admin',
  3.0,
  850.00,
  NOW(),
  NOW()
);

-- BOM-4: Custom Aluminum Assembly (Draft)
INSERT INTO bom (bom_id, item_code, product_name, description, quantity, uom, status, revision, is_active, is_default, effective_date, created_by, process_loss_percentage, total_cost, created_at, updated_at)
VALUES (
  'BOM-CUSTOM-ASSEM-004',
  'ITEM-ALUMINIUMS',
  'Custom Aluminum Assembly',
  'Custom assembly with multiple components',
  1.0,
  'Unit',
  'Draft',
  2,
  1,
  0,
  CURDATE(),
  'admin',
  NULL,
  2500.00,
  NOW(),
  NOW()
);

-- BOM-5: Industrial Aluminum Profile (Active)
INSERT INTO bom (bom_id, item_code, product_name, description, quantity, uom, status, revision, is_active, is_default, effective_date, created_by, process_loss_percentage, total_cost, created_at, updated_at)
VALUES (
  'BOM-IND-PROFILE-005',
  'ITEM-ALUMINIUMS',
  'Industrial Aluminum Profile',
  'Heavy duty industrial aluminum profile',
  5.5,
  'Kg',
  'Active',
  1,
  1,
  0,
  CURDATE(),
  'admin',
  2.0,
  1650.00,
  NOW(),
  NOW()
);

-- ==========================================
-- INSERT BOM LINE ITEMS (Materials/Components)
-- ==========================================

-- BOM-STD-ALUM-FRAME-001 Lines
INSERT INTO bom_line (bom_id, component_code, quantity, uom, component_description, component_type, sequence, warehouse, operation, rate, amount, notes, created_at)
VALUES 
('BOM-STD-ALUM-FRAME-001', 'ITEM-ALUMINIUMS', 5.0, 'Kg', 'Raw Aluminum Sheet 5mm', 'raw-material', 1, 'WH-001', NULL, 250.00, 1250.00, 'Primary material', NOW()),
('BOM-STD-ALUM-FRAME-001', 'ITEM-FASTENER-001', 20.0, 'Piece', 'Aluminum Bolts M5', 'component', 2, 'WH-001', NULL, 5.00, 100.00, 'Fastening components', NOW()),
('BOM-STD-ALUM-FRAME-001', 'ITEM-FASTENER-002', 20.0, 'Piece', 'Aluminum Nuts M5', 'component', 3, 'WH-001', NULL, 2.50, 50.00, 'Fastening nuts', NOW()),
('BOM-STD-ALUM-FRAME-001', 'ITEM-PAINT-001', 0.5, 'Liter', 'Industrial Aluminum Paint', 'consumable', 4, 'WH-002', NULL, 400.00, 200.00, NULL, NOW());

-- BOM-PREM-ALUM-FRAME-002 Lines
INSERT INTO bom_line (bom_id, component_code, quantity, uom, component_description, component_type, sequence, warehouse, operation, rate, amount, notes, created_at)
VALUES 
('BOM-PREM-ALUM-FRAME-002', 'ITEM-ALUMINIUMS', 7.0, 'Kg', 'Premium Aluminum Sheet 6mm', 'raw-material', 1, 'WH-001', NULL, 264.29, 1850.00, 'Premium grade material', NOW()),
('BOM-PREM-ALUM-FRAME-002', 'ITEM-FASTENER-003', 24.0, 'Piece', 'Stainless Steel Bolts M6', 'component', 2, 'WH-001', NULL, 8.00, 192.00, 'Premium fastening', NOW()),
('BOM-PREM-ALUM-FRAME-002', 'ITEM-COATING-001', 1.0, 'Unit', 'Premium Anodizing Coating', 'process-material', 3, 'WH-003', NULL, 300.00, 300.00, NULL, NOW());

-- BOM-BASIC-SHEET-003 Lines
INSERT INTO bom_line (bom_id, component_code, quantity, uom, component_description, component_type, sequence, warehouse, operation, rate, amount, notes, created_at)
VALUES 
('BOM-BASIC-SHEET-003', 'ITEM-ALUMINIUMS', 10.0, 'Kg', 'Basic Aluminum Sheet 3mm', 'raw-material', 1, 'WH-001', NULL, 85.00, 850.00, 'Standard grade', NOW());

-- BOM-CUSTOM-ASSEM-004 Lines (with some NULL values for testing)
INSERT INTO bom_line (bom_id, component_code, quantity, uom, component_description, component_type, sequence, warehouse, operation, rate, amount, notes, created_at)
VALUES 
('BOM-CUSTOM-ASSEM-004', 'ITEM-ALUMINIUMS', 3.0, 'Kg', 'Aluminum Frame Component', 'component', 1, 'WH-001', NULL, 400.00, 1200.00, NULL, NOW()),
('BOM-CUSTOM-ASSEM-004', 'ITEM-FASTENER-004', 50.0, 'Piece', 'Mixed Fasteners Pack', 'component', 2, 'WH-001', NULL, 26.00, 1300.00, NULL, NOW()),
('BOM-CUSTOM-ASSEM-004', 'ITEM-ADHESIVE-001', 0.25, 'Kg', 'Industrial Adhesive', 'consumable', 3, NULL, NULL, NULL, NULL, 'Optional adhesive', NOW());

-- BOM-IND-PROFILE-005 Lines
INSERT INTO bom_line (bom_id, component_code, quantity, uom, component_description, component_type, sequence, warehouse, operation, rate, amount, notes, created_at)
VALUES 
('BOM-IND-PROFILE-005', 'ITEM-ALUMINIUMS', 5.5, 'Kg', 'Heavy Duty Aluminum Profile', 'raw-material', 1, 'WH-001', NULL, 300.00, 1650.00, 'Extruded profile', NOW());

-- ==========================================
-- INSERT BOM OPERATIONS (Manufacturing Processes)
-- ==========================================

-- BOM-STD-ALUM-FRAME-001 Operations
INSERT INTO bom_operation (bom_id, operation_name, workstation_type, operation_time, fixed_time, operating_cost, sequence, notes, created_at)
VALUES 
('BOM-STD-ALUM-FRAME-001', 'Cutting', 'ws-cutting', 15.00, 5.00, 50.00, 1, 'Cut aluminum sheets to size', NOW()),
('BOM-STD-ALUM-FRAME-001', 'Drilling', 'ws-drilling', 10.00, 3.00, 40.00, 2, 'Drill bolt holes', NOW()),
('BOM-STD-ALUM-FRAME-001', 'Assembly', 'ws-assembly', 20.00, 10.00, 60.00, 3, 'Assemble components', NOW()),
('BOM-STD-ALUM-FRAME-001', 'Painting', 'ws-painting', 30.00, 15.00, 75.00, 4, 'Apply protective paint coating', NOW());

-- BOM-PREM-ALUM-FRAME-002 Operations
INSERT INTO bom_operation (bom_id, operation_name, workstation_type, operation_time, fixed_time, operating_cost, sequence, notes, created_at)
VALUES 
('BOM-PREM-ALUM-FRAME-002', 'Precision Cutting', 'ws-precision-cut', 12.00, 8.00, 80.00, 1, 'Precision cut premium material', NOW()),
('BOM-PREM-ALUM-FRAME-002', 'Polishing', 'ws-polishing', 25.00, 5.00, 100.00, 2, 'Polish to premium finish', NOW()),
('BOM-PREM-ALUM-FRAME-002', 'Anodizing', 'ws-anodizing', 45.00, 20.00, 150.00, 3, 'Apply anodizing coating', NOW()),
('BOM-PREM-ALUM-FRAME-002', 'Quality Check', 'ws-qa', 15.00, 10.00, 50.00, 4, 'Quality assurance inspection', NOW());

-- BOM-BASIC-SHEET-003 Operations
INSERT INTO bom_operation (bom_id, operation_name, workstation_type, operation_time, fixed_time, operating_cost, sequence, notes, created_at)
VALUES 
('BOM-BASIC-SHEET-003', 'Cutting', 'ws-cutting', 10.00, 2.00, 25.00, 1, 'Cut to size', NOW());

-- BOM-CUSTOM-ASSEM-004 Operations (with some NULL values)
INSERT INTO bom_operation (bom_id, operation_name, workstation_type, operation_time, fixed_time, operating_cost, sequence, notes, created_at)
VALUES 
('BOM-CUSTOM-ASSEM-004', 'Assembly', 'ws-assembly', 30.00, NULL, 80.00, 1, NULL, NOW()),
('BOM-CUSTOM-ASSEM-004', 'Testing', 'ws-testing', 20.00, 10.00, NULL, 2, 'Final assembly test', NOW());

-- BOM-IND-PROFILE-005 Operations
INSERT INTO bom_operation (bom_id, operation_name, workstation_type, operation_time, fixed_time, operating_cost, sequence, notes, created_at)
VALUES 
('BOM-IND-PROFILE-005', 'Extrusion', 'ws-extrusion', 25.00, 15.00, 100.00, 1, 'Extrude aluminum profile', NOW()),
('BOM-IND-PROFILE-005', 'T-slot Installation', 'ws-tslot', 20.00, 8.00, 70.00, 2, 'Install t-slot nuts', NOW());

-- ==========================================
-- INSERT BOM SCRAP ITEMS (Waste/Byproducts)
-- ==========================================

-- BOM-STD-ALUM-FRAME-001 Scrap
INSERT INTO bom_scrap (bom_id, item_code, item_name, quantity, rate, sequence, created_at)
VALUES 
('BOM-STD-ALUM-FRAME-001', 'ITEM-SCRAP-ALUM', 'Aluminum Scrap Waste', 0.15, 50.00, 1, NOW());

-- BOM-PREM-ALUM-FRAME-002 Scrap
INSERT INTO bom_scrap (bom_id, item_code, item_name, quantity, rate, sequence, created_at)
VALUES 
('BOM-PREM-ALUM-FRAME-002', 'ITEM-SCRAP-ALUM', 'Aluminum Scrap Waste', 0.22, 50.00, 1, NOW()),
('BOM-PREM-ALUM-FRAME-002', 'ITEM-SCRAP-COATING', 'Coating Waste', 0.05, 25.00, 2, NOW());

-- BOM-CUSTOM-ASSEM-004 Scrap (with NULL rate to test edge cases)
INSERT INTO bom_scrap (bom_id, item_code, item_name, quantity, rate, sequence, created_at)
VALUES 
('BOM-CUSTOM-ASSEM-004', 'ITEM-SCRAP-GENERAL', 'General Waste', 0.30, NULL, 1, NOW());

-- BOM-IND-PROFILE-005 Scrap
INSERT INTO bom_scrap (bom_id, item_code, item_name, quantity, rate, sequence, created_at)
VALUES 
('BOM-IND-PROFILE-005', 'ITEM-SCRAP-ALUM', 'Aluminum Scrap Waste', 0.25, 50.00, 1, NOW());

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- Run these to verify the data was inserted correctly:

-- SELECT COUNT(*) as total_boms FROM bom;
-- SELECT COUNT(*) as total_lines FROM bom_line;
-- SELECT COUNT(*) as total_operations FROM bom_operation;
-- SELECT COUNT(*) as total_scrap FROM bom_scrap;
-- 
-- SELECT 
--   b.bom_id, 
--   b.item_code, 
--   b.product_name, 
--   b.status, 
--   COUNT(DISTINCT bl.line_id) as material_count,
--   COUNT(DISTINCT bo.operation_id) as operation_count,
--   COUNT(DISTINCT bs.scrap_id) as scrap_count
-- FROM bom b
-- LEFT JOIN bom_line bl ON b.bom_id = bl.bom_id
-- LEFT JOIN bom_operation bo ON b.bom_id = bo.bom_id
-- LEFT JOIN bom_scrap bs ON b.bom_id = bs.bom_id
-- GROUP BY b.bom_id
-- ORDER BY b.created_at DESC;
