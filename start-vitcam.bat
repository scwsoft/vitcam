@echo off
echo Starting VitCam...
start "VitCam Server" cmd /k "C:\LocalRepo\vitcam\start-server.bat"
timeout /t 5 /nobreak >nul
start "VitCam Frontend" cmd /k "C:\LocalRepo\vitcam\start-frontend.bat"
timeout /t 8 /nobreak >nul
start http://localhost:3000
echo VitCam is starting. Check the two terminal windows for logs.
pause
