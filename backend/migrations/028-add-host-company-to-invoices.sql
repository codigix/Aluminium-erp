-- ============================================================
-- Migration: 028-add-host-company-to-invoices.sql
-- Purpose: Add host_company_id column to sales_invoices
-- Tables:  sales_invoices
-- Date:    2026-10-15
-- ============================================================

ALTER TABLE `sales_invoices`
  ADD COLUMN `host_company_id` INT NULL AFTER `client_id`;
