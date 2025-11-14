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
async function leerCorreosEnviados(limit = 10) {
  const connection = await imaps.connect({ imap: config.imap });

  await connection.openBox('[Gmail]/Sent Mail');

  // Buscar solo por UID para limitar
  const searchCriteria = ['ALL'];
  const fetchOptions = {
    bodies: ['HEADER', 'TEXT'],
    struct: true
  };

  const messages = await connection.search(searchCriteria, fetchOptions);

  // Tomar solo los últimos N
  const ultimos = messages.slice(-limit);

  const correos = ultimos.map(msg => {
    let body = "";
    let headers = "";

    msg.parts.forEach(part => {
      if (part.which === 'TEXT') body += part.body;
      if (part.which === 'HEADER') headers = part.body;
    });

    return { body, headers };
  });

  await connection.end();
  return correos;
}

/**
 * Extraer link completo
 */
function extraerLinkCompleto(texto) {
  const regex = /(https:\/\/pucecar-[^\s"]+)/;
  const match = texto.match(regex);
  return match ? match[1] : null;
}

/**
 * Extraer oobCode independientemente del orden
 */
function extraerOobCode(texto) {
  const regex = /oobCode=([^&]+)/;
  const match = texto.match(regex);
  return match ? match[1] : null;
}

/**
 * Extraer correo destinatario del HEADER
 */
function extraerCorreoDestino(email) {
  // email.body contiene el contenido del correo
  const html = email.body || "";

  // Buscar el parámetro oobCode en el href
  const match = html.match(/oobCode=([\w-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

async function obtenerUltimoOobCode() {
  const correos = await obtenerUltimosCorreos(); // tu función que obtiene los últimos 10 correos
  if (!correos.length) return null;

  for (const correo of correos) {
    const oobCode = extraerCorreoDestino(correo);
    if (oobCode) return oobCode;
  }

  return null;
}

module.exports = { obtenerUltimoOobCode };
