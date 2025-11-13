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
 * Leer correos enviados (Sent Mail / Enviados)
 */
async function leerCorreosEnviados() {
  const connection = await imaps.connect({ imap: config.imap });
  
  // Correos enviados por Gmail
  await connection.openBox('[Gmail]/Sent Mail');

  const searchCriteria = ['ALL'];
  const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'], struct: true };

  const messages = await connection.search(searchCriteria, fetchOptions);

  const correos = messages.map(msg => {
    let body = "";

    msg.parts.forEach(part => {
      if (part.which === 'TEXT') {
        body += part.body;
      }
    });

    return body;
  });

  await connection.end();
  return correos;
}

/**
 * Extraer link completo
 */
function extraerLinkCompleto(cuerpo) {
  const regex = /(https:\/\/pucecar-[^\s"]+)/;
  const match = cuerpo.match(regex);
  return match ? match[1] : null;
}

/**
 * Extraer oobCode sin depender del orden de parámetros
 */
function extraerOobCode(cuerpo) {
  const regex = /oobCode=([^&]+)/;
  const match = cuerpo.match(regex);
  return match ? match[1] : null;
}

/**
 * Obtener último oobCode desde los correos enviados
 */
async function obtenerUltimoOobCode() {
  const correos = await leerCorreosEnviados();

  console.log("============== CORREOS ENVIADOS ==============");
  console.log(correos);
  console.log("==============================================");

  for (const correo of correos.reverse()) {  
    const link = extraerLinkCompleto(correo);
    console.log("LINK ENCONTRADO:", link);

    const code = extraerOobCode(correo);
    console.log("OOBCode EXTRAÍDO:", code);

    if (code) return code;
  }

  return null;
}

module.exports = { obtenerUltimoOobCode };
