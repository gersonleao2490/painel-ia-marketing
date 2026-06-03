@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Subir Painel IA no GitHub
cls
echo ================================================================
echo    SUBIR O PAINEL IA NO GITHUB
echo ================================================================
echo.
echo  Antes: crie um repositorio VAZIO em https://github.com/new
echo  (nome sugerido: painel-ia-marketing, sem README).
echo.
set /p REPOURL="Cole aqui a URL do repositorio (.git) e aperte Enter: "
if "%REPOURL%"=="" ( echo URL vazia. Saindo. & pause & exit /b )
echo.
echo  Configurando e enviando...
git remote remove origin 2>nul
git remote add origin %REPOURL%
git branch -M main
git push -u origin main
echo.
echo ----------------------------------------------------------------
echo  Se apareceu pedido de login, faca o login no navegador.
echo  Se deu tudo certo, seu painel ja esta no GitHub.
echo ----------------------------------------------------------------
pause
