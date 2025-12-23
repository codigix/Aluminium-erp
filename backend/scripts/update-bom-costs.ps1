# Update BOM costs

Write-Host "Updating BOM costs..." -ForegroundColor Yellow

$query = @"
UPDATE bom SET total_cost = 1500 WHERE total_cost IS NULL OR total_cost = 0;
SELECT bom_id, product_name, status, total_cost FROM bom ORDER BY created_at DESC;
"@

$query | mysql -h localhost -u root aluminium_erp

Write-Host "✅ BOM costs updated!" -ForegroundColor Green
Write-Host "`nRefresh your browser to see the updated costs" -ForegroundColor Cyan
