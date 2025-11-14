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
  const fetchOptions = { bodies: [''], struct: true };

  const messages = await connection.search(searchCriteria, fetchOptions);
  const ultimos = messages.slice(-limit);

  // Función recursiva para obtener todo el texto plano
  function obtenerTextoPlano(parts, msg) {
    let body = '';
    for (const part of parts) {
      if (Array.isArray(part.parts)) {
        body += obtenerTextoPlano(part.parts, msg);
      } else {
        const partData = msg.parts.find(p => p.which === part.partID);
        if (!partData) continue;
        if (part.type === 'text' && part.subtype === 'plain' && part.disposition !== 'attachment') {
          body += partData.body;
        }
      }
    }
    return body;
  }

  const correos = ultimos.map(msg => {
    const body = obtenerTextoPlano(msg.attributes.struct, msg);

    let headersObj = {};
    const headerPart = msg.parts.find(p => p.which === 'HEADER');
    if (headerPart) headersObj = headerPart.body;

    return { body, headers: headersObj };
  });

  await connection.end();
  return correos;
}

/**
 * Extraer oobCode del correo
 */
function extraerOobCode(correo) {
  if (!correo.body) return null;

  // Eliminar saltos de línea y buscar patrón
  const textoPlano = correo.body.replace(/\r?\n/g, '');
  const match = textoPlano.match(/mode=verifyEmail&oobCode=([A-Za-z0-9_-]+)&apiKey/);
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

  const filtrados = correos.reverse().filter(c => correoEsPara(c, emailUsuario));

  if (!filtrados.length) {
    throw new Error(`No se encontraron correos enviados a ${emailUsuario}`);
  }

  for (const correo of filtrados) {
    const oobCode = extraerOobCode(correo);
    if (oobCode) return oobCode;
  }

  throw new Error(`No se pudo extraer oobCode válido para ${emailUsuario}`);
}

/**
 * Generar link completo de verificación de Firebase usando tu dominio
 */
async function generarLinkFirebase(emailUsuario, apiKey) {
  const oobCode = await obtenerUltimoOobCodePorEmail(emailUsuario);
  const link = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=${oobCode}&apiKey=${apiKey}&lang=es-419`;
  return link;
}

module.exports = { obtenerUltimoOobCodePorEmail, generarLinkFirebase };
