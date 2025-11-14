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
  const fetchOptions = { bodies: ['HEADER', ''], struct: true }; // '' para obtener todo el body

  const messages = await connection.search(searchCriteria, fetchOptions);

  // Tomar solo los últimos N
  const ultimos = messages.slice(-limit);

  const correos = ultimos.map(msg => {
    let body = '';
    let headersObj = {};

    // Recorrer todas las partes para obtener text/plain
    const parts = imaps.getParts(msg.attributes.struct);
    parts.forEach(part => {
      const partData = msg.parts.find(p => p.which === part.partID);
      if (!partData) return;

      if (part.type === 'text' && part.subtype === 'plain' && part.disposition !== 'attachment') {
        body += partData.body;
      }

      if (part.which === 'HEADER') {
        headersObj = partData.body;
      }
    });

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

  // Eliminar saltos de línea y buscar el patrón
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

  console.log('Últimos correos obtenidos (primeros 200 caracteres de cada uno):');
  correos.forEach((c, i) => console.log(i, c.body.slice(0, 200)));

  // Filtrar correos enviados a este usuario y recorrer de más reciente a más antiguo
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
 * Generar link de verificación de Firebase a partir del correo
 */
async function generarLinkFirebase(emailUsuario, apiKey) {
  const oobCode = await obtenerUltimoOobCodePorEmail(emailUsuario);
  const link = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?oobCode=${oobCode}&apiKey=${apiKey}`;
  return link;
}

module.exports = { obtenerUltimoOobCodePorEmail, generarLinkFirebase };
