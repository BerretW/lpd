@echo off
title Appartus - Master Control
cls

echo ==========================================================
echo    Appartus - Spousteni Backendu a Frontendu
echo ==========================================================

:: 1. Kontrola existence slozek
if not exist backend (
    echo [ERROR] Slozka 'backend' nebyla nalezena!
    pause
    exit /b
)

if not exist frontend (
    echo [ERROR] Slozka 'frontend' nebyla nalezena!
    echo Vytvarim zakladni strukturu pro frontend...
    mkdir frontend
)

:: 2. Spusteni Backendu v novem okne
echo [INFO] Spoustim Backend...
start "Appartus - API (Backend)" cmd /k "cd backend && call start_backend_local.bat"

:: 3. Spusteni Frontendu v novem okne
echo [INFO] Spoustim Frontend...
start "Appartus - Web (Frontend)" cmd /k "cd frontend && call start_frontend_local.bat"
start "Appartus - Web (FrontendV2)" cmd /k "cd frontendV2 && call start.bat"

echo.
echo [SUCCESS] Oba procesy byly iniciovany v samostatnych oknech.
echo Backend bezi na: http://127.0.0.1:8000
echo Frontend bezi na: http://127.0.0.1:5000
echo ==========================================================
pause