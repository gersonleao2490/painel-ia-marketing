# 🔍 Ligar a Análise de Perfil por @ (Fase 2)

Isso ativa o botão **🔍 Analisar @** do painel: você digita um **@** e ele puxa os números reais do Instagram (seguidores, posts, engajamento) e a IA faz a **auditoria estratégica completa** — tipo Not Just Analytics, só que com **plano de ação**.

> Pré-requisito: a **IA na nuvem (Gemini)** já tem que estar ligada (você fez isso na Fase 1 ✅).

---

## Por que preciso de uma "API de dados"?
O Instagram não deixa pegar os números de qualquer perfil de graça. Quem faz isso (inclusive o próprio NJL) usa um **serviço de dados** por trás. Você contrata um desses serviços (tem **cota grátis** pra testar) e cola a chave no painel — do mesmo jeito que fez com o Gemini. **Eu não construo um "raspador"** porque isso poderia banir a sua conta; o serviço assume essa parte.

---

## Passo 1 — Criar conta no RapidAPI (grátis, ~2 min)
1. Entre em **https://rapidapi.com** e clique em **Sign Up** (pode entrar com a conta Google).
2. Confirme o e-mail se pedir. Pronto, conta criada.

## Passo 2 — Assinar a API de dados (plano grátis)
1. Abra esta API: **https://rapidapi.com/social-api1-instagram/api/instagram-scraper-api2**
   *(é a “Instagram Scraper API2”, uma das mais usadas)*
2. Clique na aba **Pricing** (Preços).
3. Escolha o plano **Basic / Free** (R$ 0) e clique em **Subscribe** (Assinar).
   - ⚠️ Ele pode pedir um cartão pra “confirmar”, mas o plano **Free não cobra** — só cobra se você passar da cota e subir de plano. Você controla isso.
4. Volte para a aba **Endpoints**.

## Passo 3 — Copiar a sua chave
1. Ainda na página da API, procure no painel da direita (ou na aba **Endpoints**) o campo **`X-RapidAPI-Key`**.
2. Vai ser um código grande. Clique no olhinho 👁️ pra revelar e **copie** ele inteiro.

## Passo 4 — Colar no painel
1. No painel, clique em **⚙️** (engrenagem).
2. Na caixa rosa **“🔍 Análise de Perfil por @ (API de dados)”**, **cole a chave**.
3. Clique em **“Conectar API de dados”**.
4. Deve aparecer **“✓ API de dados conectada!”**.

## Passo 5 — Usar! 🎉
1. Lá em cima, clique no botão **🔍 Analisar @**.
2. Digite um **@** (ex: `nike` ou o seu, `_vieira_laura`) e clique **📊 Analisar agora**.
3. Em alguns segundos aparece no chat o **relatório completo**: números + diagnóstico + bio otimizada + plano de 30 dias + ações da semana.
4. Você pode **📋 copiar**, **🖨️ PDF** ou **🚀 mandar pro Notion**, igual qualquer resposta.

---

## 💰 Custo (honesto)
- O plano **Free** dá um número limitado de análises por mês (boa pra testar e usar pouco).
- Se você for **vender** isso pra clientes (muitas análises), aí sim sobe pra um plano pago da API. A gente vê isso quando chegar lá (Fase 4 = cobrar clientes).
- A IA (Gemini) que escreve a auditoria continua **grátis**.

## 🔒 Privacidade e regras
Essas APIs leem **dados públicos** do Instagram (o que qualquer um vê no perfil). É uma **área cinza** das regras do Instagram, e o risco fica com o **serviço de dados**, não com a sua conta pessoal. É exatamente o modelo que o NJL e ferramentas parecidas usam.

## 🆘 Deu erro?
- **“API recusou sua chave (401/403)”** → a chave foi colada errada/incompleta, ou você ainda não clicou em **Subscribe** no plano Free. Refaça os Passos 2 e 3.
- **“atingiu o limite grátis (429)”** → você usou a cota do mês. Espera renovar ou sobe o plano.
- **“não consegui ler os dados desse @”** → o perfil pode não existir, ser privado, ou a API mudou o formato. **Me manda um print** que eu ajusto a leitura rapidinho.

Qualquer passo que travar, me chama que eu te guio (posso até abrir o navegador junto com você). 💜
