@echo off
title YouTube Music Connect Updater
echo ====================================================
echo        YouTube Music Connect - Auto Updater
echo ====================================================
echo.

:: Check if git is available
if exist .git (
    echo [Git Mode] Git repository detected. Pulling updates...
    git pull
) else (
    echo [ZIP Mode] Downloading latest files from GitHub...
    :: Replace 'Eddiz/yt-music-connect' with your actual repository path when published
    powershell -Command "Write-Host 'Downloading updates...' -ForegroundColor Green; Invoke-WebRequest -Uri 'https://github.com/Eddiz/yt-music-connect/archive/refs/heads/main.zip' -OutFile 'update.zip'"
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to download update.zip. Ensure you are connected to the internet.
        goto end
    )
    
    echo Extracting update files...
    powershell -Command "Write-Host 'Extracting archive...' -ForegroundColor Green; Expand-Archive -Path 'update.zip' -DestinationPath 'update_temp' -Force"
    
    echo Overwriting local files...
    xcopy /E /Y /Q "update_temp\yt-music-connect-main\*" ".\"
    
    echo Cleaning up temporary files...
    rmdir /S /Q "update_temp"
    del "update.zip"
)

echo.
echo Installing node modules and dependencies...
call npm install
echo.
echo ====================================================
echo   Update completed successfully! Run start.bat to play.
echo ====================================================
:end
pause
