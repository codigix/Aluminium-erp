-- Create bank_accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL UNIQUE,
  ifsc_code VARCHAR(20),
  account_holder_name VARCHAR(255),
  account_type ENUM('SAVINGS', 'CURRENT', 'OTHER') DEFAULT 'CURRENT',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create customer_payments table
CREATE TABLE IF NOT EXISTS customer_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_receipt_no VARCHAR(100) UNIQUE,
  invoice_id INT,
  sales_order_id INT,
  customer_id INT NOT NULL,
  payment_amount DECIMAL(14, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode ENUM('BANK_TRANSFER', 'UPI', 'CHEQUE', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH') NOT NULL,
  transaction_ref_no VARCHAR(255),
  bank_account_id INT,
  remarks TEXT,
  upi_app VARCHAR(50),
  upi_transaction_id VARCHAR(255),
  cheque_number VARCHAR(100),
  cheque_bank_name VARCHAR(255),
  cheque_date DATE,
  card_type VARCHAR(50),
  card_last_4_digits VARCHAR(4),
  authorization_code VARCHAR(255),
  status ENUM('PENDING', 'CONFIRMED', 'FAILED') DEFAULT 'CONFIRMED',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_customer_date (customer_id, payment_date),
  INDEX idx_status (status)
);

-- Create customer_ledger table
CREATE TABLE IF NOT EXISTS customer_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  reference_doc_id INT,
  reference_doc_type ENUM('SALES_ORDER', 'CUSTOMER_INVOICE', 'PAYMENT', 'DEBIT_NOTE', 'CREDIT_NOTE') NOT NULL,
  transaction_type ENUM('DEBIT', 'CREDIT') NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  description TEXT,
  ledger_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_customer_date (customer_id, ledger_date),
  INDEX idx_reference (reference_doc_id, reference_doc_type)
);

-- Create payment_receipts table
CREATE TABLE IF NOT EXISTS payment_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_no VARCHAR(100) UNIQUE NOT NULL,
  receipt_date DATE NOT NULL,
  payment_id INT NOT NULL,
  customer_id INT NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  description TEXT,
  pdf_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES customer_payments(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_customer_date (customer_id, receipt_date)
);
