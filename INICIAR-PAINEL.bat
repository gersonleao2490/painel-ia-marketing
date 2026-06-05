@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Painel IA de Marketing - servidor (pode MINIMIZAR, NAO fechar)
cls
echo ================================================================
echo    PAINEL IA DE MARKETING
echo ================================================================
echo.
echo  Servidor ligado. Pode MINIMIZAR esta janela (nao feche).
echo  Para DESLIGAR o painel depois, feche esta janela.
echo  Abrindo no navegador...
echo ================================================================
echo.
REM garante o Ollama ligado (se ja estiver, ignora)
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" start "" /min "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
timeout /t 1 /nobreak >nul
start "" http://localhost:8800
REM caminho completo do node (mais confiavel)
if exist "C:\Program Files\nodejs\node.exe" (
  "C:\Program Files\nodejs\node.exe" "%~dp0server.js"
) else (
  node "%~dp0server.js"
)
echo.
echo Servidor encerrado. Pode fechar.
pause
