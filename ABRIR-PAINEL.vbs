' ===================================================================
'  PAINEL IA DE MARKETING — abre TUDO sem nenhuma janela de terminal
'  (de dois cliques aqui, ou use o atalho na Area de Trabalho)
' ===================================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta

' caminhos completos (mais confiavel que depender do PATH)
nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then nodeExe = "node"
ollamaExe = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Ollama\ollama.exe"

' 1) Garante o Ollama ligado (se ja estiver, ignora sem erro)
If fso.FileExists(ollamaExe) Then sh.Run """" & ollamaExe & """ serve", 0, False

' 2) Servidor SEGURO do painel (login + Notion + IA) na porta 8800 (oculto)
sh.Run """" & nodeExe & """ """ & pasta & "\server.js""", 0, False

' 3) Espera subir e abre o painel no navegador padrao (vai pedir login)
WScript.Sleep 3000
sh.Run "http://localhost:8800", 1, False
