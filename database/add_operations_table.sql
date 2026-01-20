USE sales_erp;

CREATE TABLE IF NOT EXISTS operations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operation_code VARCHAR(50) UNIQUE NOT NULL,
  operation_name VARCHAR(100) NOT NULL,
  workstation_id INT,
  std_time DECIMAL(10, 2) DEFAULT 0.00,
  time_uom ENUM('Hr', 'Min', 'Sec') DEFAULT 'Hr',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE SET NULL
);
