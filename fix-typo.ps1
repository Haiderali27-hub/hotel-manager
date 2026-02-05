$content = Get-Content "tests\retail\backend\products.test.ts" -Raw
$content = $content -replace 'item Id:', 'itemId:'
$content | Set-Content "tests\retail\backend\products.test.ts"
Write-Host "Fixed typo in products.test.ts"
