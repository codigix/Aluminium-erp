-- ============================================================
-- Migration: 029-alter-file-path-to-text.sql
-- Purpose: Change file_path and drawing_pdf columns to TEXT to allow uploading 7+ files per drawing
-- Tables:  customer_drawings, sales_order_items, order_items
-- Date:    2026-10-15
-- ============================================================

ALTER TABLE `customer_drawings` MODIFY `file_path` TEXT NOT NULL;
ALTER TABLE `sales_order_items` MODIFY `drawing_pdf` TEXT NULL;
ALTER TABLE `order_items` MODIFY `drawing_pdf` TEXT NULL;
