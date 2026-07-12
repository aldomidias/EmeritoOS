@echo off
REM Abre o painel do EméritoOS — sobe o servidor local e abre o navegador.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js nao encontrado. Instale em https://nodejs.org e abra de novo.
  echo.
  pause
  exit /b 1
)

REM Sobe o servidor em background, minimizado
start "MazyUI" /min cmd /c "node mazyui-server.mjs"

REM Espera o servidor responder antes de abrir o browser
set /a tries=0
:wait
set /a tries+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://localhost:7777/' -UseBasicParsing -TimeoutSec 1).StatusCode } catch { 0 }" >nul 2>nul
if errorlevel 1 (
  if %tries% LSS 60 (
    timeout /t 1 /nobreak >nul
    goto wait
  )
)

start "" "http://localhost:7777/"
exit
