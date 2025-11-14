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
function extraerCorreoDestino(headers) {
  const regex = /To:\s*(.*)\r?\n/i;
  const match = headers.match(regex);
  if (!match) return null;

  const clean = match[1].replace(/<|>|"/g, '').trim();
  return clean;
}

/**
 * Obtener el último correo enviado con TODA la info útil:
 * emailDestino, oobCode, linkCompleto
 */
async function obtenerUltimoOobCode() {
  const correos = await leerCorreosEnviados(10); // <--- SOLO 10 ÚLTIMOS

  console.log("============== ÚLTIMOS 10 CORREOS ==============");
  console.log(correos);
  console.log("===============================================");

  // Revisar de más reciente a más antiguo
  for (const correo of correos.reverse()) {

    const email = extraerCorreoDestino(correo.headers);
    const link = extraerLinkCompleto(correo.body);
    const code = extraerOobCode(correo.body);

    console.log("DESTINATARIO:", email);
    console.log("LINK:", link);
    console.log("OOBCode:", code);

    if (email && code) {
      return {
        emailDestino: email,
        oobCode: code,
        linkCompleto: link
      };
    }
  }

  return null;
}

module.exports = { obtenerUltimoOobCode };
