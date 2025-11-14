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
 * Decodificar base64 si existe
 */
function decodeBase64(body) {
  try {
    return Buffer.from(body, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

/**
 * Decodificar quoted-printable si existe
 */
function decodeQuotedPrintable(body) {
  try {
    return body.replace(/=(\r?\n)/g, '').replace(/=([0-9A-F]{2})/gi, (m, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  } catch {
    return body;
  }
}

/**
 * Extraer contenido REAL de un correo recursivamente
 */
function obtenerContenido(parts) {
  let contenido = '';

  for (const part of parts) {
    // Recursivo si hay subpartes
    if (part.parts && Array.isArray(part.parts)) {
      contenido += obtenerContenido(part.parts);
    }

    // Si body viene directo
    if (part.body) {
      contenido += part.body;
    }

    // Caso base64
    if (part.body && part.body.data) {
      contenido += decodeBase64(part.body.data);
    }
  }

  return contenido;
}

/**
 * Leer últimos N correos enviados desde Gmail
 */
async function leerUltimosCorreosEnviados(limit = 20) {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail');

  const searchCriteria = ['ALL'];
  const fetchOptions = { bodies: [''], struct: true }; // '' devuelve todo MIME
  const messages = await connection.search(searchCriteria, fetchOptions);
  const ultimos = messages.slice(-limit);

  const correos = ultimos.map(msg => {
    // Obtener contenido completo
    const body = msg.attributes.struct
      ? obtenerContenido(msg.attributes.struct)
      : '';

    // Limpiar el contenido
    const bodyLimpio = decodeQuotedPrintable(body)
      .replace(/<wbr>/gi, '')
      .replace(/\r?\n/g, '')
      .trim();

    let headersObj = {};
    const headerPart = msg.parts.find(p => p.which === 'HEADER');
    if (headerPart) headersObj = headerPart.body;

    return { body: bodyLimpio, headers: headersObj };
  });

  await connection.end();
  return correos;
}

/**
 * Extraer oobCode de cualquier enlace en el correo
 */
function extraerOobCode(correo) {
  if (!correo.body) return null;

  // Buscar cualquier oobCode= en el cuerpo
  const match = correo.body.match(/oobCode=([\w-]+)/);
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
  const correos = await leerUltimosCorreosEnviados(50); // más correos para mayor seguridad

  console.log('Últimos correos obtenidos (primeros 300 caracteres):');
  correos.forEach((c, i) => console.log(i, c.body.slice(0, 300)));

  // Filtrar por destinatario
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
 * Generar link completo de verificación de Firebase
 */
async function generarLinkFirebase(emailUsuario, apiKey) {
  const oobCode = await obtenerUltimoOobCodePorEmail(emailUsuario);
  const link = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=${oobCode}&apiKey=${apiKey}&lang=es-419`;
  return link;
}

module.exports = { obtenerUltimoOobCodePorEmail, generarLinkFirebase, leerUltimosCorreosEnviados };
