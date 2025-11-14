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

    return { body, headers: headersObj };
  });

  await connection.end();
  return correos;
}

/**
 * Extraer oobCode de un correo (body + headers)
 */
function extraerOobCode(correo) {
  const texto = (correo.body || '') + JSON.stringify(correo.headers || {});
  const match = texto.match(/oobCode=([\w-]+)/);
  return match ? match[1] : null;
}

/**
 * Validar si un correo fue enviado a un destinatario específico
 */
function correoEsPara(correo, emailUsuario) {
  if (!correo.headers || !correo.headers.to) return false;
  const toHeader = Array.isArray(correo.headers.to) ? correo.headers.to : [correo.headers.to];
  return toHeader.some(dest => dest.includes(emailUsuario));
}

/**
 * Obtener el último oobCode de un destinatario específico
 */
async function obtenerUltimoOobCodePorEmail(emailUsuario) {
  const correos = await leerUltimosCorreosEnviados(10);
  for (const correo of correos.reverse()) { // reverse para empezar por el más reciente
    if (correoEsPara(correo, emailUsuario)) {
      const oobCode = extraerOobCode(correo);
      if (oobCode) return oobCode;
    }
  }
  return null;
}

module.exports = { obtenerUltimoOobCodePorEmail };
