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
 * Leer últimos N correos enviados
 */
async function leerCorreosEnviados(limit = 10) {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail');

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

    // Extraer destinatario desde los headers
    const toMatch = headers.match(/To:\s*(.+)/i);
    const destinatario = toMatch ? toMatch[1].trim() : null;

    return { body, headers, destinatario };
  });

  await connection.end();
  return correos;
}

/**
 * Extraer oobCode del cuerpo del correo
 */
function extraerOobCode(cuerpo) {
  const match = cuerpo.match(/oobCode=([\w-]+)/);
  return match ? match[1] : null;
}

/**
 * Obtener último oobCode de un email específico
 */
async function obtenerUltimoOobCode(emailUsuario) {
  const correos = await leerCorreosEnviados(10); // últimos 10 correos
  if (!correos.length) return null;

  // Buscar el primer correo cuyo destinatario coincida con el email del usuario
  for (const correo of correos.reverse()) { // empezando por el más reciente
    if (!correo.destinatario) continue;

    // Normalizar emails
    const destinatarioLimpio = correo.destinatario.replace(/<|>/g, "").toLowerCase();
    const emailUsuarioLimpio = emailUsuario.toLowerCase();

    if (destinatarioLimpio.includes(emailUsuarioLimpio)) {
      const oobCode = extraerOobCode(correo.body);
      if (oobCode) return oobCode;
    }
  }

  return null;
}

module.exports = { obtenerUltimoOobCode };
