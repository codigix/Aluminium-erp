@echo off
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h 127.0.0.1 -u aluminium_user -p"C0digix$309" -P 3307 sales_erp -e "SELECT id, so_number, company_id, status, net_total FROM sales_orders;"
