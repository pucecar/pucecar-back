// gmail.js
const imaps = require('imap-simple');

// Configuración IMAP de Gmail
const config = {
  imap: {
    user: 'pucecarmail1@gmail.com',
    password: 'pwbz swnq jcwm aixv',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 5000
  }
};

/**
 * Leer solo los últimos N correos enviados
 */
async function leerUltimosCorreosEnviados(limit = 10) {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail');

  const searchCriteria = ['ALL'];
  const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true };

  const messages = await connection.search(searchCriteria, fetchOptions);

  // Tomar solo los últimos N
  const ultimos = messages.slice(-limit);

  const correos = ultimos.map(msg => {
    let body = '';
    let headersObj = {};

    msg.parts.forEach(part => {
      if (part.which === 'TEXT') body += part.body;
      if (part.which === 'HEADER') headersObj = part.body;
    });

    // Convertir headers a string para poder hacer includes
    const headers = JSON.stringify(headersObj);

    return { body, headers };
  });

  await connection.end();
  return correos;
}

/**
 * Extraer oobCode de un correo (body + headers)
 */
function extraerOobCode(correo) {
  const texto = (correo.body || '') + (correo.headers || '');
  const match = texto.match(/oobCode=([\w-]+)/);
  return match ? match[1] : null;
}

/**
 * Obtener el último oobCode de un destinatario específico
 */
async function obtenerUltimoOobCodePorEmail(emailUsuario) {
  const correos = await leerUltimosCorreosEnviados(10);
  if (!correos.length) return null;

  // Buscar el primer correo cuyo 'to' incluya el emailUsuario (del más reciente al más antiguo)
  for (const correo of correos.reverse()) {
    const headersStr = correo.headers || '';
    if (headersStr.includes(emailUsuario)) {
      const oobCode = extraerOobCode(correo);
      if (oobCode) return oobCode;
    }
  }

  return null;
}

module.exports = { obtenerUltimoOobCodePorEmail };
