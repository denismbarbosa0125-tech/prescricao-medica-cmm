@echo off
REM Iniciar Prescricao Medica CMM
cd /d "C:\Users\denis\.claude\prescricao-app\dist\win-unpacked"

REM Matar processos antigos
taskkill /F /IM "Prescricao Medica CMM.exe" 2>/dev/null
taskkill /F /IM electron.exe 2>/dev/null

REM Aguardar
timeout /t 2 /nobreak

REM Abrir app
start "Prescricao Medica CMM" "Prescricao Medica CMM.exe"

echo.
echo Prescricao Medica aberta!
pause
