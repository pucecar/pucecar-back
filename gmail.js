// gmail.js
const imaps = require('imap-simple');
const cheerio = require('cheerio');

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

// Decodificar base64 si es necesario
function decodeBase64(body) {
  try {
    return Buffer.from(body, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

// Obtener contenido recursivo y limpiar HTML
function obtenerContenido(parts) {
  let contenido = '';
  for (const part of parts) {
    if (part.parts && Array.isArray(part.parts)) {
      contenido += obtenerContenido(part.parts);
    }
    if (part.body && part.body.data) {
      contenido += decodeBase64(part.body.data);
    }
  }
  return contenido;
}

// Limpiar HTML a texto usando Cheerio
function limpiarHTML(html) {
  const $ = cheerio.load(html);
  return $.text().replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

// Leer últimos N correos enviados
async function leerUltimosCorreosEnviados(limit = 20) {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail'); // o '[Gmail]/Enviados'

  const searchCriteria = ['ALL'];
  const fetchOptions = { bodies: [''], struct: true };
  const messages = await connection.search(searchCriteria, fetchOptions);
  const ultimos = messages.slice(-limit);

  const correos = ultimos.map(msg => {
    const html = msg.attributes.struct ? obtenerContenido(msg.attributes.struct) : '';
    const bodyLimpio = limpiarHTML(html);
    return { body: bodyLimpio };
  });

  await connection.end();
  return correos;
}

// Extraer todos los oobCodes de un correo que contengan el emailUsuario
function extraerOobCodesPorUsuario(correo, emailUsuario) {
  if (!correo.body) return [];

  const regex = /https?:\/\/[^ ]*oobCode=([\w-]+)[^ ]*/g;
  const matches = [];
  let match;

  while ((match = regex.exec(correo.body)) !== null) {
    const url = match[0];
    const oobCode = match[1];
    // Filtrar por emailUsuario en la URL (ej: ejlopez_)
    if (url.toLowerCase().includes(emailUsuario.split('@')[0].toLowerCase())) {
      matches.push(oobCode);
    }
  }
  return matches;
}

// Obtener el último oobCode de un usuario
async function obtenerUltimoOobCodePorEmail(emailUsuario) {
  const correos = await leerUltimosCorreosEnviados(50);

  console.log('Últimos correos obtenidos (primeros 300 caracteres):');
  correos.forEach((c, i) => console.log(i, c.body.slice(0, 300)));

  const todosLosCodes = [];
  for (const correo of correos.reverse()) {
    const codes = extraerOobCodesPorUsuario(correo, emailUsuario);
    if (codes.length) todosLosCodes.push(...codes);
  }

  if (!todosLosCodes.length) {
    throw new Error(`No se encontraron oobCodes para ${emailUsuario}`);
  }

  const ultimoOobCode = todosLosCodes[0]; // el más reciente
  console.log(`OOB CODE FINAL PARA ${emailUsuario}:`, ultimoOobCode);
  return ultimoOobCode;
}

// Generar link completo
async function generarLinkFirebase(emailUsuario, apiKey) {
  const oobCode = await obtenerUltimoOobCodePorEmail(emailUsuario);
  return `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=${oobCode}&apiKey=${apiKey}&lang=es-419`;
}

module.exports = { obtenerUltimoOobCodePorEmail, generarLinkFirebase };
