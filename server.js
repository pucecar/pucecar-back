// server.js
// ======================================================
// IMPORTACIONES Y CONFIG
// ======================================================
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));

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
// ARCHIVO PERSISTENTE
// ======================================================
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "usuarios.json");

fs.ensureDirSync(DATA_DIR);
fs.ensureFileSync(DATA_PATH);

let data = fs.readJsonSync(DATA_PATH, { throws: false }) || {};

if (!Array.isArray(data.usuarios)) data.usuarios = [];
if (!Array.isArray(data.colaUsuarios)) data.colaUsuarios = [];
if (!Array.isArray(data.colaLinks)) data.colaLinks = [];

fs.writeJsonSync(DATA_PATH, data, { spaces: 2 });

function guardar() {
  fs.writeJsonSync(DATA_PATH, data, { spaces: 2 });
}

function logColas() {
  console.log("\n===== ESTADO ACTUAL =====");
  console.log("COLA DE USUARIOS:", JSON.stringify(data.colaUsuarios, null, 2));
  console.log("COLA DE LINKS:", JSON.stringify(data.colaLinks, null, 2));
  console.log("==========================\n");
}

// ======================================================
// POST /registro
// ======================================================
app.post("/registro", async (req, res) => {
  console.log("\n=== NUEVO REGISTRO RECIBIDO ===");
  console.log(req.body);

  try {
    const { uid, nombre, apellido, email } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ ok: false, mensaje: "Faltan parámetros obligatorios" });
    }

    // Buscar si ya existe
    let usuario = data.usuarios.find(u => u.email === email);

    // Si NO existe => CREAR
    if (!usuario) {
      usuario = { uid, nombre, apellido, email, oobCode: null };
      data.usuarios.push(usuario);

      data.colaUsuarios.push({ uid, email });

      console.log("Usuario agregado a colaUsuarios.");
    }

    guardar();
    logColas();

    // ------------------------------------------------------------------
    // RESPUESTA INMEDIATA A TU APP (COMO ANTES)
    // ------------------------------------------------------------------
    // RESPUESTA INMEDIATA A TU APP (IGUAL AL SERVER ANTERIOR)
      res.json({
        ok: true,
        mensaje: "Usuario registrado correctamente",
        usuario
      });

    // ------------------------------------------------------------------
    // PROCESO ASÍNCRONO (NO BLOQUEA RESPUESTA)
    // ------------------------------------------------------------------
    try {
      const oobCode = await obtenerUltimoOobCodePorEmail(email);

      if (oobCode) {
        usuario.oobCode = oobCode;

        const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";
        const link = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&` +
                     `oobCode=${encodeURIComponent(oobCode)}&apiKey=${API_KEY}&lang=es-419`;

        data.colaLinks.push({ email, oobCode, link });

        console.log("Nuevo link agregado a la cola:", link);
      }

      guardar();
      logColas();

    } catch (err) {
      console.error("ERROR OBTENIENDO OOB CODE:", err.message);
    }

  } catch (error) {
    console.error("ERROR en /registro:", error);
    return res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
});

// ======================================================
// GET /
// ======================================================
app.get("/", (req, res) => {
  let link = null;

  if (data.colaLinks.length > 0) {
    const obj = data.colaLinks.shift();
    link = obj.link;
    guardar();
    console.log("Link entregado:", link);
  }

  const html = `
    <!DOCTYPE html><html><body style="font-family:Arial;text-align:center;padding:50px;">
      <h1>Verificación PUCECar</h1>
      ${
        link
          ? `<a href="${link}"><button>Verificar correo</button></a>`
          : `<p>No hay links disponibles.</p>`
      }
    </body></html>
  `;

  res.send(html);
});

// ======================================================
// GET /usuarios
// ======================================================
app.get("/usuarios", (req, res) => {
  res.json({ ok: true, usuarios: data.usuarios });
});

// ======================================================
// INICIO
// ======================================================
app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
  logColas();
});

