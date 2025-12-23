@echo off
REM BOM Setup Script for Windows

echo.
echo ================================
echo BOM Module Setup Script
echo ================================
echo.

REM Step 1: Fix database schema
echo [1/2] Fixing database schema...
mysql -h localhost -u root aluminium_erp < fix_bom_tables.sql
if errorlevel 1 (
    echo Error: Failed to fix schema
    echo Make sure MySQL is running
    pause
    exit /b 1
)
echo OK: Schema fixed
echo.

REM Step 2: Insert mock data
echo [2/2] Inserting mock data...
mysql -h localhost -u root aluminium_erp < insert_bom_mock_data.sql
if errorlevel 1 (
    echo Error: Failed to insert data
    pause
    exit /b 1
)
echo OK: Mock data inserted
echo.

echo ================================
echo Setup Complete!
echo ================================
echo.
echo Next Steps:
echo 1. Start Backend:
echo    cd backend
echo    npm start
echo.
echo 2. In another terminal, Start Frontend:
echo    cd frontend
echo    npm run dev
echo.
echo 3. Open browser:
echo    http://localhost:5173/production/boms
echo.

pause
