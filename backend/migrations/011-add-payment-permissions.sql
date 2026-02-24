INSERT INTO permissions (name, code, description, resource, action, status) VALUES
('View Payments', 'PAYMENT_VIEW', 'View payment records and history', 'payments', 'read', 'ACTIVE'),
('Process Payments', 'PAYMENT_PROCESS', 'Process and create new payments', 'payments', 'create', 'ACTIVE'),
('Edit Payments', 'PAYMENT_EDIT', 'Edit payment details and status', 'payments', 'update', 'ACTIVE'),
('Setup Bank Accounts', 'PAYMENT_SETUP', 'Configure bank accounts for payments', 'bank_accounts', 'write', 'ACTIVE')
ON DUPLICATE KEY UPDATE status='ACTIVE';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ACCOUNTS' AND p.code IN ('PAYMENT_VIEW', 'PAYMENT_PROCESS', 'PAYMENT_EDIT', 'PAYMENT_SETUP')
ON DUPLICATE KEY UPDATE role_id=role_id;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ADMIN' AND p.code IN ('PAYMENT_VIEW', 'PAYMENT_PROCESS', 'PAYMENT_EDIT', 'PAYMENT_SETUP')
ON DUPLICATE KEY UPDATE role_id=role_id;
