# 🗂️ Conectar o calendário ao Notion (automático)

Já deixei **toda a parte técnica pronta** (a "Ponte Notion" + o botão no painel). Falta só o que **só você pode fazer**, porque depende do **seu login no Notion** (eu nunca tenho sua senha). São **3 passinhos**, leva ~5 minutos. Você faz uma vez e nunca mais.

---

## Passo 1 — Criar sua "integração" no Notion (pegar o token)
1. Entre em **https://www.notion.so/my-integrations** (logada na sua conta).
2. Clique em **+ New integration**.
3. Dê um nome (ex: `Painel IA`), escolha seu workspace e clique em **Submit/Save**.
4. Vai aparecer **Internal Integration Secret** → clique em **Show** e **copie** esse código
   (começa com `secret_` ou `ntn_`). **Esse é o seu TOKEN.**

## Passo 2 — Criar a database e compartilhar com a integração
1. No Notion, crie uma página nova e digite `/database` → escolha **Table - Full page** (uma tabela).
   (Não precisa criar colunas — a ponte joga tudo dentro de cada item.)
2. No canto superior direito dessa tabela, clique nos **três pontinhos `•••`** → **Connections** (ou "Conexões") → procure e adicione a sua integração **`Painel IA`**.
3. Copie o **link** dessa database: clique em `•••` → **Copy link**. (Pode colar o link inteiro — a ponte entende.)

## Passo 3 — Colar token e link no arquivo de configuração
1. Abra o arquivo **`notion-config.json`** (nesta pasta) com o Bloco de Notas.
2. Substitua os textos pelos seus:
   ```json
   {
     "token": "cole_aqui_o_token_do_passo_1",
     "databaseId": "cole_aqui_o_link_da_database_do_passo_2",
     "port": 3333
   }
   ```
3. **Salve** o arquivo (Ctrl+S).

---

## ✅ Pronto! Como usar
1. Feche o painel se estiver aberto e abra com **`ABRIR TUDO (painel + notion).bat`**
   (ele abre o painel **e** a Ponte Notion).
2. No painel, vá no especialista **🗓️ Calendário Editorial** e peça um calendário.
3. Quando a tabela aparecer, clique em **🚀 Enviar pro Notion**.
4. Olhe sua database no Notion — cada dia do calendário vira um item lá. 🎉

---

## 🆘 Deu erro?
- **"Configure o token..."** → você ainda não preencheu/salvou o `notion-config.json`.
- **"Notion 401"** → o token está errado ou faltou um pedaço ao copiar.
- **"Notion 404 / could not find database"** → você esqueceu o **Passo 2.2** (compartilhar a database com a integração) ou o link está errado.
- **"Não consegui enviar pro Notion"** → a janela **"Ponte Notion"** não está aberta. Use o `ABRIR TUDO`.

Qualquer travada, me chama que eu te ajudo a achar o erro. 💜
