@echo off
title Talent Exchange Launcher
echo ========================================================
echo Starting Talent Exchange (Pure Firebase Client)
echo ========================================================
echo.
echo Starting Frontend Web server on http://localhost:8000 ...
start "Talent Exchange Web Client" cmd /k "cd frontend && python -m http.server 8000"
echo.
echo Opening Talent Exchange in your default browser in 2 seconds...
timeout /t 2 >nul
start http://localhost:8000
echo.
echo Talent Exchange is active and connected to Firebase (talent-exchange-b8827)!
echo.
pause
