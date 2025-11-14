// gmail.js
const imaps = require('imap-simple');

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

// =======================
// LEER CORREOS SIN ARMAR NADA
// =======================
async function leerUltimosCorreosEnviados(limit = 10) {
  console.log("=== Conectando a Gmail para leer últimos correos enviados ===");
  const connection = await imaps.connect({ imap: config.imap });
  await connection.openBox('[Gmail]/Sent Mail');
  console.log("Bandeja [Gmail]/Sent Mail abierta correctamente");


  const searchCriteria = ['ALL'];
  const fetchOptions = { bodies: [''], struct: true };

  const messages = await connection.search(searchCriteria, fetchOptions);
  console.log(`Cantidad total de correos encontrados: ${messages.length}`);
  const ultimos = messages.slice(-limit);

  const correos = ultimos.map(msg => {

    // -------------------------
    // NO TOCAR EL TO
    // -------------------------
    let to = '';
    try {
      const headers = msg.parts.find(p => p.which === '')?.body;
      if (headers) {
        const m = headers.match(/To:\s*(.*)/i);
        if (m) to = m[1].trim();
      }
    } catch (_) {}

    // -------------------------
    // CONTENIDO EXACTO COMO LLEGA
    // -------------------------
    const structCompleta = msg.attributes.struct;
    const parts = msg.parts;
    const bodies = msg.parts.map(p => p.body);

    // -------------------------
    // EXTRAER LINK DE FIREBASE
    // -------------------------
    const firebaseURL = generarLinkFirebaseDesdeCuerpo(bodies);
    console.log("Correo procesado:");
    console.log("TO:", to);
    console.log("Link Firebase:", firebaseURL || "No encontrado");
    console.log("---------------------------");

    return {
      to,
      structCompleta,
      parts,
      bodies,
      firebaseURL
    };
  });

 // Después de construir el array 'correos'
  const vistos = new Set();
  const correosFiltrados = [];

  // Recorrer de más reciente a más antiguo
  for (let i = correos.length - 1; i >= 0; i--) {
    const correo = correos[i];
    if (!vistos.has(correo.to)) {
      correosFiltrados.push(correo);
      vistos.add(correo.to);
    }
  }

  // Invertir para mantener el orden original (opcional)
  correosFiltrados.reverse();
  console.log("=== Lectura de correos completada ===");

  await connection.end();
  return correosFiltrados;

}

// ============================
// EXTRAER LINK DE FIREBASE
// ============================
// ============================
// EXTRAER OOB CODE Y ARMAR LINK FIREBASE
// ============================
function generarLinkFirebaseDesdeCuerpo(bodies) {
  const oobCodeRegex = /oobCode=([A-Za-z0-9-_]+)/; // Buscar oobCode en el cuerpo
  const apiKey = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI"; // Tu API key de Firebase
  const projectUrl = "https://pucecar-ff3e3.firebaseapp.com"; // Tu proyecto Firebase
  let oobCodeEncontrado = null;

  // Buscar en cada parte del cuerpo del correo
  for (const body of bodies) {
    if (!body) continue;
    const match = body.match(oobCodeRegex);
    if (match && match[1]) {
      oobCodeEncontrado = match[1];
      break; // Si encontramos uno, no seguimos buscando
    }
  }

  if (!oobCodeEncontrado) return null;

  // Armar el link completo
  return `${projectUrl}/__/auth/action?mode=verifyEmail&oobCode=${oobCodeEncontrado}&apiKey=${apiKey}&lang=es-419`;
}


async function obtenerUltimoOobCodePorEmail(email) {
  console.log("=== Inicio obtenerUltimoOobCodePorEmail ===");
  console.log("Email a buscar:", email);

  const correos = await leerUltimosCorreosEnviados(50); // o más para asegurarte de cubrir todos los correos
  console.log(`Correos obtenidos: ${correos.length}`);

  // Buscar el último correo enviado a ese email
  const correo = correos.reverse().find(c => c.to.includes(email));
  console.log("Correo encontrado para el email:", correo);

  const firebaseURL = correo?.firebaseURL || null;
  console.log("OOB code/link encontrado:", firebaseURL);

  console.log("=== Fin obtenerUltimoOobCodePorEmail ===\n");
  return firebaseURL ? firebaseURL.match(/oobCode=([A-Za-z0-9-_]+)/)[1] : null;
}



module.exports = {
  leerUltimosCorreosEnviados,
  obtenerUltimoOobCodePorEmail,
  generarLinkFirebase
};
