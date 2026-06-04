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

' 2) Servidor do painel na porta 8800 (oculto)
sh.Run "cmd /c python -m http.server 8800", 0, False

' 3) Ponte do Notion na porta 3333 (oculto)
sh.Run "cmd /c node """ & pasta & "\notion-bridge.js""", 0, False

' 4) Espera subir e abre o painel no navegador padrao
WScript.Sleep 2500
sh.Run "http://localhost:8800", 1, False
