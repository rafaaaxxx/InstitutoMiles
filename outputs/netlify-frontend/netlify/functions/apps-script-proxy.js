exports.handler = async function(event) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    return jsonResponse(500, {
      ok: false,
      message: 'A variável de ambiente APPS_SCRIPT_URL não foi configurada no Netlify.'
    });
  }

  const params = event.queryStringParameters || {};
  const action = String(params.action || '').trim();
  if (!action) {
    return jsonResponse(400, {
      ok: false,
      message: 'Ação ausente.'
    });
  }

  try {
    const url = new URL(appsScriptUrl);
    Object.keys(params).forEach((key) => {
      url.searchParams.set(key, params[key]);
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      return jsonResponse(502, {
        ok: false,
        message: 'O Apps Script retornou uma resposta inválida.',
        details: text.slice(0, 300)
      });
    }

    return jsonResponse(response.ok ? 200 : response.status, payload);
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      message: error.message || 'Não foi possível comunicar com o Apps Script.'
    });
  }
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
}
