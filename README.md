# 📈 Painel IA de Marketing — Diretora Sênior

Uma IA de marketing **não-genérica** que roda **100% local e grátis** no seu PC, usando o [Ollama](https://ollama.com) + um modelo open-source (ex: `qwen2.5:7b`).

Pensada para quem trabalha com **social media, marketing de influência e tráfego** — e para **revender** o atendimento para outras empresas (multi-cliente + white-label).

![feito com HTML/CSS/JS puro](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS%20puro-7c5cff) ![roda local](https://img.shields.io/badge/100%25-local%20%26%20gr%C3%A1tis-3ddc84)

---

## ✨ O que ela faz

- **10 especialistas:** Diretora de Marketing, Social Media, Influencer, SEO & Conversão, Estratégia/SWOT, Roteirista, Tráfego Pago, E-mail/CRM, Calendário Editorial e Programadora.
- **Memória da empresa (brand voice):** preencha 1 vez (nicho, persona, oferta, tom, concorrentes, metas, objeções…) e ela responde como dona do negócio — adeus resposta genérica.
- **Multi-cliente:** gerencie várias empresas, cada uma com sua memória. Ideal para agência.
- **Calendário editorial** → exporta para **Notion** (colar) e **Excel/Sheets** (.CSV).
- **Templates prontos**, **refino em 1 clique** (menos genérico, mais curto, 3 variações…), **ditado por voz**, **tema claro/escuro**, **backup** dos dados.
- Privada: tudo fica no seu navegador. A IA **não acessa a internet** e **não inventa links**.

---

## 🚀 Como rodar

> Pré-requisito: ter o **Ollama** instalado e um modelo baixado:
> ```bash
> ollama pull qwen2.5:7b
> ```

**Windows (mais fácil):** dê dois cliques em **`ABRIR PAINEL.bat`**.

**Qualquer sistema (manual):**
```bash
cd painel-ia-marketing
python -m http.server 8800
# abra http://localhost:8800 no navegador
```

> Precisa abrir via servidor (localhost), não pelo `file://` — senão o navegador bloqueia o acesso ao Ollama (CORS).

---

## 🛠️ Stack

HTML + CSS + JavaScript puro, arquivo único (`index.html`). Sem build, sem dependências obrigatórias. Conversa com a API do Ollama (`/api/chat`, streaming). Dados em `localStorage`. Markdown via `marked` + `DOMPurify` (CDN, com fallback offline).

## 📄 Licença

Uso livre. Feito para o trabalho de marketing da Gerson / sua agência.
