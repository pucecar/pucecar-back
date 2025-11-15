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
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// RUTAS A ARCHIVOS
const USERS_PATH = path.join(__dirname, "usuarios.json");
const LINKS_PATH = path.join(__dirname, "colaLinks.json");

// CARGAR ARCHIVOS (si no existen, crearlos)
function loadJSON(file, empty) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(empty));
  return JSON.parse(fs.readFileSync(file));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// CARGAR COLAS
let usuariosCola = loadJSON(USERS_PATH, []);
let linksCola = loadJSON(LINKS_PATH, []);

// LOGS ACTUALES
function mostrarColas() {
  console.log("===== ESTADO ACTUAL =====");
  console.log("COLA DE USUARIOS:");
  console.log(usuariosCola);
  console.log("COLA DE LINKS:");
  console.log(linksCola);
  console.log("==========================");
}

// ==================================================
//  ENDPOINT /registro  (EL QUE FALLABA) 🔥
// ==================================================
app.post("/registro", async (req, res) => {
  try {
    const usuario = req.body;

    // GUARDAR USUARIO EN COLA
    usuariosCola.push(usuario);
    saveJSON(USERS_PATH, usuariosCola);

    console.log("Nuevo usuario recibido");
    mostrarColas();

    // 👇 ESTA ES LA RESPUESTA EXACTA QUE USABA TU SERVER VIEJO
    return res.status(200).json({
      estado: "ok",
      mensaje: "Usuario registrado correctamente",
      datos: usuario
    });

  } catch (error) {
    console.error("Error en /registro:", error);

    return res.status(500).json({
      estado: "error",
      mensaje: "No se pudo procesar el registro"
    });
  }
});

// ==================================================
//  ENDPOINT /validar PARA ENTREGAR LINK UNICO
// ==================================================
app.get("/validar", (req, res) => {
  try {
    if (linksCola.length === 0) {
      return res.status(404).json({
        estado: "error",
        mensaje: "No hay links disponibles"
      });
    }

    const link = linksCola.shift();
    saveJSON(LINKS_PATH, linksCola);

    mostrarColas();

    return res.json({
      estado: "ok",
      link
    });

  } catch (error) {
    console.error("Error en /validar:", error);
    return res.status(500).json({
      estado: "error",
      mensaje: "Fallo interno"
    });
  }
});

// ==================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Servidor iniciado en puerto " + PORT);
  mostrarColas();
});

