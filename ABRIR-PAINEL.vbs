' ===================================================================
'  PAINEL IA DE MARKETING — abre TUDO sem nenhuma janela de terminal
'  (de dois cliques aqui, ou use o atalho na Area de Trabalho)
' ===================================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta

' 1) Garante o Ollama ligado (se ja estiver, ignora sem erro)
sh.Run "cmd /c ollama serve", 0, False

' 2) Servidor SEGURO do painel (login + Notion + IA) na porta 8800 (oculto)
sh.Run "cmd /c node """ & pasta & "\server.js""", 0, False

' 3) Espera subir e abre o painel no navegador padrao (vai pedir login)
WScript.Sleep 2500
sh.Run "http://localhost:8800", 1, False
