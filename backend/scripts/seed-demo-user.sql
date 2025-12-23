-- Seed demo user for Aluminium ERP
-- Email: test@example.com
-- Password: password123 (hashed with bcrypt)

INSERT INTO users (full_name, email, password, department, role, is_active, created_at, updated_at)
VALUES (
  'Demo User',
  'test@example.com',
  '$2a$10$YQvzh7gUNHYI8T7G6sI3pu8gPJz7kX2wKZ1z6fH3m9qL0K1D2bG3O',
  'buying',
  'admin',
  1,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  full_name = 'Demo User',
  password = '$2a$10$YQvzh7gUNHYI8T7G6sI3pu8gPJz7kX2wKZ1z6fH3m9qL0K1D2bG3O',
  department = 'buying',
  role = 'admin',
  is_active = 1,
  updated_at = NOW();
