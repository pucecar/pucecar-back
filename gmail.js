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
 * Leer los últimos N correos enviados desde Gmail
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
 * Extraer oobCode completo del correo
 */
function extraerOobCode(correo) {
  const texto = correo.body || '';
  // Regex: todo lo que sigue después de '=verifyEmail&oobCode=' hasta '&apiKey'
  const match = texto.match(/=verifyEmail&oobCode=([A-Za-z0-9_-]+)&apiKey/);
  if (match && match[1]) return match[1];
  return null;
}

/**
 * Verifica si el correo fue enviado a un destinatario específico
 */
function correoEsPara(correo, emailUsuario) {
  if (!correo.headers || !correo.headers.to) return false;
  const toHeader = Array.isArray(correo.headers.to) ? correo.headers.to : [correo.headers.to];
  return toHeader.some(dest => dest.includes(emailUsuario));
}

/**
 * Obtener el último oobCode válido para un email específico
 */
async function obtenerUltimoOobCodePorEmail(emailUsuario) {
  const correos = await leerUltimosCorreosEnviados(10);

  // Filtrar correos enviados a este usuario y recorrer de más reciente a más antiguo
  const filtrados = correos.reverse().filter(c => correoEsPara(c, emailUsuario));

  if (!filtrados.length) {
    throw new Error(`No se encontraron correos enviados a ${emailUsuario}`);
  }

  for (const correo of filtrados) {
    const oobCode = extraerOobCode(correo);
    if (oobCode) return oobCode;
  }

  // Si llegamos aquí, había correos pero ninguno tenía oobCode válido
  throw new Error(`No se pudo extraer oobCode válido para ${emailUsuario}`);
}

module.exports = { obtenerUltimoOobCodePorEmail };
