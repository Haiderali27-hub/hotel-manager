$content = Get-Content "vitest.config.ts" -Raw
$content = $content -replace "import react from '@vitejs/plugin-react';\r?\nimport path from 'path';\r?\nimport \{ defineConfig \} from 'vitest/config';", "import react from '@vitejs/plugin-react';`nimport path from 'path';`nimport { fileURLToPath } from 'url';`nimport { defineConfig } from 'vitest/config';`n`nconst __dirname = path.dirname(fileURLToPath(import.meta.url));"
$content | Set-Content "vitest.config.ts"
Write-Host "Fixed vitest.config.ts"
