@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Painel IA ONLINE - link publico (NAO FECHE)
cls
echo ================================================================
echo    PAINEL IA  -  ACESSO DE QUALQUER LUGAR (link publico)
echo ================================================================
echo.
echo  Vou ligar o servidor seguro e gerar um LINK publico.
echo.
echo  >>> Daqui a pouco aparece um endereco terminando em
echo      trycloudflare.com  -- ESSE e o link pra abrir no
echo      CELULAR ou em outro PC. Faca login normalmente.
echo.
echo  NAO FECHE esta janela enquanto quiser manter o acesso ligado.
echo  (O link muda toda vez que voce abrir - e a versao gratuita.)
echo ================================================================
echo.
start "Ollama" /min cmd /c ollama serve
start "Servidor Painel (nao feche)" cmd /k node "%~dp0server.js"
timeout /t 3 /nobreak >nul
echo  Gerando o link publico... (aguarde aparecer abaixo)
echo.
"%~dp0cloudflared.exe" tunnel --url http://localhost:8800
