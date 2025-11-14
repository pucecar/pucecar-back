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
async function leerUltimosCorreosEnviados(limit = 20) {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail');

  const searchCriteria = ['ALL'];
  const fetchOptions = { bodies: [''], struct: true }; // '' para obtener todo
  const messages = await connection.search(searchCriteria, fetchOptions);
  const ultimos = messages.slice(-limit);

  function getBody(parts, msg) {
    let body = '';
    for (const part of parts) {
      if (Array.isArray(part.parts)) {
        body += getBody(part.parts, msg);
      } else if (part.type === 'text' && part.subtype === 'plain') {
        const partData = msg.parts.find(p => p.partID === part.partID);
        if (partData && partData.body) body += partData.body;
      }
    }
    return body;
  }

  const correos = ultimos.map(msg => {
    const body = msg.attributes.struct ? getBody(msg.attributes.struct, msg) : '';
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
  const textoPlano = correo.body.replace(/\r?\n/g, '');
  const match = textoPlano.match(/mode=verifyEmail&oobCode=([A-Za-z0-9_-]+)&apiKey/);
  return match ? match[1] : null;
}

/**
 * Verifica si el correo fue enviado a un destinatario específico
 */
function correoEsPara(correo, emailUsuario) {
  if (!correo.headers) return false;

  let toList = [];
  if (correo.headers.to) toList = Array.isArray(correo.headers.to) ? correo.headers.to : [correo.headers.to];
  else if (correo.headers.To) toList = Array.isArray(correo.headers.To) ? correo.headers.To : [correo.headers.To];

  toList = toList.map(t => (typeof t === 'string' ? t : t.value ? t.value.join(',') : ''));

  return toList.some(dest => dest.includes(emailUsuario));
}

/**
 * Obtener el último oobCode válido para un email específico
 */
async function obtenerUltimoOobCodePorEmail(emailUsuario) {
  const correos = await leerUltimosCorreosEnviados(50); // más correos por seguridad

  console.log('Últimos correos obtenidos (primeros 200 caracteres):');
  correos.forEach((c, i) => console.log(i, c.body.slice(0, 200)));

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
