-- Setup Reference Data Tables Migration
-- This script creates all the setup/master data tables for the ERP system

USE aluminium_erp;

-- ============================================================================
-- SETUP MODULE TABLES
-- ============================================================================

-- Payment Terms Table
CREATE TABLE IF NOT EXISTS setup_payment_terms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Payment term name (e.g., "Net 30")',
  description TEXT COMMENT 'Description of the payment term',
  days INT DEFAULT 0 COMMENT 'Number of days for payment',
  months INT DEFAULT 0 COMMENT 'Number of months for payment',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this payment term active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment terms configuration';

-- Letter Heads Table
CREATE TABLE IF NOT EXISTS setup_letter_heads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Letter head name',
  company_id INT COMMENT 'Associated company',
  content LONGTEXT COMMENT 'Letter head HTML content',
  logo_url VARCHAR(255) COMMENT 'URL to company logo',
  is_default BOOLEAN DEFAULT false COMMENT 'Is this the default letter head?',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this letter head active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Letter head templates';

-- Campaigns Table
CREATE TABLE IF NOT EXISTS setup_campaigns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Campaign name',
  description TEXT COMMENT 'Campaign description',
  start_date DATE COMMENT 'Campaign start date',
  end_date DATE COMMENT 'Campaign end date',
  status VARCHAR(50) COMMENT 'Campaign status (Active, Inactive, Completed)',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this campaign active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sales campaigns';

-- Territories Table
CREATE TABLE IF NOT EXISTS setup_territories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Territory name',
  parent_territory_id INT COMMENT 'Parent territory ID for hierarchical structure',
  description TEXT COMMENT 'Territory description',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this territory active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_parent (parent_territory_id),
  FOREIGN KEY (parent_territory_id) REFERENCES setup_territories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sales territories';

-- Lead Sources Table
CREATE TABLE IF NOT EXISTS setup_lead_sources (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Lead source name',
  description TEXT COMMENT 'Lead source description',
  source_type VARCHAR(50) COMMENT 'Source type (Online, Direct, Event, Referral)',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this lead source active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_source_type (source_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lead sources for tracking';

-- Lost Reasons Table
CREATE TABLE IF NOT EXISTS setup_lost_reasons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Lost reason name',
  description TEXT COMMENT 'Description of why deal was lost',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this reason active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Reasons for lost deals';

-- Tax Categories Table
CREATE TABLE IF NOT EXISTS setup_tax_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Tax category name',
  description TEXT COMMENT 'Tax category description',
  tax_rate DECIMAL(5,2) DEFAULT 0 COMMENT 'Tax rate percentage',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this tax category active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tax categories and rates';

-- Shipping Rules Table
CREATE TABLE IF NOT EXISTS setup_shipping_rules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Shipping rule name',
  from_weight DECIMAL(10,2) COMMENT 'From weight in Kg',
  to_weight DECIMAL(10,2) COMMENT 'To weight in Kg',
  shipping_cost DECIMAL(10,2) COMMENT 'Shipping cost',
  description TEXT COMMENT 'Rule description',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this rule active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_weight_range (from_weight, to_weight)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Shipping cost rules';

-- Incoterms Table
CREATE TABLE IF NOT EXISTS setup_incoterms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL COMMENT 'Incoterm code',
  description TEXT COMMENT 'Incoterm description',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this incoterm active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='International commercial terms (Incoterms)';

-- Sales Taxes & Charges Template Table
CREATE TABLE IF NOT EXISTS setup_sales_taxes_charges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Template name',
  description TEXT COMMENT 'Template description',
  tax_type VARCHAR(50) COMMENT 'Type of tax (GST, VAT, etc.)',
  tax_rate DECIMAL(5,2) COMMENT 'Tax rate percentage',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this template active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_tax_type (tax_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sales tax and charges templates';

-- Cost Centers Table
CREATE TABLE IF NOT EXISTS setup_cost_centers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Cost center name',
  code VARCHAR(50) COMMENT 'Cost center code',
  description TEXT COMMENT 'Cost center description',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this cost center active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cost centers for accounting';

-- Projects Table
CREATE TABLE IF NOT EXISTS setup_projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Project name',
  code VARCHAR(50) COMMENT 'Project code',
  description TEXT COMMENT 'Project description',
  status VARCHAR(50) COMMENT 'Project status (Active, Inactive, Completed)',
  start_date DATE COMMENT 'Project start date',
  end_date DATE COMMENT 'Project end date',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this project active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_code (code),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Projects for tracking';

-- Price Lists Table
CREATE TABLE IF NOT EXISTS setup_price_lists (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Price list name',
  price_list_type VARCHAR(50) COMMENT 'Type (Selling or Buying)',
  currency VARCHAR(10) COMMENT 'Currency code (e.g., INR, USD)',
  description TEXT COMMENT 'Price list description',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this price list active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_type (price_list_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Price lists for products';

-- Account Heads Table
CREATE TABLE IF NOT EXISTS setup_account_heads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Account head name',
  account_type VARCHAR(50) COMMENT 'Account type (Asset, Liability, Income, Expense)',
  account_number VARCHAR(50) COMMENT 'Account number',
  description TEXT COMMENT 'Account description',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this account active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_account_type (account_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Chart of accounts - account heads';

-- ============================================================================
-- CRM MODULE TABLES
-- ============================================================================

-- Contact Persons Table
CREATE TABLE IF NOT EXISTS crm_contact_persons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT 'Contact person name',
  supplier_id INT COMMENT 'Associated supplier ID',
  customer_id INT COMMENT 'Associated customer ID',
  email VARCHAR(100) COMMENT 'Email address',
  phone VARCHAR(20) COMMENT 'Phone number',
  designation VARCHAR(100) COMMENT 'Job designation',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this contact active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_supplier_id (supplier_id),
  KEY idx_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Contact persons for suppliers and customers';

-- Sales Partners Table
CREATE TABLE IF NOT EXISTS crm_sales_partners (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Partner name',
  partner_type VARCHAR(50) COMMENT 'Partner type (Distributor, Dealer, Agent)',
  commission_rate DECIMAL(5,2) COMMENT 'Commission rate percentage',
  description TEXT COMMENT 'Partner description',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this partner active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name),
  KEY idx_partner_type (partner_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sales partners (Distributors, Dealers)';

-- ============================================================================
-- SELLING MODULE EXTENSIONS
-- ============================================================================

-- Coupon Codes Table
CREATE TABLE IF NOT EXISTS selling_coupon_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Coupon code',
  discount_percentage DECIMAL(5,2) COMMENT 'Discount percentage',
  discount_amount DECIMAL(10,2) COMMENT 'Fixed discount amount',
  min_order_value DECIMAL(10,2) COMMENT 'Minimum order value to apply coupon',
  max_uses INT COMMENT 'Maximum number of uses allowed',
  uses_count INT DEFAULT 0 COMMENT 'Current number of uses',
  valid_from DATE COMMENT 'Coupon validity start date',
  valid_till DATE COMMENT 'Coupon validity end date',
  is_active BOOLEAN DEFAULT true COMMENT 'Is this coupon active?',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_code (code),
  KEY idx_valid_dates (valid_from, valid_till),
  KEY idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sales coupon codes';

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert default Payment Terms
INSERT IGNORE INTO setup_payment_terms (name, description, days, months, is_active) VALUES
('Immediate (COD)', 'Cash on Delivery', 0, 0, true),
('7 Days', '7 days payment', 7, 0, true),
('14 Days', '14 days payment', 14, 0, true),
('30 Days', '30 days payment', 30, 0, true),
('60 Days', '60 days payment', 60, 0, true),
('90 Days', '90 days payment', 90, 0, true),
('1 Month', '1 month payment', 0, 1, true),
('2 Months', '2 months payment', 0, 2, true),
('3 Months', '3 months payment', 0, 3, true);

-- Insert default Tax Categories
INSERT IGNORE INTO setup_tax_categories (name, description, tax_rate, is_active) VALUES
('GST 5%', 'Goods and Services Tax 5%', 5, true),
('GST 12%', 'Goods and Services Tax 12%', 12, true),
('GST 18%', 'Goods and Services Tax 18%', 18, true),
('GST 28%', 'Goods and Services Tax 28%', 28, true),
('Exempted', 'Tax Exempted Items', 0, true);

-- Insert default Territories
INSERT IGNORE INTO setup_territories (name, description, is_active) VALUES
('North', 'Northern Region', true),
('South', 'Southern Region', true),
('East', 'Eastern Region', true),
('West', 'Western Region', true),
('Central', 'Central Region', true);

-- Insert default Lead Sources
INSERT IGNORE INTO setup_lead_sources (name, description, source_type, is_active) VALUES
('Website', 'Leads from website', 'Online', true),
('Phone Call', 'Direct phone calls', 'Direct', true),
('Email', 'Email inquiries', 'Online', true),
('Referral', 'Referred by existing customers', 'Direct', true),
('Trade Show', 'Trade show and events', 'Event', true),
('Social Media', 'Social media channels', 'Online', true);

-- Insert default Lost Reasons
INSERT IGNORE INTO setup_lost_reasons (name, description, is_active) VALUES
('Price too high', 'Customer found better pricing elsewhere', true),
('Competitor won', 'Competitor secured the deal', true),
('No response', 'Customer became non-responsive', true),
('Quality concerns', 'Customer had quality concerns', true),
('Timing issue', 'Not the right time for purchase', true);

-- Insert default Incoterms
INSERT IGNORE INTO setup_incoterms (name, description, is_active) VALUES
('FOB', 'Free on Board', true),
('CIF', 'Cost, Insurance and Freight', true),
('CDD', 'Cash and Carry Delivery', true),
('EXW', 'Ex Works', true),
('DDP', 'Delivered Duty Paid', true);

-- Insert default Cost Centers
INSERT IGNORE INTO setup_cost_centers (name, code, description, is_active) VALUES
('Operations', 'CC-001', 'Operations department', true),
('Sales', 'CC-002', 'Sales department', true),
('Administration', 'CC-003', 'Administration department', true),
('Finance', 'CC-004', 'Finance department', true);

-- Insert default Sales Taxes & Charges
INSERT IGNORE INTO setup_sales_taxes_charges (name, description, tax_type, tax_rate, is_active) VALUES
('CGST', 'Central Goods and Services Tax', 'GST', 9, true),
('SGST', 'State Goods and Services Tax', 'GST', 9, true),
('IGST', 'Integrated Goods and Services Tax', 'GST', 18, true);

-- Insert default Price Lists
INSERT IGNORE INTO setup_price_lists (name, price_list_type, currency, description, is_active) VALUES
('Standard Price List', 'Selling', 'INR', 'Standard selling price list', true),
('Wholesale Price List', 'Selling', 'INR', 'Wholesale selling price list', true),
('Supplier Price List', 'Buying', 'INR', 'Purchase price list from suppliers', true);

-- Insert default Account Heads
INSERT IGNORE INTO setup_account_heads (name, account_type, description, is_active) VALUES
('Cash', 'Asset', 'Cash in hand', true),
('Bank Account', 'Asset', 'Bank account balance', true),
('Accounts Receivable', 'Asset', 'Money owed by customers', true),
('Accounts Payable', 'Liability', 'Money owed to suppliers', true),
('Revenue', 'Income', 'Sales revenue', true),
('Expenses', 'Expense', 'Operating expenses', true);

-- Insert default Campaigns
INSERT IGNORE INTO setup_campaigns (name, description, status, is_active) VALUES
('Summer Sale', 'Summer seasonal campaign', 'Active', true),
('New Year Offer', 'New Year promotional campaign', 'Active', true),
('Festival Sale', 'Festival season offers', 'Active', true);

-- Insert default Letter Head
INSERT IGNORE INTO setup_letter_heads (name, company_id, is_default, is_active) VALUES
('Default Letter Head', 1, true, true);

-- Insert default Sales Partners
INSERT IGNORE INTO crm_sales_partners (name, partner_type, commission_rate, description, is_active) VALUES
('Partner A', 'Distributor', 10, 'Regional distributor', true),
('Partner B', 'Dealer', 15, 'Authorized dealer', true);

-- Insert default Shipping Rules
INSERT IGNORE INTO setup_shipping_rules (name, from_weight, to_weight, shipping_cost, description, is_active) VALUES
('0-5 Kg', 0, 5, 50, 'Shipping cost for 0-5 Kg', true),
('5-10 Kg', 5, 10, 100, 'Shipping cost for 5-10 Kg', true),
('10-25 Kg', 10, 25, 200, 'Shipping cost for 10-25 Kg', true),
('25-50 Kg', 25, 50, 350, 'Shipping cost for 25-50 Kg', true);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
COMMIT;
