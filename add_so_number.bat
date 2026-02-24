@echo off
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h 127.0.0.1 -u aluminium_user -p"C0digix$309" -P 3307 sales_erp -e "ALTER TABLE sales_orders ADD COLUMN so_number VARCHAR(100) AFTER customer_po_id;"
if %ERRORLEVEL% EQU 0 (
    echo Column so_number added successfully to sales_orders table.
) else (
    echo Failed to add column so_number. It might already exist.
)
