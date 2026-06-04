# 🔐🌍 Login + acessar de qualquer lugar

Agora o painel tem **login** (só pessoal autorizado entra, senha **criptografada**) e dá pra abrir **no celular / outro PC** por um link.

---

## 1) Primeiro acesso — criar sua conta
1. Abra pelo **ícone "Painel IA de Marketing"** (Área de Trabalho). Vai aparecer a tela de **login**.
2. Clique em **"Não tem conta? Criar conta"**.
3. Preencha **usuário**, **senha** e o **código de convite**.
4. Seu código de convite é:

   > ## `D47FF2FC`

5. Clique em **Criar conta**. A primeira conta vira **administrador** (você). ✅

> Esse código fica no arquivo `server-config.json`. **Só dê ele a quem você autorizar** — quem tiver o código consegue criar uma conta.

---

## 2) Abrir no celular / outro PC (link público)
1. No seu PC, dê dois cliques em **`ABRIR-ONLINE.bat`**.
2. Vai abrir uma janela preta. Espere aparecer um endereço assim:
   `https://algumas-palavras.trycloudflare.com`
3. **Esse é o link.** Abra ele no navegador do **celular** (ou manda pra outro PC).
4. Faça **login** com seu usuário e senha. Pronto, tá usando de qualquer lugar! 📱💻

---

## ⚠️ O que você precisa saber (importante e honesto)
- **Seu PC precisa ficar LIGADO** e com a janela do `ABRIR-ONLINE.bat` aberta. Se desligar, o link para de funcionar (a IA mora no seu PC).
- O link **gratuito muda toda vez** que você abre o `ABRIR-ONLINE.bat`. **Link fixo (que não muda):** precisa de um **domínio** (~R$ 40/ano) numa conta **grátis** da Cloudflare. Quando você tiver um domínio, eu configuro o "túnel nomeado" e o link fica fixo pra sempre. (Sem domínio, não dá pra ter link fixo de graça.)
- ✅ **Seus dados SINCRONIZAM entre aparelhos!** Tudo que você cria (clientes, CRM, conversas, ganchos) fica salvo na sua conta. Você loga no celular e **aparece tudo igual** ao do PC. (Enquanto o `ABRIR-ONLINE.bat` estiver ligado no seu PC.)
- Pra **vender como produto** de verdade (sempre online, sem depender do seu PC), o caminho é hospedar na **nuvem** (tem custo mensal). Te mostro as opções quando chegar a hora.

---

## 👥 Autorizar mais pessoas
Dê a elas o **código de convite** (`D47FF2FC`). Elas abrem o link, clicam em "Criar conta" e usam o código. Cada uma tem o próprio login e senha.

## 🚪 Sair / trocar de conta
No painel, ⚙️ Configurações → **🚪 Sair da conta**.

## 🆘 Esqueci tudo / quero zerar os logins
Apague os arquivos `users.json` e `sessions.json` da pasta e cadastre de novo.

Qualquer coisa, me chama! 💜
