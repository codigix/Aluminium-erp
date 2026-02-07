SELECT cp.id, cp.company_id, c.company_name FROM customer_pos cp JOIN companies c ON cp.company_id = c.id;  
