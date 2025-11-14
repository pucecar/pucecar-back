const imaps = require('imap-simple');
const { decode } = require('quoted-printable');

// Configuración IMAP de Gmail
const config = {
  imap: {
    user: 'pucecarmail1@gmail.com',      // tu correo Gmail
    password: 'pwbz swnq jcwm aixv',     // contraseña de app
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 5000
  }
};

/**
 * Leer los últimos N correos enviados
 */
async function leerCorreosEnviados(limit = 10) {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail');

  const searchCriteria = ['ALL'];
  const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true };

  const messages = await connection.search(searchCriteria, fetchOptions);
  const ultimos = messages.slice(-limit);

  const correos = ultimos.map(msg => {
    let body = "";
    msg.parts.forEach(part => {
      if (part.which === 'TEXT') body += part.body;
    });

    // Decodificar quoted-printable si es necesario
    body = decode(body);

    return { body };
  });

  await connection.end();
  return correos;
}

/**
 * Extraer el oobCode del cuerpo del correo
 */
function extraerOobCodeDeCorreo(correo) {
  const body = correo.body || "";
  const match = body.match(/oobCode=([\w-]+)/);
  return match ? match[1] : null;
}

/**
 * Obtener el oobCode del último correo enviado
 */
async function obtenerUltimoOobCode() {
  try {
    const correos = await leerCorreosEnviados(10);

    for (const correo of correos) {
      const oobCode = extraerOobCodeDeCorreo(correo);
      if (oobCode) return oobCode;
    }

    return null;
  } catch (error) {
    console.error("Error obteniendo el último oobCode:", error);
    return null;
  }
}

module.exports = { obtenerUltimoOobCode };
