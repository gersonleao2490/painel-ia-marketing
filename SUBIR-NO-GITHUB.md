# ☁️ Como subir no GitHub (3 minutos)

Eu já deixei **tudo pronto**: o repositório foi criado aqui no seu PC e o primeiro commit já foi feito. Só falta a parte que **eu não posso fazer por você por segurança**: o **login na sua conta do GitHub**. Eu nunca tenho (e nem devo ter) a sua senha/token. Então os últimos cliques são seus — bem rapidinho:

---

## Passo 1 — Criar o repositório vazio no GitHub
1. Entre em **https://github.com/new** (logado na sua conta `gersonleao2490`).
2. **Repository name:** `painel-ia-marketing`
3. Escolha **Private** (recomendado, já que você vai vender) ou **Public**.
4. **NÃO** marque "Add a README" (já temos um).
5. Clique em **Create repository**.
6. Copie a URL que aparece, algo como:
   `https://github.com/gersonleao2490/painel-ia-marketing.git`

## Passo 2 — Enviar os arquivos
Dê dois cliques em **`SUBIR-NO-GITHUB.bat`** (nesta pasta).
Ele vai pedir a URL que você copiou — cole e aperte Enter.
Na primeira vez, vai abrir uma **janela do navegador para você fazer login no GitHub** (é o normal — o próprio Git cuida disso). Faça o login e pronto. ✅

Depois disso, seu painel está no GitHub. Para atualizar no futuro, rode o `.bat` de novo.

---

### "Posso transformar num site online (link) para os clientes usarem?"
O código pode ficar no GitHub, mas **lembre:** este painel só funciona em um computador que tenha o **Ollama rodando**. Um link público (GitHub Pages) **não** conseguiria conversar com a IA, porque a IA mora no `localhost` de cada máquina.

Para vender como serviço online de verdade (link que funciona pra qualquer cliente), o caminho é hospedar com um **modelo na nuvem** (isso tem custo mensal). Quando você chegar nesse ponto, a gente planeja isso junto. Por enquanto: cada cliente roda local, de graça. 💜
