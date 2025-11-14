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
 * Decodificar parte base64 si existe
 */
function decodeBase64(body) {
  try {
    return Buffer.from(body, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

/**
 * Extraer cuerpo REAL (HTML o texto) recorriendo TODA la estructura MIME
 */
function obtenerContenido(parts) {
  let contenido = '';

  for (const part of parts) {
    // Si la parte tiene subpartes, recursivo
    if (part.parts && Array.isArray(part.parts)) {
      contenido += obtenerContenido(part.parts);
    }

    // Si es texto o HTML
    if (part.body && part.body.length > 0) {
      contenido += part.body;
    }

    // Caso IMAP: si el body viene en atributos
    if (part.body && part.body.data) {
      contenido += decodeBase64(part.body.data);
    }
  }

  return contenido;
}

/**
 * Leer los últimos N correos enviados desde Gmail
 */
async function leerUltimosCorreosEnviados(limit = 20) {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail');

  const searchCriteria = ['ALL'];
  const fetchOptions = { bodies: [''], struct: true }; // '' devuelve todo MIME
  const messages = await connection.search(searchCriteria, fetchOptions);
  const ultimos = messages.slice(-limit);

  const correos = ultimos.map(msg => {
    // Obtener contenido HTML o texto del correo
    const body = msg.attributes.struct
      ? obtenerContenido(msg.attributes.struct)
      : '';

    // Quitar basura tipo <wbr>, saltos, etc.
    const bodyLimpio = body
      .replace(/=\r?\n/g, '')      // quita saltos de quoted-printable
      .replace(/<wbr>/gi, '')      // quita wbr
      .replace(/\r?\n/g, '')       // quita saltos
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
 * Extraer oobCode del correo ANTES roto → AHORA acepta cualquier link
 */
function extraerOobCode(correo) {
  if (!correo.body) return null;

  // Buscar en todo el cuerpo cualquier coincidencia de oobCode=
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
  const correos = await leerUltimosCorreosEnviados(50);

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
