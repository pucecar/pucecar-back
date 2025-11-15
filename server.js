// server.js
// ======================================================
// MANEJO DE ERRORES GLOBALES
// ======================================================
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));

// ======================================================
// IMPORTACIONES
// ======================================================
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");
const { obtenerUltimoOobCodePorEmail } = require("./gmail");

// ======================================================
// CONFIGURACIÓN
// ======================================================
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

// ======================================================
// ARCHIVO JSON EN DISCO
// ======================================================
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "usuarios.json");

fs.ensureDirSync(DATA_DIR);
fs.ensureFileSync(DATA_PATH);

try {
  const contenido = fs.readJsonSync(DATA_PATH, { throws: false });
  if (!Array.isArray(contenido)) fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
} catch {
  fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
}

// ======================================================
// COLAS EN MEMORIA
// ======================================================
const colaUsuarios = []; // usuarios registrados pendientes
const colaLinks = [];    // links generados pendientes

// ======================================================
// ENDPOINT /registro
// ======================================================
// POST /registro
app.post("/registro", async (req, res) => {
  try {
    const { uid, nombre, apellido, email } = req.body;
    if (!uid || !email) return res.status(400).json({ ok: false, mensaje: "Faltan parámetros" });

    let usuarios = await fs.readJson(DATA_PATH);

    let usuario = usuarios.find(u => u.uid === uid || u.email === email);
    if (!usuario) {
      usuario = { uid, nombre, apellido, email, oobCode: null };
      usuarios.push(usuario);
      await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });
    }

    // Agregar a colaUsuarios
    if (!colaUsuarios.find(u => u.uid === uid)) colaUsuarios.push(usuario);
    console.log("🟢 Cola Usuarios:", colaUsuarios.map(u => u.email));

    // Obtener oobCode y generar link
    try {
      const oobCode = await obtenerUltimoOobCodePorEmail(email);
      if (oobCode) {
        usuario.oobCode = oobCode;
        const index = usuarios.findIndex(u => u.uid === uid);
        if (index >= 0) usuarios[index].oobCode = oobCode;
        await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

        const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";
        const linkFirebase = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}&apiKey=${API_KEY}&lang=es-419`;

        // Guardar en colaLinks
        if (!colaLinks.includes(linkFirebase)) colaLinks.push(linkFirebase);
        console.log("🔵 Cola Links:", colaLinks);
      }
    } catch (err) {
      console.error("⚠️ No se pudo obtener oobCode:", err.message);
    }

    // RESPUESTA FINAL: importante que espere oobCode
    res.json({ ok: true, mensaje: "Usuario registrado correctamente", usuario });

  } catch (error) {
    console.error("Error en POST /registro:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
});

// ======================================================
// ENDPOINT /usuarios (ver todos los usuarios y cola)
// ======================================================
app.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    res.json({ ok: true, usuarios, colaUsuarios });
  } catch (error) {
    console.error("Error en GET /usuarios:", error);
    res.status(500).json({ ok: false, mensaje: "Error al leer los usuarios" });
  }
});

// ======================================================
// ENDPOINT /links (ver la cola de links)
// ======================================================
app.get("/links", (req, res) => {
  res.json({ ok: true, colaLinks });
});

// ======================================================
// PÁGINA PRINCIPAL: muestra link de Firebase
// ======================================================
// Colas en memoria
const colaUsuarios = [];
const colaLinks = [];

app.get("/", async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    const { uid, email } = req.query;

    // Buscar usuario primero en la cola, si no está, buscar en JSON
    let usuario = colaUsuarios.find(u => (uid ? u.uid === uid : email ? u.email === email : false));
    if (!usuario) {
      usuario = uid
        ? usuarios.find(u => u.uid === uid)
        : email
        ? usuarios.find(u => u.email === email)
        : null;
    }

    let linkFirebase = "#";
    if (usuario && usuario.oobCode) {
      const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";
      // Buscar link en la cola de links si existe
      const linkEnCola = colaLinks.find(l => l.includes(usuario.oobCode));
      linkFirebase = linkEnCola || 
        `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&` +
        `oobCode=${encodeURIComponent(usuario.oobCode)}&apiKey=${API_KEY}&lang=es-419`;
      
      // Si no estaba en la cola, agregarlo
      if (!colaLinks.includes(linkFirebase)) colaLinks.push(linkFirebase);
    }

    // Log en consola de las colas
    console.log("🟢 Cola Usuarios:", colaUsuarios.map(u => u.email));
    console.log("🔵 Cola Links:", colaLinks);

    const linkSanitized = linkFirebase.replace(/"/g, "&quot;");

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Verificación PUCECar</title>
        <style>
          body { display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif; background: #eef2f5; }
          .card { background: white; padding: 32px; width: 380px; border-radius: 16px; box-shadow: 0 6px 20px rgba(0,0,0,0.15); text-align: center; }
          button { padding: 12px 20px; font-size: 16px; background: #0077ff; color: white; border-radius: 8px; border: none; cursor: pointer; width: 100%; }
          button:hover { background: #005fd1; }
          h1 { margin-bottom: 12px; }
          p { font-size: 17px; }
          .debug { font-size: 12px; margin-top: 20px; color: #777; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Verificación de correo</h1>
          ${
            usuario
              ? `
            <p><strong>Usuario:</strong><br>${usuario.nombre} ${usuario.apellido}<br>${usuario.email}</p>
            <button id="verificarBtn">Verificar correo</button>
            <div class="debug">
              <b>DEBUG LINK:</b><br>${linkSanitized}
            </div>
            <script>
              const linkFirebase = "${linkSanitized}";
              document.getElementById("verificarBtn").addEventListener("click", () => {
                if (linkFirebase === "#") alert("No se encontró el link de verificación aún.");
                else window.location.href = linkFirebase;
              });
            </script>
          `
              : "<p>No se encontró usuario.</p>"
          }
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error("Error en GET /:", error);
    res.status(500).send("<p>Error al cargar la página</p>");
  }
});

// ======================================================
// INICIAR SERVIDOR
// ======================================================
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));
