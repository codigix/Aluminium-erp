-- ============================================================
-- Migration: 025-sync-prod-missing-columns.sql
-- Purpose: Add columns present in spTech_dev but missing in spTech_prod
-- Tables:  customer_pos, po_receipt_items
-- Date:    2026-07-16
-- ============================================================

-- 1. customer_pos: add contact_person, email, phone, gstin, billing_address, shipping_address
ALTER TABLE `customer_pos`
  ADD COLUMN `contact_person`   VARCHAR(255) NULL AFTER `host_company_id`,
  ADD COLUMN `email`            VARCHAR(255) NULL AFTER `contact_person`,
  ADD COLUMN `phone`            VARCHAR(255) NULL AFTER `email`,
  ADD COLUMN `gstin`            VARCHAR(100) NULL AFTER `phone`,
  ADD COLUMN `billing_address`  TEXT         NULL AFTER `gstin`,
  ADD COLUMN `shipping_address` TEXT         NULL AFTER `billing_address`;

-- 2. po_receipt_items: add po_qty
ALTER TABLE `po_receipt_items`
  ADD COLUMN `po_qty` DECIMAL(12,3) NULL DEFAULT 0.000 AFTER `unit`;
