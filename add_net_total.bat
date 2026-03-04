@echo off
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h 127.0.0.1 -u aluminium_user -p"C0digix$309" -P 3307 sales_erp -e "ALTER TABLE sales_orders ADD COLUMN net_total DECIMAL(14, 2) DEFAULT 0 AFTER so_number;"
if %ERRORLEVEL% EQU 0 (
    echo Column net_total added successfully to sales_orders table.
) else (
    echo Failed to add column net_total. It might already exist.
)
