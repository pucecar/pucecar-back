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

// ======================================================
// ARCHIVO DE DATA (PERSISTENCIA)
// ======================================================
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "usuarios.json");

fs.ensureDirSync(DATA_DIR);
fs.ensureFileSync(DATA_PATH);

// Si el archivo está vacío o roto, inicializar correctamente.
let data = fs.readJsonSync(DATA_PATH, { throws: false }) || {};

if (!Array.isArray(data.usuarios)) data.usuarios = [];
if (!Array.isArray(data.colaLinks)) data.colaLinks = [];
if (!Array.isArray(data.colaUsuarios)) data.colaUsuarios = [];

fs.writeJsonSync(DATA_PATH, data, { spaces: 2 });

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function logEstadoColas() {
  console.log("\n===== ESTADO ACTUAL =====");
  console.log("COLA DE USUARIOS:");
  console.log(JSON.stringify(data.colaUsuarios, null, 2));
  console.log("COLA DE LINKS:");
  console.log(JSON.stringify(data.colaLinks, null, 2));
  console.log("==========================\n");
}

function guardarData() {
  fs.writeJsonSync(DATA_PATH, data, { spaces: 2 });
}

// ======================================================
// POST /registro
// ======================================================
app.post("/registro", async (req, res) => {
  try {
    const { uid, nombre, apellido, email } = req.body;
    if (!uid || !email)
      return res.status(400).json({ ok: false, mensaje: "Faltan parámetros obligatorios" });

    // Revisar si ya existe
    let usuario = data.usuarios.find(u => u.uid === uid || u.email === email);

    if (!usuario) {
      usuario = { uid, nombre, apellido, email, oobCode: null };
      data.usuarios.push(usuario);
      data.colaUsuarios.push({ uid, email });
    }

    guardarData();

    // Obtener oobCode desde Gmail/Firebase
    let oobCode = null;
    try {
      oobCode = await obtenerUltimoOobCodePorEmail(email);
    } catch (err) {
      console.error("ERROR AL OBTENER OOB CODE:", err.message);
    }

    if (oobCode) {
      usuario.oobCode = oobCode;

      const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";
      const link = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&` +
                   `oobCode=${encodeURIComponent(oobCode)}&apiKey=${API_KEY}&lang=es-419`;

      // Agregar a la cola de links
      data.colaLinks.push({
        email,
        oobCode,
        link
      });

      console.log("Nuevo link agregado a la cola:");
      console.log(link);
    }

    guardarData();
    logEstadoColas();

    return res.json({
      ok: true,
      mensaje: "Usuario registrado correctamente",
      usuario,
      linkFirebase: usuario.oobCode ? data.colaLinks.find(c => c.oobCode === usuario.oobCode)?.link : "#"
    });

  } catch (error) {
    console.error("Error en POST /registro:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
});

// ======================================================
// GET /usuarios
// ======================================================
app.get("/usuarios", (req, res) => {
  try {
    res.json({ ok: true, usuarios: data.usuarios });
  } catch (error) {
    console.error("Error en GET /usuarios:", error);
    res.status(500).json({ ok: false, mensaje: "Error al leer los usuarios" });
  }
});

// ======================================================
// GET / (Página principal)
// ENTREGA UN LINK ÚNICO DE LA COLA
// ======================================================
app.get("/", async (req, res) => {
  try {
    let linkAsignado = null;

    if (data.colaLinks.length > 0) {
      // FIFO
      const objeto = data.colaLinks.shift();
      linkAsignado = objeto.link;

      console.log("\n=== ENTREGA DE LINK ===");
      console.log("Link entregado:", linkAsignado);
      guardarData();
      logEstadoColas();
    }

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Verificación PUCECar</title>
        <style>
          body { display:flex;justify-content:center;align-items:center;height:100vh;background:#eef2f5;font-family:Arial }
          .card { background:white;padding:32px;width:380px;border-radius:16px;box-shadow:0 6px 20px rgba(0,0,0,0.15);text-align:center; }
          button { padding:12px 20px;font-size:16px;background:#0077ff;color:white;border-radius:8px;border:none;cursor:pointer;width:100%; }
          button:hover { background:#005fd1; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Verificación de correo</h1>
          ${
            linkAsignado
              ? `
                <button id="go">Verificar correo</button>
                <script>
                  document.getElementById("go").onclick = () => {
                    window.location.href = "${linkAsignado.replace(/"/g, "&quot;")}";
                  };
                </script>
              `
              : "<p>No hay links disponibles.</p>"
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
app.listen(PORT, (err) => {
  if (err) {
    console.error("Error al iniciar servidor:", err);
    process.exit(1);
  }
  console.log(`Servidor iniciado en puerto ${PORT}`);
  logEstadoColas();
});
