@echo off
chcp 65001 >nul
echo ═══════════════════════════════════════
echo   Налаштування модульної версії Контролі
echo ═══════════════════════════════════════

cd /d C:\контроль

echo.
echo 1. Створюю папку public...
if not exist "public" mkdir public
if not exist "public\js" mkdir public\js
if not exist "public\css" mkdir public\css

echo 2. Переміщую kontroli-firebase.html в public...
if exist "kontroli-firebase.html" move "kontroli-firebase.html" "public\kontroli-firebase.html" >nul

echo 3. Переміщую JS файли в public\js...
for %%f in (firebase.js core.js auth.js documents.js organizations.js commissions.js form_helpers.js recurring.js calendar.js reports.js settings.js print.js init.js) do (
    if exist "%%f" move "%%f" "public\js\%%f" >nul
)

echo 4. Переміщую CSS в public\css...
if exist "styles.css" move "styles.css" "public\css\styles.css" >nul

echo 5. Переміщую index.html, manifest.json, sw.js в public...
if exist "index.html" move "index.html" "public\index.html" >nul
if exist "manifest.json" move "manifest.json" "public\manifest.json" >nul
if exist "sw.js" move "sw.js" "public\sw.js" >nul

echo.
echo ═══ Перевірка структури ═══
echo.
echo public\:
dir /b public\ 2>nul
echo.
echo public\js\:
dir /b public\js\ 2>nul
echo.
echo public\css\:
dir /b public\css\ 2>nul

echo.
echo ═══════════════════════════════════════
echo   Готово! Тепер виконай:
echo   firebase deploy --only hosting
echo ═══════════════════════════════════════
pause
