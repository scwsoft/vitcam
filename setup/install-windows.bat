@echo off
:: =============================================================================
::  VitCam — Windows Installer Launcher
::  Double-click this file to run the VitCam installer.
::  No need to change PowerShell execution policy.
:: =============================================================================
echo.
echo  =====================================================
echo   VitCam Windows Installer
echo  =====================================================
echo.
echo  Prerequisites checklist before continuing:
echo    [1] Git for Windows installed
echo    [2] Node.js 18+ installed
echo    [3] Anaconda or Miniconda installed
echo    [4] Docker Desktop installed AND running
echo    [5] NVIDIA drivers installed (for GPU support)
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [!] Installation failed. See errors above.
    pause
    exit /b 1
)

pause
