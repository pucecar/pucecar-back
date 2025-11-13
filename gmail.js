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
    authTimeout: 3000
  }
};

/**
 * Leer últimos correos enviados (Sent)
 */
async function leerCorreosEnviados() {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail'); // o '[Gmail]/Enviados'

  const searchCriteria = [['FROM', config.imap.user]]; // correos enviados desde este Gmail
  const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: false };

  const messages = await connection.search(searchCriteria, fetchOptions);

  const correos = messages.map(item => {
    const all = item.parts.find(part => part.which === 'TEXT');
    return all.body;
  });

  await connection.end();
  return correos;
}

/**
 * Extraer oobCode del cuerpo del correo
 */
function extraerOobCode(cuerpoCorreo) {
  // Tomamos el parámetro oobCode hasta &apiKey
  const regex = /oobCode=([A-Za-z0-9-_]+)&apiKey=/;
  const match = cuerpoCorreo.match(regex);
  if (match && match[1]) return match[1];
  return null;
}

/**
 * Obtener el último oobCode disponible
 */
async function obtenerUltimoOobCode() {
  const correos = await leerCorreosEnviados();
  if (!correos.length) return null;

  for (const correo of correos) {
    const code = extraerOobCode(correo);
    if (code) return code;
  }

  return null;
}

module.exports = { obtenerUltimoOobCode };
