const imaps = require('imap-simple');
const { decode } = require('quoted-printable'); // opcional, para decoding

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

async function leerCorreosEnviados(limit = 10) {
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail');
  const messages = await connection.search(['ALL'], { bodies: ['HEADER', 'TEXT'], struct: true });
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

function extraerOobCodeDeCorreo(correo) {
  const body = correo.body || "";
  const match = body.match(/oobCode=([\w-]+)/);
  return match ? match[1] : null;
}

async function obtenerUltimoOobCode() {
  const correos = await leerCorreosEnviados(10); // llamar la función correcta
  for (const correo of correos) {
    const oobCode = extraerOobCodeDeCorreo(correo);
    if (oobCode) return oobCode;
  }
  return null;
}

module.exports = { obtenerUltimoOobCode };
