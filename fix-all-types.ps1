# Fix all remaining type assertions in test files

# Fix products.test.ts
$content = Get-Content "tests\retail\backend\products.test.ts" -Raw
$content = $content -replace "const products = await invoke\('search_by_sku', \{ sku \}\);", "const products = await invoke('search_by_sku', { sku }) as any[];"
$content = $content -replace "const products = await invoke\('search_by_barcode', \{ barcode \}\);", "const products = await invoke('search_by_barcode', { barcode }) as any[];"
$content = $content -replace "const products = await invoke\('get_menu_items'\);(?!\s*as\s*any)", "const products = await invoke('get_menu_items') as any[];"
$content = $content -replace "const lowStockItems = await invoke\('get_low_stock_items'\);(?!\s*as\s*any)", "const lowStockItems = await invoke('get_low_stock_items') as any[];"
$content = $content -replace "const categories = await invoke\('get_product_categories'\);(?!\s*as\s*any)", "const categories = await invoke('get_product_categories') as any[];"
$content | Set-Content "tests\retail\backend\products.test.ts"
Write-Host "Fixed products.test.ts"

# Fix sales.test.ts - Fix all summary declarations
$content = Get-Content "tests\retail\backend\sales.test.ts" -Raw
$content = $content -replace "const summary = await invoke\('get_sale_payment_summary', \{ saleId: testSaleId \}\);(?!\s*as\s*any)", "const summary = await invoke('get_sale_payment_summary', { saleId: testSaleId }) as any;"
$content | Set-Content "tests\retail\backend\sales.test.ts"
Write-Host "Fixed sales.test.ts"

# Fix complete-workflow.test.ts
$content = Get-Content "tests\retail\integration\complete-workflow.test.ts" -Raw
$content = $content -replace "(\}\) as number;\s+)(testProductIds\.push\(productId\);)", "`$1testProductIds.push(productId as number);"
$content | Set-Content "tests\retail\integration\complete-workflow.test.ts"
Write-Host "Fixed complete-workflow.test.ts"

Write-Host "All type assertion fixes completed!"
