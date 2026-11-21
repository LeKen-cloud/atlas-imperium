@echo off
title Atlas Imperium (dev server)
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js is required for the developer version: https://nodejs.org & echo Or double-click "Play Atlas Imperium.html" or the .exe instead. & pause & exit /b)
if not exist node_modules (echo Installing dependencies, first launch only... & call npm install)
REM vite opens the browser itself once the server is ready
call npm run dev -- --open
pause
