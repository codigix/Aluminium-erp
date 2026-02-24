@echo off
"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h 127.0.0.1 -u aluminium_user -p"C0digix$309" -P 3307 sales_erp -e "UPDATE sales_orders SET so_number = order_no WHERE so_number IS NULL OR so_number = ''; UPDATE sales_orders SET net_total = grand_total WHERE net_total IS NULL OR net_total = 0;"
if %ERRORLEVEL% EQU 0 (
    echo Existing sales orders updated with so_number and net_total.
) else (
    echo Failed to update existing sales orders.
)
