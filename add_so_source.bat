@echo off
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h 127.0.0.1 -u aluminium_user -p"C0digix$309" -P 3307 sales_erp -e "ALTER TABLE customer_payments ADD COLUMN sales_order_source ENUM('SALES_ORDER', 'DIRECT_ORDER') DEFAULT 'SALES_ORDER' AFTER sales_order_id;"
if %ERRORLEVEL% EQU 0 (
    echo Column sales_order_source added successfully to customer_payments table.
) else (
    echo Failed to add column sales_order_source. It might already exist.
)
