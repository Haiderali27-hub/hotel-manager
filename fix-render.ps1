$file = "c:\Users\DELL\Desktop\hotel-manager\tests\retail\frontend\ProductsPage.test.tsx"
$content = Get-Content $file -Raw -Encoding UTF8
$content = $content -replace 'render\(<ProductsPage', 'renderWithProviders(<ProductsPage'
Set-Content -Path $file -Value $content -Encoding UTF8 -NoNewline
Write-Output "Replaced all render() calls with renderWithProviders()"
