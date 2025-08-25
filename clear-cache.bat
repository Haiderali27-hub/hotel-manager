@echo off
echo ========================================
echo     HOTEL APP CACHE CLEANER
echo ========================================
echo.

echo [1/6] Clearing Rust build cache...
cd src-tauri
cargo clean >nul 2>&1
rmdir /s /q target >nul 2>&1
cd ..

echo [2/6] Clearing Node.js cache...
rmdir /s /q node_modules >nul 2>&1
rmdir /s /q dist >nul 2>&1

echo [3/6] Clearing Vite cache...
rmdir /s /q .vite >nul 2>&1

echo [4/6] Clearing npm cache...
npm cache clean --force >nul 2>&1

echo [5/6] Clearing app user data...
rmdir /s /q "%APPDATA%\hotel-app" >nul 2>&1
rmdir /s /q "%LOCALAPPDATA%\hotel-app" >nul 2>&1

echo [6/6] Reinstalling dependencies...
npm install

echo.
echo ========================================
echo     CACHE CLEARED SUCCESSFULLY!
echo ========================================
echo.
echo Next steps:
echo 1. Run: npm run tauri dev
echo 2. Or run: npm run tauri build
echo.
pause
