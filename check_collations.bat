@echo off
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h 127.0.0.1 -u aluminium_user -p"C0digix$309" -P 3307 sales_erp -e "SHOW TABLE STATUS WHERE Name IN ('sales_orders', 'orders', 'customer_pos', 'companies', 'customer_payments');"
