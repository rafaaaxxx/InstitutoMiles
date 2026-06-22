# Frontend para Netlify

Esta pasta contém a versão estática do site para publicar no Netlify.

O backend continua no Google Apps Script. O site conversa com ele por chamadas JSONP, evitando problemas de CORS do navegador.

## Arquivos

- `index.html`: página principal do Netlify.
- `styles.css`: identidade visual.
- `app.js`: aulas, YouTube, QR code e certificado.

## Configuração obrigatória

Antes de publicar, configure uma variável de ambiente no Netlify:

```text
APPS_SCRIPT_URL
```

O valor deve ser a URL publicada do Apps Script, terminando em `/exec`:

```text
https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec
```

Essa URL não fica mais no frontend. Ela fica apenas no ambiente server-side do Netlify.

## O que continua no Apps Script

- registro de presença;
- geração de token e QR code;
- formulário aberto pelo QR code;
- gravação no Google Sheets;
- geração do certificado em PDF.

## Deploy no Netlify

Se o repositório contém a estrutura completa do projeto, use o `netlify.toml` da raiz e deixe o Netlify detectar a configuração.

Configuração equivalente:

```text
Build command: deixar vazio
Publish directory: outputs/netlify-frontend
Functions directory: outputs/netlify-frontend/netlify/functions
```

Se o repositório tiver apenas os arquivos desta pasta na raiz, use o `netlify.toml` daqui:

```text
Build command: deixar vazio
Publish directory: .
Functions directory: netlify/functions
```
