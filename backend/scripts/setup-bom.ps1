# BOM Setup Script for PowerShell

Write-Host "================================" -ForegroundColor Cyan
Write-Host "BOM Module Setup Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Step 1: Fix database schema
Write-Host "`n[1/3] Fixing database schema..." -ForegroundColor Yellow
Write-Host "Running: fix_bom_tables.sql" -ForegroundColor Gray

$sqlFile = Join-Path $PSScriptRoot "fix_bom_tables.sql"
if (Test-Path $sqlFile) {
    try {
        mysql -h localhost -u root aluminium_erp < $sqlFile
        Write-Host "✅ Schema fixed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        Write-Host "Make sure MySQL is running and accessible" -ForegroundColor Yellow
        exit 1
    }
}
else {
    Write-Host "❌ SQL file not found: $sqlFile" -ForegroundColor Red
    exit 1
}

# Step 2: Insert mock data
Write-Host "`n[2/3] Inserting mock data..." -ForegroundColor Yellow
Write-Host "Running: insert_bom_mock_data.sql" -ForegroundColor Gray

$sqlFile = Join-Path $PSScriptRoot "insert_bom_mock_data.sql"
if (Test-Path $sqlFile) {
    try {
        mysql -h localhost -u root aluminium_erp < $sqlFile
        Write-Host "✅ Mock data inserted successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "❌ SQL file not found: $sqlFile" -ForegroundColor Red
    exit 1
}

# Step 3: Run Node.js verification script
Write-Host "`n[3/3] Verifying data insertion..." -ForegroundColor Yellow
$setupScript = Join-Path $PSScriptRoot "setup_bom_data.js"
if (Test-Path $setupScript) {
    Write-Host "Running: setup_bom_data.js" -ForegroundColor Gray
    try {
        node $setupScript
        Write-Host "✅ Verification complete" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error running verification: $_" -ForegroundColor Red
    }
}
else {
    Write-Host "⚠️  Verification script not found" -ForegroundColor Yellow
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Start Backend:" -ForegroundColor Cyan
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "2. In another terminal, Start Frontend:" -ForegroundColor Cyan
Write-Host "   cd frontend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Open browser:" -ForegroundColor Cyan
Write-Host "   http://localhost:5173/production/boms" -ForegroundColor Gray
Write-Host ""

# Optional: Test API
$response = Read-Host "Would you like to test the API now? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "`nWaiting for backend to start... (make sure to start it first)" -ForegroundColor Yellow
    Write-Host "Run: npm start" -ForegroundColor Gray
    Read-Host "Press Enter when backend is running"
    
    $testScript = Join-Path $PSScriptRoot "test_bom_api.js"
    if (Test-Path $testScript) {
        Write-Host "`nRunning API tests..." -ForegroundColor Yellow
        node $testScript
    }
}

Write-Host "`nSetup complete! Enjoy using the BOM module." -ForegroundColor Green
