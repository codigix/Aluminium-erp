◇ injected env (17) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }
-- CreateTable
CREATE TABLE `bank_accounts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bank_name` VARCHAR(255) NOT NULL,
    `account_number` VARCHAR(50) NOT NULL,
    `ifsc_code` VARCHAR(20) NULL,
    `account_holder_name` VARCHAR(255) NULL,
    `account_type` ENUM('SAVINGS', 'CURRENT', 'OTHER') NULL DEFAULT 'CURRENT',
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `account_number`(`account_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bom` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_code` VARCHAR(120) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `description` TEXT NULL,
    `uom` VARCHAR(20) NULL,
    `item_group` VARCHAR(100) NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_drawing_no`(`drawing_no`),
    INDEX `idx_item_code`(`item_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bom_approval_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `action` ENUM('APPROVED', 'REJECTED') NOT NULL,
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `sales_order_id`(`sales_order_id`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bom_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bom_id` INTEGER NOT NULL,
    `component_code` VARCHAR(120) NOT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    `uom` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_bom_id`(`bom_id`),
    INDEX `idx_component_code`(`component_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(255) NOT NULL,
    `company_code` VARCHAR(32) NOT NULL,
    `customer_type` VARCHAR(50) NULL DEFAULT 'REGULAR',
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `gstin` VARCHAR(20) NULL,
    `cin` VARCHAR(40) NULL,
    `pan` VARCHAR(20) NULL,
    `payment_terms` VARCHAR(255) NULL,
    `credit_days` INTEGER NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'INR',
    `freight_terms` VARCHAR(255) NULL,
    `packing_forwarding` VARCHAR(255) NULL,
    `insurance_terms` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `company_code`(`company_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_addresses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `address_type` ENUM('BILLING', 'SHIPPING') NOT NULL,
    `line1` VARCHAR(255) NOT NULL,
    `line2` VARCHAR(255) NULL,
    `city` VARCHAR(120) NULL,
    `state` VARCHAR(120) NULL,
    `pincode` VARCHAR(20) NULL,
    `country` VARCHAR(120) NULL DEFAULT 'India',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `company_id`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contacts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `name` VARCHAR(120) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(30) NULL,
    `designation` VARCHAR(120) NULL,
    `contact_type` ENUM('PRIMARY', 'PURCHASE', 'ACCOUNTS', 'TECHNICAL', 'OTHER') NULL DEFAULT 'PRIMARY',
    `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `company_id`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_drawings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_name` VARCHAR(255) NULL,
    `client_name` VARCHAR(255) NULL,
    `drawing_no` VARCHAR(120) NOT NULL,
    `revision` VARCHAR(50) NULL,
    `qty` INTEGER NULL DEFAULT 1,
    `description` TEXT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(20) NULL,
    `remarks` TEXT NULL,
    `type` VARCHAR(50) NULL DEFAULT 'Customer',
    `purpose` VARCHAR(50) NULL DEFAULT 'Reference Only',
    `uploaded_by` VARCHAR(120) NULL,
    `status` ENUM('PENDING', 'SHARED') NULL DEFAULT 'PENDING',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `contact_person` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NULL,
    `customer_type` VARCHAR(50) NULL,
    `gstin` VARCHAR(50) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `billing_address` TEXT NULL,
    `shipping_address` TEXT NULL,
    `shared_with_design` BOOLEAN NULL DEFAULT false,
    `shared_at` TIMESTAMP(0) NULL,
    `excel_path` VARCHAR(255) NULL,
    `zip_path` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_id` INTEGER NOT NULL,
    `reference_doc_id` INTEGER NULL,
    `reference_doc_type` ENUM('SALES_ORDER', 'CUSTOMER_INVOICE', 'PAYMENT', 'DEBIT_NOTE', 'CREDIT_NOTE') NOT NULL,
    `transaction_type` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `description` TEXT NULL,
    `ledger_date` DATE NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_customer_date`(`customer_id`, `ledger_date`),
    INDEX `idx_reference`(`reference_doc_id`, `reference_doc_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_receipt_no` VARCHAR(100) NULL,
    `invoice_id` INTEGER NULL,
    `sales_order_id` INTEGER NULL,
    `sales_order_source` ENUM('SALES_ORDER', 'DIRECT_ORDER') NULL DEFAULT 'SALES_ORDER',
    `customer_id` INTEGER NOT NULL,
    `payment_amount` DECIMAL(14, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `payment_mode` ENUM('BANK_TRANSFER', 'UPI', 'CHEQUE', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH') NOT NULL,
    `transaction_ref_no` VARCHAR(255) NULL,
    `bank_account_id` INTEGER NULL,
    `manual_bank_account` VARCHAR(255) NULL,
    `remarks` TEXT NULL,
    `upi_app` VARCHAR(50) NULL,
    `upi_transaction_id` VARCHAR(255) NULL,
    `cheque_number` VARCHAR(100) NULL,
    `cheque_bank_name` VARCHAR(255) NULL,
    `cheque_date` DATE NULL,
    `card_type` VARCHAR(50) NULL,
    `card_last_4_digits` VARCHAR(4) NULL,
    `authorization_code` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'FAILED') NULL DEFAULT 'CONFIRMED',
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `payment_receipt_no`(`payment_receipt_no`),
    INDEX `bank_account_id`(`bank_account_id`),
    INDEX `created_by`(`created_by`),
    INDEX `idx_customer_date`(`customer_id`, `payment_date`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_po_item_subassemblies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `po_item_id` INTEGER NOT NULL,
    `drawing_no` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(15, 3) NULL,
    `unit` VARCHAR(50) NULL,
    `rate` DECIMAL(15, 2) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `po_item_id`(`po_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_po_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_po_id` INTEGER NOT NULL,
    `item_code` VARCHAR(120) NULL,
    `description` TEXT NOT NULL,
    `hsn_code` VARCHAR(50) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `revision_no` VARCHAR(50) NULL,
    `quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `unit` VARCHAR(20) NULL DEFAULT 'NOS',
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `basic_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `discount` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `cgst_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `cgst_amount` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `sgst_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `sgst_amount` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `igst_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `igst_amount` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `delivery_date` DATE NULL,
    `purchase_req_no` VARCHAR(120) NULL,
    `customer_reference` VARCHAR(120) NULL,

    INDEX `customer_po_id`(`customer_po_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_pos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `project_name` VARCHAR(255) NULL,
    `po_number` VARCHAR(100) NULL,
    `po_date` DATE NULL,
    `po_version` VARCHAR(20) NULL,
    `order_type` VARCHAR(40) NULL,
    `plant` VARCHAR(120) NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'INR',
    `payment_terms` VARCHAR(255) NULL,
    `credit_days` INTEGER NULL,
    `freight_terms` VARCHAR(255) NULL,
    `packing_forwarding` VARCHAR(255) NULL,
    `insurance_terms` VARCHAR(255) NULL,
    `delivery_terms` VARCHAR(255) NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'REJECTED') NULL DEFAULT 'DRAFT',
    `pdf_path` VARCHAR(500) NULL,
    `subtotal` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `tax_total` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `net_total` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `remarks` TEXT NULL,
    `terms_and_conditions` TEXT NULL,
    `special_notes` TEXT NULL,
    `inspection_clause` VARCHAR(50) NULL,
    `test_certificate` VARCHAR(50) NULL,
    `requesting_department_id` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `company_id`(`company_id`),
    INDEX `requesting_department_id`(`requesting_department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_challan_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `challan_id` INTEGER NOT NULL,
    `item_code` VARCHAR(120) NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unit` VARCHAR(20) NULL,
    `weight` DECIMAL(12, 3) NULL,

    INDEX `challan_id`(`challan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_challans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `challan_number` VARCHAR(50) NOT NULL,
    `shipment_id` INTEGER NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `delivery_status` ENUM('DRAFT', 'COMPLETED') NULL DEFAULT 'DRAFT',
    `dispatch_time` TIMESTAMP(0) NULL,
    `delivery_time` TIMESTAMP(0) NULL,
    `receiver_name` VARCHAR(120) NULL,
    `receiver_mobile` VARCHAR(30) NULL,
    `signature_file` VARCHAR(500) NULL,
    `photo_proof` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `challan_number`(`challan_number`),
    INDEX `customer_id`(`customer_id`),
    INDEX `shipment_id`(`shipment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `name`(`name`),
    UNIQUE INDEX `code`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `design_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `design_order_number` VARCHAR(100) NOT NULL,
    `sales_order_id` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'IN_DESIGN', 'COMPLETED') NULL DEFAULT 'DRAFT',
    `start_date` TIMESTAMP(0) NULL,
    `completion_date` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `design_order_number`(`design_order_number`),
    INDEX `sales_order_id`(`sales_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `design_rejections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_id` INTEGER NOT NULL,
    `reason` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `sales_order_id`(`sales_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_access_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `document_type` VARCHAR(50) NULL,
    `document_id` INTEGER NULL,
    `action` VARCHAR(50) NULL,
    `status` VARCHAR(50) NULL,
    `timestamp` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grn_excess_approvals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grn_item_id` INTEGER NOT NULL,
    `excess_qty` DECIMAL(12, 3) NOT NULL,
    `status` VARCHAR(50) NULL DEFAULT 'PENDING',
    `approval_notes` TEXT NULL,
    `rejection_reason` TEXT NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `rejected_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `grn_item_id`(`grn_item_id`),
    INDEX `idx_grn_excess_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grn_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grn_id` INTEGER NOT NULL,
    `po_item_id` INTEGER NOT NULL,
    `po_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `received_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `accepted_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `rejected_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `shortage_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `overage_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `status` VARCHAR(50) NULL,
    `remarks` TEXT NULL,
    `is_approved` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `allocated_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `allocation_status` ENUM('PENDING', 'PARTIAL', 'FULLY_ALLOCATED') NULL DEFAULT 'PENDING',
    `warehouse_id` INTEGER NULL,
    `length` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `width` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `thickness` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `outer_diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `density` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `weight_per_unit` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `uom` VARCHAR(20) NULL,

    INDEX `fk_grn_items_warehouse`(`warehouse_id`),
    INDEX `grn_id`(`grn_id`),
    INDEX `idx_grn_items_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `po_number` VARCHAR(100) NOT NULL,
    `grn_date` DATE NOT NULL,
    `received_quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `status` ENUM('PENDING', 'RECEIVED', 'INSPECTED', 'APPROVED', 'REJECTED') NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `po_receipt_id` INTEGER NULL,

    INDEX `idx_po_number`(`po_number`),
    INDEX `idx_po_number_grn`(`po_number`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_code` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `unit` VARCHAR(50) NULL,
    `category_id` INTEGER NULL,
    `stock_on_hand` INTEGER NULL DEFAULT 0,
    `reorder_level` INTEGER NULL DEFAULT 0,
    `reorder_qty` INTEGER NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `item_code`(`item_code`),
    INDEX `idx_item_code`(`item_code`),
    INDEX `idx_stock`(`stock_on_hand`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_dashboard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `total_stock_on_hand` INTEGER NULL DEFAULT 0,
    `today_inward_qty` INTEGER NULL DEFAULT 0,
    `grn_count` INTEGER NULL DEFAULT 0,
    `pending_po_qty` INTEGER NULL DEFAULT 0,
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_postings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inventory_id` INTEGER NOT NULL,
    `posting_type` VARCHAR(50) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` INTEGER NULL,
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_inventory_id`(`inventory_id`),
    INDEX `idx_inventory_postings_type`(`posting_type`),
    INDEX `idx_posting_type`(`posting_type`),
    INDEX `idx_reference`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inward_challan_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inward_challan_id` INTEGER NOT NULL,
    `item_code` VARCHAR(120) NULL,
    `received_qty` DECIMAL(12, 3) NULL,
    `accepted_qty` DECIMAL(12, 3) NULL,
    `rejected_qty` DECIMAL(12, 3) NULL,
    `scrap_qty` DECIMAL(12, 3) NULL,
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,

    INDEX `inward_challan_id`(`inward_challan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inward_challans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inward_number` VARCHAR(50) NOT NULL,
    `outward_challan_id` INTEGER NOT NULL,
    `job_card_id` INTEGER NOT NULL,
    `vendor_id` INTEGER NOT NULL,
    `received_date` DATE NULL,
    `vendor_invoice_no` VARCHAR(100) NULL,
    `total_received_qty` DECIMAL(12, 3) NULL,
    `notes` TEXT NULL,
    `status` ENUM('RECEIVED', 'INSPECTED', 'APPROVED') NULL DEFAULT 'RECEIVED',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `inward_number`(`inward_number`),
    INDEX `job_card_id`(`job_card_id`),
    INDEX `outward_challan_id`(`outward_challan_id`),
    INDEX `vendor_id`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `group_type` VARCHAR(50) NULL DEFAULT 'OTHER',
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `itemsPublic_id` VARCHAR(100) NULL,

    UNIQUE INDEX `name`(`name`),
    UNIQUE INDEX `item_groups_itemsPublic_id_key`(`itemsPublic_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_code` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `uom` VARCHAR(20) NULL,
    `item_group` VARCHAR(100) NULL,
    `valuation_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `selling_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `weight_per_unit` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `length` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `width` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `thickness` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `diameter` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `outer_diameter` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `item_code`(`item_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_card_downtime_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_card_id` INTEGER NOT NULL,
    `day` INTEGER NULL,
    `downtime_date` DATE NOT NULL,
    `shift` VARCHAR(20) NULL,
    `downtime_type` VARCHAR(100) NULL,
    `start_time` DATETIME(0) NULL,
    `end_time` DATETIME(0) NULL,
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `job_card_id`(`job_card_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_card_inward_item_rates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quality_log_id` INTEGER NOT NULL,
    `item_code` VARCHAR(100) NOT NULL,
    `release_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `rate` DECIMAL(15, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `quality_log_id`(`quality_log_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_card_quality_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_card_id` INTEGER NOT NULL,
    `day` INTEGER NULL,
    `check_date` DATE NOT NULL,
    `shift` VARCHAR(20) NULL,
    `inspected_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `accepted_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `rejected_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `scrap_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `rejection_reason` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'PAID') NULL DEFAULT 'PENDING',
    `vendor_invoice` VARCHAR(255) NULL,
    `sub_total` DECIMAL(15, 2) NULL DEFAULT 0.00,
    `gst_amount` DECIMAL(15, 2) NULL DEFAULT 0.00,
    `grand_total` DECIMAL(15, 2) NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `start_time` VARCHAR(20) NULL,
    `end_time` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `job_card_id`(`job_card_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_card_time_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_card_id` INTEGER NOT NULL,
    `day` INTEGER NULL,
    `log_date` DATE NOT NULL,
    `operator_id` INTEGER NULL,
    `workstation_id` INTEGER NULL,
    `shift` VARCHAR(20) NULL,
    `start_time` DATETIME(0) NULL,
    `end_time` DATETIME(0) NULL,
    `produced_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `job_card_id`(`job_card_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_cards` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_card_no` VARCHAR(50) NULL,
    `work_order_id` INTEGER NOT NULL,
    `operation_id` INTEGER NULL,
    `workstation_id` INTEGER NULL,
    `assigned_to` INTEGER NULL,
    `planned_qty` DECIMAL(12, 3) NULL,
    `produced_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `accepted_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `rejected_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `actual_start_date` DATE NULL,
    `start_time` TIMESTAMP(0) NULL,
    `end_time` TIMESTAMP(0) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED') NULL DEFAULT 'DRAFT',
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `std_time` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `time_uom` VARCHAR(20) NULL DEFAULT 'Min',
    `hourly_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `operation_name` VARCHAR(255) NULL,
    `execution_type` VARCHAR(100) NULL DEFAULT 'In-House',
    `execution_mode` VARCHAR(100) NULL DEFAULT 'In-house',
    `vendor_id` INTEGER NULL,
    `vendor_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `sequence_no` INTEGER NULL DEFAULT 0,
    `target_warehouse_id` INTEGER NULL,
    `outward_challan_id` INTEGER NULL,
    `outward_challan_no` VARCHAR(100) NULL,
    `dispatch_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `jc_number` VARCHAR(100) NULL,
    `cycle_time` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `setup_time` DECIMAL(12, 3) NULL DEFAULT 0.000,

    UNIQUE INDEX `job_card_no`(`job_card_no`),
    INDEX `assigned_to`(`assigned_to`),
    INDEX `operation_id`(`operation_id`),
    INDEX `work_order_id`(`work_order_id`),
    INDEX `workstation_id`(`workstation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_issue_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issue_id` INTEGER NOT NULL,
    `material_name` VARCHAR(255) NULL,
    `material_type` VARCHAR(100) NULL,
    `item_code` VARCHAR(100) NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `uom` VARCHAR(20) NULL,
    `warehouse` VARCHAR(100) NULL,

    INDEX `issue_id`(`issue_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_issues` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issue_number` VARCHAR(50) NOT NULL,
    `work_order_id` INTEGER NOT NULL,
    `issued_date` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `issued_by` INTEGER NULL,
    `remarks` TEXT NULL,

    UNIQUE INDEX `issue_number`(`issue_number`),
    INDEX `issued_by`(`issued_by`),
    INDEX `work_order_id`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_request_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mr_id` INTEGER NOT NULL,
    `item_code` VARCHAR(100) NOT NULL,
    `item_name` VARCHAR(255) NULL,
    `item_type` VARCHAR(50) NULL,
    `design_qty` DECIMAL(12, 3) NULL,
    `planned_qty` DECIMAL(14, 3) NULL DEFAULT 0.000,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unit_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `uom` VARCHAR(20) NULL,
    `allocated_quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `warehouse` VARCHAR(100) NULL,

    INDEX `mr_id`(`mr_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mr_number` VARCHAR(50) NOT NULL,
    `department` VARCHAR(100) NULL,
    `requested_by` INTEGER NULL,
    `required_by` DATE NULL,
    `purpose` ENUM('Purchase Request', 'Internal Transfer', 'Material Issue') NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'PROCESSING', 'FULFILLED', 'CANCELLED', 'ORDERED', 'COMPLETED', 'PO_CREATED') NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `target_warehouse` VARCHAR(100) NULL,
    `source_warehouse` VARCHAR(100) NULL,
    `linked_po` VARCHAR(100) NULL,
    `linked_po_id` INTEGER NULL,
    `linked_po_number` VARCHAR(100) NULL,
    `plan_id` INTEGER NULL,

    UNIQUE INDEX `mr_number`(`mr_number`),
    INDEX `requested_by`(`requested_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `density` DECIMAL(10, 4) NOT NULL,
    `density_unit` VARCHAR(20) NULL DEFAULT 'g/cm³',
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `migrations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `file_name` VARCHAR(255) NOT NULL,
    `executed_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `file_name`(`file_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_workstations` (
    `operation_id` INTEGER NOT NULL,
    `workstation_id` INTEGER NOT NULL,

    INDEX `workstation_id`(`workstation_id`),
    PRIMARY KEY (`operation_id`, `workstation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operation_code` VARCHAR(50) NOT NULL,
    `operation_name` VARCHAR(100) NOT NULL,
    `workstation_id` INTEGER NULL,
    `std_time` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `time_uom` ENUM('Hr', 'Min', 'Sec') NULL DEFAULT 'Hr',
    `hourly_rate` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `is_active` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `operation_code`(`operation_code`),
    INDEX `workstation_id`(`workstation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_item_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `parent_id` INTEGER NULL,
    `drawing_no` VARCHAR(120) NULL,
    `source_fg` VARCHAR(120) NULL,
    `component_code` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,
    `uom` VARCHAR(20) NULL,
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `loss_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `order_item_id`(`order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_materials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_item_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `parent_id` INTEGER NULL,
    `drawing_no` VARCHAR(120) NULL,
    `material_name` VARCHAR(255) NULL,
    `qty` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `qty_per_pc` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `uom` VARCHAR(20) NULL DEFAULT 'KG',
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `warehouse` VARCHAR(100) NULL,
    `operation` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `item_group` VARCHAR(100) NULL,
    `weight_per_unit` DECIMAL(10, 4) NULL DEFAULT 0.0000,
    `scrap_percent` DECIMAL(10, 2) NULL DEFAULT 0.00,

    INDEX `order_item_id`(`order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_operations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_item_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `operation_name` VARCHAR(100) NOT NULL,
    `workstation` VARCHAR(100) NULL,
    `cycle_time_min` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `setup_time_min` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `hourly_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `operation_type` VARCHAR(100) NULL DEFAULT 'In-House',
    `target_warehouse` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `order_item_id`(`order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_scrap` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_item_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `parent_id` INTEGER NULL,
    `drawing_no` VARCHAR(120) NULL,
    `scrap_item_code` VARCHAR(100) NULL,
    `item_name` VARCHAR(255) NULL,
    `input_qty` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `loss_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `order_item_id`(`order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `item_code` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `drawing_id` INTEGER NULL,
    `revision_no` VARCHAR(50) NULL,
    `drawing_pdf` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `type` VARCHAR(100) NULL,
    `quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `amount` DECIMAL(12, 2) NULL DEFAULT 0.00,

    INDEX `order_id`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_no` VARCHAR(50) NULL,
    `client_id` INTEGER NULL,
    `quotation_id` INTEGER NULL,
    `project_name` VARCHAR(255) NULL,
    `order_date` DATE NULL,
    `delivery_date` DATE NULL,
    `status` VARCHAR(50) NULL DEFAULT 'Created',
    `source_type` VARCHAR(50) NULL DEFAULT 'DIRECT',
    `warehouse` VARCHAR(100) NULL,
    `cgst_rate` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `sgst_rate` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `profit_margin` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `subtotal` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `gst` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `grand_total` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `order_no`(`order_no`),
    INDEX `idx_client`(`client_id`),
    INDEX `idx_quotation`(`quotation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outward_challan_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `challan_id` INTEGER NOT NULL,
    `item_code` VARCHAR(120) NULL,
    `required_qty` DECIMAL(12, 3) NULL,
    `release_qty` DECIMAL(12, 3) NULL,

    INDEX `challan_id`(`challan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outward_challans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `challan_number` VARCHAR(50) NOT NULL,
    `job_card_id` INTEGER NOT NULL,
    `work_order_id` INTEGER NOT NULL,
    `vendor_id` INTEGER NOT NULL,
    `operation_name` VARCHAR(255) NULL,
    `planned_qty` DECIMAL(12, 3) NULL,
    `dispatch_qty` DECIMAL(12, 3) NULL,
    `dispatch_date` DATE NULL,
    `expected_return_date` DATE NULL,
    `notes` TEXT NULL,
    `status` ENUM('PENDING', 'RECEIVED', 'CANCELLED', 'DISPATCHED') NULL DEFAULT 'PENDING',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `challan_number`(`challan_number`),
    INDEX `job_card_id`(`job_card_id`),
    INDEX `vendor_id`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_receipts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receipt_no` VARCHAR(100) NOT NULL,
    `receipt_date` DATE NOT NULL,
    `payment_id` INTEGER NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `description` TEXT NULL,
    `pdf_path` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `receipt_no`(`receipt_no`),
    INDEX `idx_customer_date`(`customer_id`, `receipt_date`),
    INDEX `payment_id`(`payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_vouchers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voucher_no` VARCHAR(100) NULL,
    `voucher_date` DATE NOT NULL,
    `payment_id` INTEGER NULL,
    `vendor_id` INTEGER NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `voucher_no`(`voucher_no`),
    INDEX `payment_id`(`payment_id`),
    INDEX `payment_vouchers_vendor_id_fk`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `payment_voucher_no` VARCHAR(100) NULL,
    `invoice_id` INTEGER NULL,
    `po_id` INTEGER NULL,
    `job_card_quality_log_id` INTEGER NULL,
    `vendor_id` INTEGER NULL,
    `payment_amount` DECIMAL(14, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `payment_mode` ENUM('BANK_TRANSFER', 'UPI', 'CHEQUE', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH') NOT NULL,
    `transaction_ref_no` VARCHAR(255) NULL,
    `bank_account_id` INTEGER NULL,
    `manual_bank_account` VARCHAR(255) NULL,
    `remarks` TEXT NULL,
    `upi_app` VARCHAR(50) NULL,
    `upi_transaction_id` VARCHAR(255) NULL,
    `cheque_number` VARCHAR(100) NULL,
    `cheque_bank_name` VARCHAR(255) NULL,
    `cheque_date` DATE NULL,
    `card_type` VARCHAR(50) NULL,
    `card_last_4_digits` VARCHAR(4) NULL,
    `authorization_code` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'FAILED') NULL DEFAULT 'CONFIRMED',
    `created_by` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `payment_voucher_no`(`payment_voucher_no`),
    INDEX `fk_payment_quality_log`(`job_card_quality_log_id`),
    INDEX `payments_vendor_fk`(`vendor_id`),
    INDEX `po_id`(`po_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `resource` VARCHAR(120) NULL,
    `action` VARCHAR(50) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `name`(`name`),
    UNIQUE INDEX `code`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `po_receipt_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receipt_id` INTEGER NOT NULL,
    `po_item_id` INTEGER NOT NULL,
    `received_quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `length` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `width` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `thickness` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `outer_diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `density` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `weight_per_unit` DECIMAL(12, 4) NULL DEFAULT 0.0000,

    INDEX `receipt_id`(`receipt_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `po_receipts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `po_number` VARCHAR(100) NULL,
    `receipt_date` DATE NULL,
    `status` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `po_id` INTEGER NOT NULL,
    `received_quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `notes` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procurement_rfq_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfq_id` INTEGER NULL,
    `item_code` VARCHAR(50) NULL,
    `description` TEXT NULL,
    `material_name` VARCHAR(255) NULL,
    `material_type` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(100) NULL,
    `quantity` DECIMAL(14, 3) NULL,
    `planned_qty` DECIMAL(14, 3) NULL,
    `uom` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `length` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `width` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `thickness` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `outer_diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `density` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `weight_per_unit` DECIMAL(12, 4) NULL DEFAULT 0.0000,

    INDEX `rfq_id`(`rfq_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procurement_rfqs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rfq_number` VARCHAR(50) NOT NULL,
    `mr_id` INTEGER NULL,
    `requested_by` INTEGER NULL,
    `status` ENUM('DRAFT', 'SENT', 'RECEIVED', 'CLOSED') NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `rfq_number`(`rfq_number`),
    INDEX `mr_id`(`mr_id`),
    INDEX `requested_by`(`requested_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_plan_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `sales_order_id` INTEGER NULL,
    `sales_order_item_id` INTEGER NULL,
    `item_code` VARCHAR(120) NULL,
    `description` TEXT NULL,
    `bom_no` VARCHAR(100) NULL,
    `design_qty` DECIMAL(12, 3) NULL,
    `uom` VARCHAR(20) NULL,
    `planned_qty` DECIMAL(12, 3) NOT NULL,
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `warehouse` VARCHAR(100) NULL,
    `workstation_id` INTEGER NULL,
    `planned_start_date` DATE NULL,
    `planned_end_date` DATE NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NULL DEFAULT 'PENDING',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `plan_id`(`plan_id`),
    INDEX `sales_order_id`(`sales_order_id`),
    INDEX `sales_order_item_id`(`sales_order_item_id`),
    INDEX `workstation_id`(`workstation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_plan_materials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `item_code` VARCHAR(120) NULL,
    `material_name` VARCHAR(255) NOT NULL,
    `design_qty` DECIMAL(12, 3) NULL,
    `required_qty` DECIMAL(12, 3) NOT NULL,
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `uom` VARCHAR(20) NULL,
    `warehouse` VARCHAR(100) NULL,
    `bom_ref` VARCHAR(100) NULL,
    `total_wt` DECIMAL(12, 3) NULL,
    `is_kg_material` BOOLEAN NULL DEFAULT false,
    `source_assembly` VARCHAR(120) NULL,
    `material_category` ENUM('CORE', 'EXPLODED') NOT NULL,
    `status` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `length` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `width` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `thickness` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `outer_diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,

    INDEX `plan_id`(`plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_plan_operations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `step_no` VARCHAR(10) NULL,
    `operation_name` VARCHAR(100) NOT NULL,
    `process_type` VARCHAR(50) NULL DEFAULT 'In-House',
    `workstation` VARCHAR(100) NULL,
    `base_time` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `net_time` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `source_item` VARCHAR(120) NULL,
    `item_type` VARCHAR(50) NULL DEFAULT 'FG',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `plan_id`(`plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_plan_sub_assemblies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `item_code` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `design_qty` DECIMAL(12, 3) NULL,
    `required_qty` DECIMAL(12, 3) NOT NULL,
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `bom_no` VARCHAR(100) NULL,
    `target_warehouse` VARCHAR(100) NULL,
    `scheduled_date` DATE NULL,
    `manufacturing_type` VARCHAR(50) NULL DEFAULT 'In House',
    `source_fg` VARCHAR(120) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `plan_id`(`plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_code` VARCHAR(50) NOT NULL,
    `plan_date` DATE NOT NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `status` ENUM('DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NULL DEFAULT 'DRAFT',
    `remarks` TEXT NULL,
    `sales_order_id` INTEGER NULL,
    `bom_no` VARCHAR(100) NULL,
    `target_qty` DECIMAL(12, 3) NULL,
    `naming_series` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` INTEGER NULL,

    UNIQUE INDEX `plan_code`(`plan_code`),
    INDEX `created_by`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchase_order_id` INTEGER NOT NULL,
    `item_code` VARCHAR(120) NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(14, 3) NULL,
    `unit` VARCHAR(20) NULL DEFAULT 'NOS',
    `unit_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `cgst_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `cgst_amount` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `sgst_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `sgst_amount` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `total_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `material_name` VARCHAR(255) NULL,
    `material_type` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `accepted_quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `drawing_id` INTEGER NULL,
    `design_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `length` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `width` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `thickness` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `outer_diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `density` DECIMAL(12, 6) NULL DEFAULT 0.000000,
    `weight_per_unit` DECIMAL(12, 6) NULL DEFAULT 0.000000,
    `uom` VARCHAR(20) NULL,
    `planned_qty` DECIMAL(14, 3) NULL DEFAULT 0.000,
    `status` VARCHAR(50) NULL DEFAULT 'OPEN',

    INDEX `idx_purchase_order_id`(`purchase_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `po_number` VARCHAR(100) NOT NULL,
    `quotation_id` INTEGER NULL,
    `vendor_id` INTEGER NULL,
    `sales_order_id` INTEGER NULL,
    `status` ENUM('DRAFT', 'ORDERED', 'SENT', 'ACKNOWLEDGED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'FULFILLED', 'APPROVED', 'PENDING_PAYMENT', 'PAID', 'CLOSED', 'COMPLETED') NULL DEFAULT 'ORDERED',
    `total_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `expected_delivery_date` DATE NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `store_acceptance_status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NULL DEFAULT 'PENDING',
    `store_acceptance_date` TIMESTAMP(0) NULL,
    `store_acceptance_notes` TEXT NULL,
    `mr_id` INTEGER NULL,
    `approved_by` INTEGER NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `invoice_url` VARCHAR(255) NULL,

    UNIQUE INDEX `po_number`(`po_number`),
    INDEX `idx_quotation_id`(`quotation_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_vendor_id`(`vendor_id`),
    INDEX `sales_order_id`(`sales_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qc_attachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `qc_id` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `uploaded_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `qc_id`(`qc_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qc_inspection_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `qc_inspection_id` INTEGER NOT NULL,
    `grn_item_id` INTEGER NOT NULL,
    `warehouse_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `po_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `received_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `accepted_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `rejected_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `status` VARCHAR(50) NULL DEFAULT 'PENDING',
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `grn_item_id`(`grn_item_id`),
    INDEX `qc_inspection_id`(`qc_inspection_id`),
    INDEX `warehouse_id`(`warehouse_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qc_inspections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grn_id` INTEGER NOT NULL,
    `inspection_date` DATE NOT NULL,
    `pass_quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `fail_quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'SHORTAGE', 'ACCEPTED') NULL DEFAULT 'PENDING',
    `defects` TEXT NULL,
    `remarks` TEXT NULL,
    `invoice_url` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_grn_id`(`grn_id`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_communications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotation_id` INTEGER NOT NULL,
    `quotation_type` ENUM('CLIENT', 'VENDOR', 'INTERNAL') NOT NULL,
    `sender_type` ENUM('SYSTEM', 'CLIENT', 'VENDOR') NOT NULL,
    `sender_email` VARCHAR(255) NULL,
    `message` TEXT NOT NULL,
    `email_message_id` VARCHAR(255) NULL,
    `is_read` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_quotation`(`quotation_id`, `quotation_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotation_id` INTEGER NOT NULL,
    `item_code` VARCHAR(120) NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(14, 3) NULL,
    `unit` VARCHAR(20) NULL DEFAULT 'NOS',
    `unit_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `material_name` VARCHAR(255) NULL,
    `material_type` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `drawing_id` INTEGER NULL,
    `design_qty` DECIMAL(14, 3) NULL DEFAULT 0.000,
    `cgst_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `cgst_amount` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `sgst_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `sgst_amount` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `total_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `length` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `width` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `thickness` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `outer_diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `density` DECIMAL(12, 6) NULL DEFAULT 0.000000,
    `weight_per_unit` DECIMAL(12, 6) NULL DEFAULT 0.000000,
    `uom` VARCHAR(20) NULL,
    `planned_qty` DECIMAL(14, 3) NULL DEFAULT 0.000,

    INDEX `idx_quotation_id`(`quotation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_id` INTEGER NULL,
    `company_id` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'REVISED', 'APPROVED', 'REJECTED', 'COMPONENT') NULL DEFAULT 'DRAFT',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `total_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `sales_order_item_id` INTEGER NULL,
    `item_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `rejection_reason` TEXT NULL,
    `reply_pdf` VARCHAR(500) NULL,
    `received_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `profit_percentage` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `gst_percentage` DECIMAL(10, 2) NULL DEFAULT 18.00,
    `version` INTEGER NULL DEFAULT 1,
    `parent_id` INTEGER NULL,
    `drawing_no` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `item_unit` VARCHAR(50) NULL DEFAULT 'Nos',
    `item_group` VARCHAR(50) NULL,
    `project_name` VARCHAR(255) NULL,
    `batch_id` VARCHAR(100) NULL,
    `bom_cost` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `drawing_id` INTEGER NULL,
    `item_code` VARCHAR(255) NULL,
    `pending_bom_cost` DECIMAL(15, 2) NULL,

    INDEX `company_id`(`company_id`),
    INDEX `fk_quotation_parent`(`parent_id`),
    INDEX `sales_order_id`(`sales_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quote_number` VARCHAR(100) NOT NULL,
    `sales_order_id` INTEGER NULL,
    `mr_id` INTEGER NULL,
    `vendor_id` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'RECEIVED', 'REVIEWED', 'CLOSED', 'PENDING', 'EMAIL_RECEIVED', 'SUPERSEDED') NULL DEFAULT 'DRAFT',
    `valid_until` DATE NULL,
    `total_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `received_pdf_path` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `tax_amount` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `grand_total` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `rfq_id` INTEGER NULL,
    `rfq_group_id` VARCHAR(50) NULL,
    `version` INTEGER NULL DEFAULT 1,
    `base_quote_number` VARCHAR(100) NULL,

    INDEX `fk_quotations_mr`(`mr_id`),
    INDEX `idx_rfq_group_id`(`rfq_group_id`),
    INDEX `idx_sales_order_id`(`sales_order_id`),
    INDEX `idx_status`(`status`),
    INDEX `idx_vendor_id`(`vendor_id`),
    INDEX `rfq_id`(`rfq_id`),
    UNIQUE INDEX `base_quote_version`(`base_quote_number`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `permission_id`(`permission_id`),
    UNIQUE INDEX `unique_role_permission`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `department_id` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `test` VARCHAR(255) NULL,

    UNIQUE INDEX `name`(`name`),
    UNIQUE INDEX `code`(`code`),
    INDEX `department_id`(`department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_order_item_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_item_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `source_fg` VARCHAR(120) NULL,
    `parent_id` INTEGER NULL,
    `component_code` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(12, 4) NOT NULL,
    `uom` VARCHAR(20) NULL,
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `loss_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `item_group` VARCHAR(100) NULL,
    `weight_per_unit` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `scrap_percent` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `production_stage` VARCHAR(100) NULL DEFAULT 'Final Assembly',
    `length` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `width` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `thickness` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `outer_diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,

    INDEX `sales_order_item_id`(`sales_order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_order_item_materials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_item_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `parent_id` INTEGER NULL,
    `material_name` VARCHAR(255) NULL,
    `material_type` VARCHAR(100) NULL,
    `qty_per_pc` DECIMAL(12, 3) NULL,
    `uom` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `item_group` VARCHAR(100) NULL,
    `warehouse` VARCHAR(100) NULL,
    `operation` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `production_stage` VARCHAR(100) NULL DEFAULT 'Final Assembly',
    `weight_per_unit` DECIMAL(10, 4) NULL DEFAULT 0.0000,
    `scrap_percent` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `length` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `width` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `thickness` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `outer_diameter` DECIMAL(12, 4) NULL DEFAULT 0.0000,

    INDEX `sales_order_item_id`(`sales_order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_order_item_operations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_item_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `operation_name` VARCHAR(100) NOT NULL,
    `workstation` VARCHAR(100) NULL,
    `cycle_time_min` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `setup_time_min` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `hourly_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `operation_type` VARCHAR(100) NULL DEFAULT 'In-House',
    `target_warehouse` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `production_stage` VARCHAR(100) NULL DEFAULT 'Final Assembly',

    INDEX `sales_order_item_id`(`sales_order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_order_item_scrap` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sales_order_item_id` INTEGER NULL,
    `item_code` VARCHAR(100) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `parent_id` INTEGER NULL,
    `scrap_item_code` VARCHAR(100) NULL,
    `item_name` VARCHAR(255) NULL,
    `input_qty` DECIMAL(12, 4) NULL DEFAULT 0.0000,
    `loss_percent` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `production_stage` VARCHAR(100) NULL DEFAULT 'Final Assembly',

    INDEX `sales_order_item_id`(`sales_order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bom_id` INTEGER NULL,
    `sales_order_id` INTEGER NULL,
    `item_code` VARCHAR(120) NULL,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `unit` VARCHAR(20) NULL DEFAULT 'NOS',
    `rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `delivery_date` DATE NULL,
    `tax_value` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `drawing_no` VARCHAR(120) NULL,
    `revision_no` VARCHAR(50) NULL,
    `drawing_pdf` VARCHAR(500) NULL,
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `item_group` VARCHAR(100) NULL,
    `is_active` BOOLEAN NULL DEFAULT true,
    `is_default` BOOLEAN NULL DEFAULT false,
    `status` VARCHAR(50) NULL DEFAULT 'PENDING',
    `rejection_reason` TEXT NULL,
    `drawing_id` INTEGER NULL,
    `bom_cost` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `item_type` VARCHAR(50) NULL DEFAULT 'FG',
    `created_by` INTEGER NULL,

    INDEX `sales_order_id`(`sales_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customer_po_id` INTEGER NULL,
    `so_number` VARCHAR(100) NULL,
    `net_total` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `company_id` INTEGER NOT NULL,
    `project_name` VARCHAR(255) NULL,
    `drawing_required` BOOLEAN NULL DEFAULT false,
    `production_priority` ENUM('LOW', 'NORMAL', 'HIGH') NULL DEFAULT 'NORMAL',
    `target_dispatch_date` DATE NULL,
    `status` ENUM('CREATED', 'DESIGN_IN_REVIEW', 'DESIGN_APPROVED', 'DESIGN_QUERY', 'QUOTATION_SENT', 'BOM_SUBMITTED', 'BOM_APPROVED', 'PROCUREMENT_IN_PROGRESS', 'MATERIAL_PURCHASE_IN_PROGRESS', 'MATERIAL_READY', 'IN_PRODUCTION', 'PRODUCTION_COMPLETED', 'QC_IN_PROGRESS', 'QC_APPROVED', 'QC_REJECTED', 'READY_FOR_SHIPMENT', 'SHIPPED', 'CLOSED') NULL DEFAULT 'CREATED',
    `current_department` VARCHAR(50) NULL DEFAULT 'SALES',
    `request_accepted` BOOLEAN NULL DEFAULT false,
    `bom_id` INTEGER NULL,
    `cgst_rate` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `sgst_rate` DECIMAL(5, 2) NULL DEFAULT 0.00,
    `profit_margin` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `material_available` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `quotation_id` INTEGER NULL,
    `source_type` VARCHAR(50) NULL DEFAULT 'DIRECT',
    `is_sales_order` BOOLEAN NULL DEFAULT false,
    `billing_address` TEXT NULL,
    `shipping_address` TEXT NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `gstin` VARCHAR(20) NULL,
    `customer_type` VARCHAR(100) NULL,
    `excel_path` VARCHAR(255) NULL,
    `zip_path` VARCHAR(255) NULL,
    `parent_id` INTEGER NULL,

    INDEX `company_id`(`company_id`),
    INDEX `customer_po_id`(`customer_po_id`),
    INDEX `idx_current_department`(`current_department`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shapes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `test` VARCHAR(255) NULL,
    `new_column` VARCHAR(255) NULL,
    `public_id` VARCHAR(100) NULL,

    UNIQUE INDEX `name`(`name`),
    UNIQUE INDEX `shapes_public_id_key`(`public_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `product_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shipment_order_id` INTEGER NOT NULL,
    `item_code` VARCHAR(100) NULL,
    `material_name` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `uom` VARCHAR(20) NULL,
    `warehouse` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `shipment_order_id`(`shipment_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shipment_code` VARCHAR(50) NOT NULL,
    `sales_order_id` INTEGER NULL,
    `customer_id` INTEGER NULL,
    `customer_name` VARCHAR(255) NULL,
    `customer_phone` VARCHAR(50) NULL,
    `customer_email` VARCHAR(255) NULL,
    `shipping_address` TEXT NULL,
    `billing_address` TEXT NULL,
    `dispatch_target_date` DATE NULL,
    `priority` VARCHAR(50) NULL,
    `status` ENUM('PENDING_ACCEPTANCE', 'ACCEPTED', 'REJECTED', 'PLANNING', 'PLANNED', 'READY_TO_DISPATCH', 'DISPATCHED', 'CANCELLED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'CLOSED', 'RETURN_INITIATED', 'RETURN_PICKUP_ASSIGNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED', 'RETURN_COMPLETED') NULL DEFAULT 'PENDING_ACCEPTANCE',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `transporter` VARCHAR(255) NULL,
    `vehicle_number` VARCHAR(100) NULL,
    `driver_name` VARCHAR(255) NULL,
    `driver_contact` VARCHAR(20) NULL,
    `driver_email` VARCHAR(255) NULL,
    `planned_dispatch_date` DATE NULL,
    `estimated_delivery_date` DATE NULL,
    `packing_status` ENUM('PENDING', 'PACKED') NULL DEFAULT 'PENDING',
    `special_instructions` TEXT NULL,
    `current_lat` DECIMAL(10, 8) NULL,
    `current_lng` DECIMAL(11, 8) NULL,
    `last_location_update` TIMESTAMP(0) NULL,
    `actual_delivery_date` TIMESTAMP(0) NULL,

    UNIQUE INDEX `shipment_code`(`shipment_code`),
    INDEX `customer_id`(`customer_id`),
    INDEX `shipment_orders_ibfk_1`(`sales_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment_return_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `return_id` INTEGER NOT NULL,
    `item_code` VARCHAR(100) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `condition_note` TEXT NULL,

    INDEX `return_id`(`return_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment_returns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `return_code` VARCHAR(50) NOT NULL,
    `shipment_id` INTEGER NOT NULL,
    `order_id` INTEGER NULL,
    `customer_id` INTEGER NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('RETURN_INITIATED', 'RETURN_PICKUP_ASSIGNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED', 'RETURN_COMPLETED') NULL DEFAULT 'RETURN_INITIATED',
    `pickup_date` DATE NULL,
    `received_date` DATE NULL,
    `condition_status` ENUM('GOOD', 'DAMAGED', 'WRONG_ITEM', 'CANCELLED') NULL,
    `refund_amount` DECIMAL(15, 2) NULL DEFAULT 0.00,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `return_code`(`return_code`),
    INDEX `shipment_id`(`shipment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment_tracking_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shipment_id` INTEGER NOT NULL,
    `lat` DECIMAL(10, 8) NOT NULL,
    `lng` DECIMAL(11, 8) NOT NULL,
    `speed` VARCHAR(50) NULL,
    `timestamp` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `shipment_id`(`shipment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_balance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_code` VARCHAR(100) NOT NULL,
    `item_description` TEXT NULL,
    `po_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `received_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `accepted_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `issued_qty` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `current_balance` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `unit` VARCHAR(20) NULL,
    `last_updated` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `material_name` VARCHAR(255) NULL,
    `material_type` VARCHAR(100) NULL,
    `valuation_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `selling_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `no_of_cavity` INTEGER NULL DEFAULT 1,
    `weight_per_unit` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `weight_uom` VARCHAR(20) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `revision` VARCHAR(50) NULL,
    `material_grade` VARCHAR(100) NULL,
    `drawing_id` INTEGER NULL,
    `product_type` VARCHAR(100) NULL,
    `warehouse` VARCHAR(100) NULL,
    `qty_in` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `qty_out` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `material_id` INTEGER NULL,
    `shape_id` INTEGER NULL,
    `length` DECIMAL(12, 4) NULL,
    `width` DECIMAL(12, 4) NULL,
    `thickness` DECIMAL(12, 4) NULL,
    `diameter` DECIMAL(12, 4) NULL,
    `outer_diameter` DECIMAL(12, 4) NULL,
    `density` DECIMAL(10, 4) NULL,

    INDEX `idx_item_code`(`item_code`),
    UNIQUE INDEX `unique_item_warehouse`(`item_code`, `warehouse`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entry_no` VARCHAR(50) NOT NULL,
    `entry_type` ENUM('Material Receipt', 'Material Issue', 'Material Transfer', 'Material Adjustment') NOT NULL,
    `purpose` VARCHAR(255) NULL,
    `from_warehouse_id` INTEGER NULL,
    `to_warehouse_id` INTEGER NULL,
    `status` ENUM('draft', 'submitted', 'cancelled') NULL DEFAULT 'draft',
    `entry_date` DATE NOT NULL,
    `grn_id` INTEGER NULL,
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` INTEGER NULL,

    UNIQUE INDEX `entry_no`(`entry_no`),
    INDEX `created_by`(`created_by`),
    INDEX `from_warehouse_id`(`from_warehouse_id`),
    INDEX `grn_id`(`grn_id`),
    INDEX `to_warehouse_id`(`to_warehouse_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_entry_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stock_entry_id` INTEGER NOT NULL,
    `item_code` VARCHAR(100) NOT NULL,
    `material_name` VARCHAR(255) NULL,
    `material_type` VARCHAR(100) NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `uom` VARCHAR(20) NULL,
    `batch_no` VARCHAR(100) NULL,
    `valuation_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `amount` DECIMAL(14, 2) NULL DEFAULT 0.00,

    INDEX `stock_entry_id`(`stock_entry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_code` VARCHAR(100) NOT NULL,
    `transaction_date` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `transaction_type` ENUM('IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'GRN_IN') NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `reference_doc_type` VARCHAR(50) NULL,
    `reference_doc_id` INTEGER NULL,
    `reference_doc_number` VARCHAR(100) NULL,
    `qc_id` INTEGER NULL,
    `grn_item_id` INTEGER NULL,
    `balance_after` DECIMAL(12, 3) NULL,
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` INTEGER NULL,
    `material_name` VARCHAR(255) NULL,
    `material_type` VARCHAR(100) NULL,
    `valuation_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `selling_rate` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `no_of_cavity` INTEGER NULL DEFAULT 1,
    `weight_per_unit` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `weight_uom` VARCHAR(20) NULL,
    `drawing_no` VARCHAR(120) NULL,
    `revision` VARCHAR(50) NULL,
    `material_grade` VARCHAR(100) NULL,
    `unit` VARCHAR(20) NULL DEFAULT 'Nos',
    `drawing_id` INTEGER NULL,
    `product_type` VARCHAR(100) NULL,
    `warehouse` VARCHAR(100) NULL,
    `qty_in` DECIMAL(12, 3) NULL DEFAULT 0.000,
    `qty_out` DECIMAL(12, 3) NULL DEFAULT 0.000,

    INDEX `created_by`(`created_by`),
    INDEX `idx_item_code`(`item_code`),
    INDEX `idx_qc_id`(`qc_id`),
    INDEX `idx_transaction_date`(`transaction_date`),
    INDEX `idx_transaction_type`(`transaction_type`),
    UNIQUE INDEX `unique_grn_ledger`(`reference_doc_id`, `grn_item_id`, `transaction_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `public_id` VARCHAR(50) NOT NULL,
    `username` VARCHAR(120) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(120) NULL,
    `last_name` VARCHAR(120) NULL,
    `department_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `phone` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `public_id`(`public_id`),
    UNIQUE INDEX `username`(`username`),
    UNIQUE INDEX `email`(`email`),
    INDEX `department_id`(`department_id`),
    INDEX `role_id`(`role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendor_id` INTEGER NOT NULL,
    `reference_doc_id` INTEGER NULL,
    `reference_doc_type` VARCHAR(50) NULL,
    `transaction_type` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `description` TEXT NULL,
    `ledger_date` DATE NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `vendor_ledger_vendor_id_fk`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendor_name` VARCHAR(255) NOT NULL,
    `vendor_code` VARCHAR(50) NULL,
    `category` VARCHAR(120) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(30) NULL,
    `location` VARCHAR(255) NULL,
    `rating` DECIMAL(3, 1) NULL DEFAULT 0.0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NULL DEFAULT 'ACTIVE',
    `total_orders` INTEGER NULL DEFAULT 0,
    `total_value` DECIMAL(14, 2) NULL DEFAULT 0.00,
    `last_order_date` DATE NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `gstin` VARCHAR(20) NULL,
    `group_name` VARCHAR(100) NULL,
    `lead_time` VARCHAR(50) NULL,
    `public_id` VARCHAR(100) NULL,
    `dummy_test` VARCHAR(100) NULL,
    `cloumn_test` VARCHAR(100) NULL,

    UNIQUE INDEX `vendor_code`(`vendor_code`),
    UNIQUE INDEX `vendors_public_id_key`(`public_id`),
    INDEX `idx_category`(`category`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warehouse_allocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grn_item_id` INTEGER NOT NULL,
    `from_warehouse` VARCHAR(50) NULL DEFAULT 'RM-HOLD',
    `to_warehouse` VARCHAR(50) NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `allocated_by` INTEGER NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `allocated_by`(`allocated_by`),
    INDEX `grn_item_id`(`grn_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warehouses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `warehouse_code` VARCHAR(50) NOT NULL,
    `warehouse_name` VARCHAR(100) NOT NULL,
    `warehouse_type` VARCHAR(50) NULL,
    `location` VARCHAR(255) NULL,
    `capacity` DECIMAL(12, 3) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `warehouse_code`(`warehouse_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_order_material_consumption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `work_order_id` INTEGER NOT NULL,
    `item_code` VARCHAR(100) NULL,
    `material_name` VARCHAR(255) NULL,
    `material_type` VARCHAR(100) NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `uom` VARCHAR(20) NULL,
    `consumed_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` INTEGER NULL,
    `remarks` TEXT NULL,

    INDEX `created_by`(`created_by`),
    INDEX `work_order_id`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wo_number` VARCHAR(50) NOT NULL,
    `production_plan_item_id` INTEGER NULL,
    `parent_wo_id` INTEGER NULL,
    `plan_id` INTEGER NULL,
    `sales_order_id` INTEGER NULL,
    `sales_order_item_id` INTEGER NULL,
    `item_code` VARCHAR(120) NULL,
    `item_name` VARCHAR(255) NULL,
    `bom_no` VARCHAR(100) NULL,
    `source_type` ENUM('FG', 'SA') NULL DEFAULT 'FG',
    `source_fg` VARCHAR(120) NULL,
    `workstation_id` INTEGER NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NULL DEFAULT 'NORMAL',
    `status` ENUM('DRAFT', 'RELEASED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED') NULL DEFAULT 'DRAFT',
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `wo_number`(`wo_number`),
    INDEX `production_plan_item_id`(`production_plan_item_id`),
    INDEX `sales_order_id`(`sales_order_id`),
    INDEX `sales_order_item_id`(`sales_order_item_id`),
    INDEX `workstation_id`(`workstation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workstations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workstation_code` VARCHAR(50) NOT NULL,
    `workstation_name` VARCHAR(100) NOT NULL,
    `workstation_type` VARCHAR(50) NULL,
    `equipment_code` VARCHAR(100) NULL,
    `maintenance_frequency` VARCHAR(50) NULL,
    `last_maintenance_date` DATE NULL,
    `assigned_operators` TEXT NULL,
    `description` TEXT NULL,
    `department` VARCHAR(50) NULL,
    `location` VARCHAR(255) NULL,
    `capacity_per_hour` DECIMAL(12, 2) NULL DEFAULT 0.00,
    `target_utilization` DECIMAL(5, 2) NULL DEFAULT 80.00,
    `capacity_type` VARCHAR(50) NULL,
    `hourly_rate` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `status` VARCHAR(20) NULL DEFAULT 'Active',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `workstation_code`(`workstation_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bom_approval_history` ADD CONSTRAINT `bom_approval_history_ibfk_1` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `bom_approval_history` ADD CONSTRAINT `bom_approval_history_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `bom_items` ADD CONSTRAINT `bom_items_ibfk_1` FOREIGN KEY (`bom_id`) REFERENCES `bom`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `company_addresses` ADD CONSTRAINT `company_addresses_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_ledger` ADD CONSTRAINT `customer_ledger_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_payments` ADD CONSTRAINT `customer_payments_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_payments` ADD CONSTRAINT `customer_payments_ibfk_2` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_payments` ADD CONSTRAINT `customer_payments_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_po_item_subassemblies` ADD CONSTRAINT `customer_po_item_subassemblies_ibfk_1` FOREIGN KEY (`po_item_id`) REFERENCES `customer_po_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_po_items` ADD CONSTRAINT `customer_po_items_ibfk_1` FOREIGN KEY (`customer_po_id`) REFERENCES `customer_pos`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_pos` ADD CONSTRAINT `customer_pos_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `customer_pos` ADD CONSTRAINT `customer_pos_ibfk_2` FOREIGN KEY (`requesting_department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `delivery_challan_items` ADD CONSTRAINT `delivery_challan_items_ibfk_1` FOREIGN KEY (`challan_id`) REFERENCES `delivery_challans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `delivery_challans` ADD CONSTRAINT `delivery_challans_ibfk_1` FOREIGN KEY (`shipment_id`) REFERENCES `shipment_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `delivery_challans` ADD CONSTRAINT `delivery_challans_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `design_orders` ADD CONSTRAINT `design_orders_ibfk_1` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `design_rejections` ADD CONSTRAINT `design_rejections_ibfk_1` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `document_access_logs` ADD CONSTRAINT `document_access_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `grn_excess_approvals` ADD CONSTRAINT `grn_excess_approvals_ibfk_1` FOREIGN KEY (`grn_item_id`) REFERENCES `grn_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `grn_items` ADD CONSTRAINT `fk_grn_items_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `grn_items` ADD CONSTRAINT `grn_items_ibfk_1` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `inventory_postings` ADD CONSTRAINT `inventory_postings_ibfk_1` FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `inward_challan_items` ADD CONSTRAINT `inward_challan_items_ibfk_1` FOREIGN KEY (`inward_challan_id`) REFERENCES `inward_challans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `inward_challans` ADD CONSTRAINT `inward_challans_ibfk_1` FOREIGN KEY (`outward_challan_id`) REFERENCES `outward_challans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `inward_challans` ADD CONSTRAINT `inward_challans_ibfk_2` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `inward_challans` ADD CONSTRAINT `inward_challans_ibfk_3` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `job_card_downtime_logs` ADD CONSTRAINT `job_card_downtime_logs_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `job_card_inward_item_rates` ADD CONSTRAINT `job_card_inward_item_rates_ibfk_1` FOREIGN KEY (`quality_log_id`) REFERENCES `job_card_quality_logs`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `job_card_quality_logs` ADD CONSTRAINT `job_card_quality_logs_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `job_card_time_logs` ADD CONSTRAINT `job_card_time_logs_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `job_cards` ADD CONSTRAINT `job_cards_ibfk_1` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `job_cards` ADD CONSTRAINT `job_cards_ibfk_2` FOREIGN KEY (`operation_id`) REFERENCES `operations`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `job_cards` ADD CONSTRAINT `job_cards_ibfk_3` FOREIGN KEY (`workstation_id`) REFERENCES `workstations`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `job_cards` ADD CONSTRAINT `job_cards_ibfk_4` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `material_issue_items` ADD CONSTRAINT `material_issue_items_ibfk_1` FOREIGN KEY (`issue_id`) REFERENCES `material_issues`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `material_issues` ADD CONSTRAINT `material_issues_ibfk_1` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `material_issues` ADD CONSTRAINT `material_issues_ibfk_2` FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `material_request_items` ADD CONSTRAINT `material_request_items_ibfk_1` FOREIGN KEY (`mr_id`) REFERENCES `material_requests`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `material_requests` ADD CONSTRAINT `material_requests_ibfk_1` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `operation_workstations` ADD CONSTRAINT `operation_workstations_ibfk_1` FOREIGN KEY (`operation_id`) REFERENCES `operations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `operation_workstations` ADD CONSTRAINT `operation_workstations_ibfk_2` FOREIGN KEY (`workstation_id`) REFERENCES `workstations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `operations` ADD CONSTRAINT `operations_ibfk_1` FOREIGN KEY (`workstation_id`) REFERENCES `workstations`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_item_components` ADD CONSTRAINT `order_item_components_ibfk_1` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_item_materials` ADD CONSTRAINT `order_item_materials_ibfk_1` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_item_operations` ADD CONSTRAINT `order_item_operations_ibfk_1` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_item_scrap` ADD CONSTRAINT `order_item_scrap_ibfk_1` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `outward_challan_items` ADD CONSTRAINT `outward_challan_items_ibfk_1` FOREIGN KEY (`challan_id`) REFERENCES `outward_challans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `outward_challans` ADD CONSTRAINT `outward_challans_ibfk_1` FOREIGN KEY (`job_card_id`) REFERENCES `job_cards`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `outward_challans` ADD CONSTRAINT `outward_challans_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `payment_receipts` ADD CONSTRAINT `payment_receipts_ibfk_1` FOREIGN KEY (`payment_id`) REFERENCES `customer_payments`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `payment_receipts` ADD CONSTRAINT `payment_receipts_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_ibfk_1` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `payment_vouchers` ADD CONSTRAINT `payment_vouchers_vendor_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `fk_payment_quality_log` FOREIGN KEY (`job_card_quality_log_id`) REFERENCES `job_card_quality_logs`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `po_receipt_items` ADD CONSTRAINT `po_receipt_items_ibfk_1` FOREIGN KEY (`receipt_id`) REFERENCES `po_receipts`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `procurement_rfq_items` ADD CONSTRAINT `procurement_rfq_items_ibfk_1` FOREIGN KEY (`rfq_id`) REFERENCES `procurement_rfqs`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `procurement_rfqs` ADD CONSTRAINT `procurement_rfqs_ibfk_1` FOREIGN KEY (`mr_id`) REFERENCES `material_requests`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `procurement_rfqs` ADD CONSTRAINT `procurement_rfqs_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `production_plan_items` ADD CONSTRAINT `production_plan_items_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `production_plans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `production_plan_items` ADD CONSTRAINT `production_plan_items_ibfk_4` FOREIGN KEY (`workstation_id`) REFERENCES `workstations`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `production_plan_materials` ADD CONSTRAINT `production_plan_materials_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `production_plans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `production_plan_operations` ADD CONSTRAINT `production_plan_operations_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `production_plans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `production_plan_sub_assemblies` ADD CONSTRAINT `production_plan_sub_assemblies_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `production_plans`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `production_plans` ADD CONSTRAINT `production_plans_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_ibfk_1` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_ibfk_1` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_ibfk_3` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `qc_attachments` ADD CONSTRAINT `qc_attachments_ibfk_1` FOREIGN KEY (`qc_id`) REFERENCES `qc_inspections`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `qc_inspection_items` ADD CONSTRAINT `qc_inspection_items_ibfk_1` FOREIGN KEY (`qc_inspection_id`) REFERENCES `qc_inspections`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `qc_inspection_items` ADD CONSTRAINT `qc_inspection_items_ibfk_2` FOREIGN KEY (`grn_item_id`) REFERENCES `grn_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `qc_inspection_items` ADD CONSTRAINT `qc_inspection_items_ibfk_3` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `qc_inspections` ADD CONSTRAINT `qc_inspections_ibfk_1` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_ibfk_1` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotation_requests` ADD CONSTRAINT `fk_quotation_parent` FOREIGN KEY (`parent_id`) REFERENCES `quotation_requests`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotation_requests` ADD CONSTRAINT `quotation_requests_ibfk_1` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotation_requests` ADD CONSTRAINT `quotation_requests_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `fk_quotations_mr` FOREIGN KEY (`mr_id`) REFERENCES `material_requests`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_ibfk_1` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_ibfk_3` FOREIGN KEY (`rfq_id`) REFERENCES `procurement_rfqs`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sales_order_item_components` ADD CONSTRAINT `sales_order_item_components_ibfk_1` FOREIGN KEY (`sales_order_item_id`) REFERENCES `sales_order_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sales_order_item_materials` ADD CONSTRAINT `sales_order_item_materials_ibfk_1` FOREIGN KEY (`sales_order_item_id`) REFERENCES `sales_order_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sales_order_item_operations` ADD CONSTRAINT `sales_order_item_operations_ibfk_1` FOREIGN KEY (`sales_order_item_id`) REFERENCES `sales_order_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sales_order_item_scrap` ADD CONSTRAINT `sales_order_item_scrap_ibfk_1` FOREIGN KEY (`sales_order_item_id`) REFERENCES `sales_order_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sales_order_items` ADD CONSTRAINT `sales_order_items_ibfk_1` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_ibfk_1` FOREIGN KEY (`customer_po_id`) REFERENCES `customer_pos`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `shipment_order_items` ADD CONSTRAINT `shipment_order_items_ibfk_1` FOREIGN KEY (`shipment_order_id`) REFERENCES `shipment_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `shipment_orders` ADD CONSTRAINT `shipment_orders_ibfk_1` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `shipment_orders` ADD CONSTRAINT `shipment_orders_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `shipment_return_items` ADD CONSTRAINT `shipment_return_items_ibfk_1` FOREIGN KEY (`return_id`) REFERENCES `shipment_returns`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `shipment_returns` ADD CONSTRAINT `shipment_returns_ibfk_1` FOREIGN KEY (`shipment_id`) REFERENCES `shipment_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `shipment_tracking_logs` ADD CONSTRAINT `shipment_tracking_logs_ibfk_1` FOREIGN KEY (`shipment_id`) REFERENCES `shipment_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_entries` ADD CONSTRAINT `stock_entries_ibfk_1` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_entries` ADD CONSTRAINT `stock_entries_ibfk_2` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_entries` ADD CONSTRAINT `stock_entries_ibfk_3` FOREIGN KEY (`grn_id`) REFERENCES `grns`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_entries` ADD CONSTRAINT `stock_entries_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_entry_items` ADD CONSTRAINT `stock_entry_items_ibfk_1` FOREIGN KEY (`stock_entry_id`) REFERENCES `stock_entries`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stock_ledger` ADD CONSTRAINT `stock_ledger_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `vendor_ledger` ADD CONSTRAINT `vendor_ledger_vendor_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `warehouse_allocations` ADD CONSTRAINT `warehouse_allocations_ibfk_1` FOREIGN KEY (`grn_item_id`) REFERENCES `grn_items`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `warehouse_allocations` ADD CONSTRAINT `warehouse_allocations_ibfk_2` FOREIGN KEY (`allocated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `work_order_material_consumption` ADD CONSTRAINT `work_order_material_consumption_ibfk_1` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `work_order_material_consumption` ADD CONSTRAINT `work_order_material_consumption_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION;

