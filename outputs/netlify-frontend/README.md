# Frontend para Netlify

Esta pasta contém a versão estática do site para publicar no Netlify.

O backend continua no Google Apps Script. O site conversa com ele por chamadas JSONP, evitando problemas de CORS do navegador.

## Arquivos

- `index.html`: página principal do Netlify.
- `styles.css`: identidade visual.
- `app.js`: aulas, YouTube, QR code e certificado.

## Configuração obrigatória

Antes de publicar, abra `app.js` e substitua:

```js
const APPS_SCRIPT_URL = 'COLE_AQUI_A_URL_DO_APPS_SCRIPT_EXEC';
```

pela URL publicada do Apps Script, terminando em `/exec`:

```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec';
```

## O que continua no Apps Script

- registro de presença;
- geração de token e QR code;
- formulário aberto pelo QR code;
- gravação no Google Sheets;
- geração do certificado em PDF.

## Deploy no Netlify

No Netlify, publique esta pasta:

```text
outputs/netlify-frontend
```

Se usar GitHub, a configuração é:

```text
Build command: deixar vazio
Publish directory: outputs/netlify-frontend
```

Se o repositório tiver apenas os arquivos desta pasta na raiz, use:

```text
Publish directory: .
```
