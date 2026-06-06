# ☁️ Colocar o Painel 100% na nuvem (Vercel + Neon + Gemini)

Quando isso terminar, seu painel fica **online por um link fixo**, acessível de **qualquer aparelho**, **sem depender do seu PC ligado**. Tudo com **plano grátis** pra começar.

> Eu já fiz **todo o código** (banco, login na nuvem, IA, análise por @). Faltam só **3 cadastros que são seus** (envolvem sua conta/cartão), e eu te guio em cada clique. 💜

---

## Visão geral (o que cada peça faz)
- **Neon** = o banco de dados na nuvem (guarda usuários e seus dados). Grátis.
- **Vercel** = onde o painel fica hospedado e roda. Grátis.
- **Gemini** = a IA (você já tem a chave). Grátis.

---

## Passo 1 — Criar o banco no Neon (~3 min)
1. Entre em **https://neon.tech** → **Sign up** (pode usar o Google/GitHub).
2. Clique em **Create project** (nome: `painel-ia`, região mais perto do Brasil, ex: *AWS São Paulo* se aparecer).
3. Quando criar, ele mostra uma **Connection string** (começa com `postgresql://...`). Clique em **Copy**.
4. **Guarde essa string** — vamos colá-la no Vercel no Passo 3. (As tabelas o painel cria sozinho na 1ª vez.)

## Passo 2 — Importar o projeto no Vercel (~3 min)
1. Entre em **https://vercel.com** → **Sign up** com o **GitHub** (a mesma conta do repositório).
2. Clique em **Add New… → Project**.
3. Na lista, ache **`painel-ia-marketing`** e clique em **Import**.
4. **Não mude nada** das configurações de build (é Node puro). Antes de clicar em Deploy, vá em **Environment Variables** (Passo 3).

## Passo 3 — Variáveis de ambiente (as "chaves secretas")
Ainda na tela do Vercel, adicione estas variáveis (nome → valor):

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a connection string do Neon (Passo 1) |
| `SESSION_SECRET` | invente uma frase longa e aleatória (ex: `marketing-roxo-2026-xYz!9q`) |
| `INVITE_CODE` | um código só seu p/ liberar cadastro (ex: `LAURA2026`) |
| `GEMINI_KEY` | sua chave do Gemini (a que já usamos) |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

> A chave da **API de dados (RapidAPI)** pode ficar pra depois — dá pra colar direto no painel em ⚙️ quando você tiver. (Ou já adicione `RAPIDAPI_KEY` aqui também.)

Depois clique em **Deploy** e espere ~1 minuto.

## Passo 4 — Primeiro acesso
1. O Vercel te dá um link tipo **`https://painel-ia-marketing.vercel.app`**. Abra.
2. Clique em **Cadastrar**, use seu nome, uma senha e o **INVITE_CODE** que você definiu.
3. O **1º cadastro vira admin** (você). Pronto, tá no ar! 🎉
4. Em ⚙️, se ainda não colou, conecte a **API de dados** e use o **🔍 Analisar @**.

---

## Como atualizar o painel depois
Toda vez que eu (ou você) mandar uma melhoria pro GitHub, o **Vercel publica sozinho** em ~1 min. Sem mexer em mais nada.

## 💰 Custos
- Neon: grátis (plano free dá de sobra pra começar).
- Vercel: grátis (plano Hobby).
- Gemini: grátis.
- API de dados (RapidAPI): grátis pra testar; só paga se for vender muito (Fase 4).
**Total pra começar: R$ 0.** Bem dentro dos seus R$ 50/mês.

## ⚠️ Observações honestas
- O seu painel **local (no PC)** continua funcionando igual — essa versão nuvem é adicional.
- Seus dados atuais (clientes, conversas) ficam **no navegador** e sincronizam com o Neon quando você logar na nuvem. Nada se perde.
- O **envio pro Notion** ainda está só na versão local por enquanto; na nuvem eu ligo logo em seguida (é rapidinho).
- **A 1ª publicação a gente confere junta** — é normal um deploy na nuvem precisar de 1 ou 2 ajustes finos de configuração. Me chama que eu acompanho.

## 🆘 Deu algo errado?
Me manda um **print da tela do Vercel** (especialmente se aparecer erro vermelho em *Deployments → Logs*) que eu te falo exatamente o que ajustar. Pode me chamar que eu abro junto com você. 💜
