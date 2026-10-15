-- ============================================================
-- Migration: 027-add-igst-to-orders.sql
-- Purpose: Add igst_rate and is_interstate columns to orders and sales_orders
-- Tables:  orders, sales_orders
-- Date:    2026-10-14
-- ============================================================

-- 1. orders: add igst_rate and is_interstate
ALTER TABLE `orders`
  ADD COLUMN `igst_rate` DECIMAL(5,2) DEFAULT 0.00 AFTER `sgst_rate`,
  ADD COLUMN `is_interstate` TINYINT(1) DEFAULT 0 AFTER `igst_rate`;

-- 2. sales_orders: add igst_rate and is_interstate
ALTER TABLE `sales_orders`
  ADD COLUMN `igst_rate` DECIMAL(5,2) DEFAULT 0.00 AFTER `sgst_rate`,
  ADD COLUMN `is_interstate` TINYINT(1) DEFAULT 0 AFTER `igst_rate`;
