// server.js
// ======================================================
// MANEJO DE ERRORES GLOBALES PARA RENDER
// ======================================================
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

// ======================================================
// IMPORTACIONES
// ======================================================
// server.js optimizado
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");
const { obtenerUltimoOobCodePorEmail } = require("./gmail");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "usuarios.json");

fs.ensureDirSync(DATA_DIR);
fs.ensureFileSync(DATA_PATH);

// Inicializar archivo si está vacío o no es array
try {
  const contenido = fs.readJsonSync(DATA_PATH, { throws: false });
  if (!Array.isArray(contenido)) fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
} catch (err) {
  console.error("Error al inicializar usuarios.json:", err);
  fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
}

// POST /registro
app.post("/registro", async (req, res) => {
  try {
    const { uid, nombre, apellido, email } = req.body;
    if (!uid || !email) return res.status(400).json({ ok: false, mensaje: "Faltan parámetros obligatorios" });

    let usuarios = await fs.readJson(DATA_PATH);

    let usuario = usuarios.find(u => u.uid === uid || u.email === email);

    if (!usuario) {
      usuario = { uid, nombre, apellido, email, oobCode: null };
      usuarios.push(usuario);
    }

    // Guardar antes de obtener oobCode para evitar race conditions
    await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

    // Obtener último oobCode
    try {
      const oobCode = await obtenerUltimoOobCodePorEmail(email);
      if (oobCode) {
        const index = usuarios.findIndex(u => u.uid === usuario.uid);
        if (index >= 0) {
          usuarios[index].oobCode = oobCode;
          usuario.oobCode = oobCode;
          await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });
        }
      }
    } catch (err) {
      console.error(`No se pudo obtener oobCode para ${email}:`, err.message);
    }

    // Responder con usuario y link directo
    const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";
    const linkFirebase = usuario.oobCode
      ? `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&` +
        `oobCode=${encodeURIComponent(usuario.oobCode)}&apiKey=${API_KEY}&lang=es-419`
      : "#";

    return res.json({
      ok: true,
      mensaje: "Usuario registrado correctamente",
      usuario,
      linkFirebase
    });
  } catch (error) {
    console.error("Error en POST /registro:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
});

// GET /usuarios
app.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    res.json({ ok: true, usuarios });
  } catch (error) {
    console.error("Error en GET /usuarios:", error);
    res.status(500).json({ ok: false, mensaje: "Error al leer los usuarios" });
  }
});

app.get("/validar", async (req, res) => {
  const { oobCode } = req.query;
  if (!oobCode) return res.status(400).send("Código inválido");

  let usuarios = await fs.readJson(DATA_PATH);
  const usuarioIndex = usuarios.findIndex(u => u.oobCode === oobCode);
  if (usuarioIndex === -1) return res.status(400).send("Usuario no encontrado");

  usuarios[usuarioIndex].verificado = true;
  await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

  res.send("<p>Correo verificado correctamente. Puedes cerrar esta ventana.</p>");
});

// GET / (Página principal con link de verificación)
app.get("/", async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    const { email } = req.query;

    const usuario = email ? usuarios.find(u => u.email === email) : null;

    let linkFirebase = "#";
    if (usuario && usuario.oobCode) {
      const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";
      linkFirebase = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&` +
        `oobCode=${encodeURIComponent(usuario.oobCode)}&apiKey=${API_KEY}&lang=es-419`;
    }

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
                if (linkFirebase === "#") {
                  alert("No se encontró el link de verificación aún.");
                } else {
                  window.location.href = linkFirebase;
                }
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

app.listen(PORT, (err) => {
  if (err) {
    console.error("Error al iniciar servidor:", err);
    process.exit(1);
  }
  console.log(`Servidor iniciado en puerto ${PORT}`);
});

