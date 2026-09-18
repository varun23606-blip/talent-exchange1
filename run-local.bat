@echo off
title Talent Exchange Launcher
echo ========================================================
echo Starting Talent Exchange (Flask REST API + Frontend)
echo ========================================================
echo.
echo 1. Starting Backend API server on http://localhost:5000 ...
start "Talent Exchange Backend API" cmd /k "cd backend && python app.py"
echo.
echo 2. Starting Frontend Web server on http://localhost:8000 ...
start "Talent Exchange Frontend Web" cmd /k "cd frontend && python -m http.server 8000"
echo.
echo 3. Opening Talent Exchange in your default browser in 2 seconds...
timeout /t 2 >nul
start http://localhost:8000
echo.
echo Both servers are active!
echo Keep the opened command windows running while using the application.
echo.
pause
