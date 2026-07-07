@echo off
title YouTube Music Connect
echo ====================================================
echo             YouTube Music Connect Starter
echo ====================================================
echo.

:: Detect Node.js installation
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js (https://nodejs.org) to run this app.
    pause
    exit /b
)

:: Re-install packages if node_modules is missing
if not exist node_modules (
    echo Installing root dependencies...
    call npm install
)
if not exist desktop-app\node_modules (
    echo Installing desktop dependencies...
    cd desktop-app
    call npm install
    cd ..
)
if not exist mobile-app\node_modules (
    echo Installing mobile dependencies...
    cd mobile-app
    call npm install
    cd ..
)

:: Build mobile static files if they don't exist
if not exist mobile-app\dist (
    echo [Setup] Building mobile app static files...
    call npm run build --prefix mobile-app
)

:: Retrieve local IP address
for /f "usebackq tokens=*" %%A in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Ethernet*' -or $_.IPAddress -like '192.*' -or $_.IPAddress -like '172.*' -or $_.IPAddress -like '10.*' }).IPAddress | Select-Object -First 1"`) do set LOCAL_IP=%%A

echo.
echo ====================================================
echo  [SERVER RUNNING]
echo.
if "%LOCAL_IP%"=="" (
    echo  Open this link on your mobile phone: http://localhost:8080
) else (
    echo  Open this link on your mobile phone: http://%LOCAL_IP%:8080
)
echo.
echo  Make sure both devices are on the SAME network (Wi-Fi).
echo ====================================================
echo.

:: Launch Electron
npm run start --prefix desktop-app
pause
