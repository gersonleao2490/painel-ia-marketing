@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Painel IA de Marketing - NAO FECHE
cls
echo ================================================================
echo    PAINEL IA DE MARKETING  -  Diretora Senior
echo ================================================================
echo.
echo  1) O Ollama precisa estar ABERTO (icone na barra do Windows).
echo  2) Abrindo o painel no seu navegador...
echo.
echo  NAO FECHE esta janela preta enquanto estiver usando o painel.
echo  Para FECHAR o painel depois: feche esta janela.
echo.
echo  Se a pagina abrir com erro na 1a vez, aperte F5 para recarregar.
echo ================================================================
echo.
start "" http://localhost:8800
python -m http.server 8800
