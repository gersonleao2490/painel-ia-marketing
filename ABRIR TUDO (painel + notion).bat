@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Painel IA + Notion - NAO FECHE
cls
echo ================================================================
echo    PAINEL IA DE MARKETING  +  PONTE NOTION
echo ================================================================
echo.
echo  1) O Ollama precisa estar ABERTO.
echo  2) Vou abrir 2 janelas: esta (painel) e a "Ponte Notion".
echo     NAO FECHE nenhuma das duas enquanto estiver usando.
echo.
echo  Se a pagina abrir com erro na 1a vez, aperte F5.
echo ================================================================
echo.
start "Ponte Notion (nao feche)" cmd /k node "%~dp0notion-bridge.js"
timeout /t 1 /nobreak >nul
start "" http://localhost:8800
python -m http.server 8800
