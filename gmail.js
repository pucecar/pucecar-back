// gmail.js
const imaps = require('imap-simple');

const config = {
  imap: {
    user: 'pucecarmail1@gmail.com',
    password: 'pwbz swnq jcwm aixv',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 20000,
  },
};

/**
 * Leer últimos N correos enviados
 */
async function leerUltimosCorreosEnviados(limit = 10) {
  let connection;
  try {
    connection = await imaps.connect({ imap: config.imap });
    await connection.openBox('[Gmail]/Sent Mail');

    const searchCriteria = ['ALL'];
    const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true };

    const messages = await connection.search(searchCriteria, fetchOptions);
    const ultimos = messages.slice(-limit);

    const correos = ultimos.map(msg => {
      let body = '';
      msg.parts.forEach(part => {
        if (part.which === 'TEXT') body += part.body;
      });
      return { body };
    });

    return correos;
  } catch (err) {
    console.error('Error leyendo correos IMAP:', err);
    return [];
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Extraer oobCode completo desde el cuerpo del correo
 */
function extraerOobCode(correo) {
  if (!correo.body) return null;
  const match = correo.body.match(/mode=verifyEmail&oobCode=([^&\s]+)/);
  return match ? match[1] : null;
}

/**
 * Obtener el último oobCode de un destinatario
 */
async function obtenerUltimoOobCodePorEmail(emailUsuario) {
  const correos = await leerUltimosCorreosEnviados(10);

  for (const correo of correos.reverse()) {
    // Busca el email dentro del cuerpo, ya que headers pueden fallar
    if (correo.body && correo.body.includes(emailUsuario)) {
      const oobCode = extraerOobCode(correo);
      if (oobCode) return oobCode;
    }
  }

  return null;
}

module.exports = { obtenerUltimoOobCodePorEmail };
