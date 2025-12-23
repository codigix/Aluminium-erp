-- ==========================================
-- BOM TABLES STRUCTURE FIX
-- ==========================================
-- This script ensures all required columns exist in BOM tables

-- ==========================================
-- 1. FIX bom_line TABLE
-- ==========================================
ALTER TABLE bom_line 
ADD COLUMN IF NOT EXISTS warehouse VARCHAR(100),
ADD COLUMN IF NOT EXISTS operation VARCHAR(100),
ADD COLUMN IF NOT EXISTS rate DECIMAL(18,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount DECIMAL(18,2) DEFAULT 0;

-- ==========================================
-- 2. FIX bom TABLE
-- ==========================================
ALTER TABLE bom 
ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS process_loss_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost DECIMAL(18,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- ==========================================
-- 3. VERIFY TABLE STRUCTURES
-- ==========================================
-- Verify bom table
DESCRIBE bom;

-- Verify bom_line table
DESCRIBE bom_line;

-- Verify bom_operation table
DESCRIBE bom_operation;

-- Verify bom_scrap table
DESCRIBE bom_scrap;
