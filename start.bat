@echo off
setlocal enabledelayedexpansion
title Review Response Generator

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ==========================================
    echo [ERROR] Node.js is not installed!
    echo ==========================================
    echo.
    echo This application requires Node.js to run.
    echo Please download and install it from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ==========================================
echo       Review Response Generator
echo ==========================================
echo.
echo This application can run in two modes:
echo 1. Local Offline Mode (Free, no setup needed)
echo 2. OpenAI AI Mode (Requires OpenAI API Key)
echo.

:: Check if .env file exists and has OPENAI_API_KEY
set "OPENAI_API_KEY="
if exist .env (
    for /f "usebackq tokens=1* delims==" %%i in (".env") do (
        if "%%i"=="OPENAI_API_KEY" (
            set "OPENAI_API_KEY=%%j"
        )
    )
)

if "%OPENAI_API_KEY%"=="" (
    echo [Local Mode] No OpenAI API Key found in .env
    echo.
    set /p "user_key=Optionally, enter your OpenAI API Key (or press Enter to run in local offline mode): "
    if not "!user_key!"=="" (
        set "OPENAI_API_KEY=!user_key!"
        echo OPENAI_API_KEY=!user_key!>.env
        echo.
        echo [+] Saved API key to .env file for future runs.
    ) else (
        echo.
        echo [+] Running in Local Offline Mode.
    )
) else (
    echo [+] Using saved OpenAI API Key from .env file.
)

echo.
echo Starting server...
echo.
echo Once the server is running, the app will open in your browser automatically.
echo If it doesn't, navigate to: http://127.0.0.1:5187/
echo.
echo To stop the server, close this window or press Ctrl+C.
echo.

:: Launch the browser after a 1.5-second delay to give Node time to start
start /b cmd /c "ping 127.0.0.1 -n 2 >nul && start http://127.0.0.1:5187/"

:: Run the server
node server.js

pause
