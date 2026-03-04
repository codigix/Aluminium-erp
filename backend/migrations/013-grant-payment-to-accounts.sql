INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p
WHERE r.code = 'ACC_MGR' 
AND p.code IN ('PAYMENT_VIEW', 'PAYMENT_PROCESS', 'PAYMENT_EDIT')
ON DUPLICATE KEY UPDATE role_id=role_id;
