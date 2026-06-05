@echo off
setlocal
set PATH=C:\Program Files\nodejs;C:\Program Files\Python312;%PATH%
cd /d "C:\Users\denis\.claude\prescricao-app"
echo Iniciando Prescricao Medica CMM...
timeout /t 2
call npm run dev
pause
