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

// ======================================================
// CONFIGURACIÓN
// ======================================================
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

// ======================================================
// DIRECTORIO Y ARCHIVO JSON
// ======================================================
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "usuarios.json");

fs.ensureDirSync(DATA_DIR);
fs.ensureFileSync(DATA_PATH);

try {
  const contenido = fs.readJsonSync(DATA_PATH, { throws: false });
  if (!Array.isArray(contenido)) fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
} catch (err) {
  console.error("Error al inicializar usuarios.json:", err);
  fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
}

// ======================================================
// RUTAS
// ======================================================

// POST /registro
app.post("/registro", async (req, res) => {
  try {
    console.log("==> NUEVO REGISTRO DESDE APP:", req.body);

    const { uid, nombre, apellido, email } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ ok: false, mensaje: "Faltan parámetros obligatorios" });
    }

    let usuarios = await fs.readJson(DATA_PATH);
    let usuario = usuarios.find((u) => u.uid === uid || u.email === email);

    if (usuario) {
      return res.status(200).json({ ok: true, mensaje: "Usuario ya registrado", usuario });
    }

    usuario = { uid, nombre, apellido, email, oobCode: null, linkFirebase: null };
    usuarios.push(usuario);
    await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

    // Buscar oobCode en Gmail inmediatamente
    try {
      const oobCode = await obtenerUltimoOobCodePorEmail(email);
      const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";
      const linkFirebase = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}&apiKey=${API_KEY}&lang=es-419`;

      usuario.oobCode = oobCode;
      usuario.linkFirebase = linkFirebase;

      await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

      console.log(`==> OOB CODE OBTENIDO para ${email}:`, oobCode);
      console.log(`==> LINK FIREBASE GENERADO:`, linkFirebase);
    } catch (err) {
      console.error(`No se pudo obtener oobCode para ${email}:`, err.message);
    }

    return res.json({ ok: true, mensaje: "Usuario registrado correctamente", usuario });
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

// GET / (Página principal con link de verificación por UID)
app.get("/", async (req, res) => {
  try {
    const { uid } = req.query;
    if (!uid) return res.send("<p>Falta el parámetro uid en la URL</p>");

    const usuarios = await fs.readJson(DATA_PATH);
    let usuario = usuarios.find((u) => u.uid === uid);

    if (!usuario) return res.send("<p>Usuario no encontrado</p>");

    // Si no tiene oobCode todavía, intentamos obtenerlo
    if (!usuario.oobCode) {
      try {
        const oobCode = await obtenerUltimoOobCodePorEmail(usuario.email);
        const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";
        const linkFirebase = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=${encodeURIComponent(oobCode)}&apiKey=${API_KEY}&lang=es-419`;

        usuario.oobCode = oobCode;
        usuario.linkFirebase = linkFirebase;

        await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

        console.log(`==> OOB CODE OBTENIDO para ${usuario.email}:`, oobCode);
        console.log(`==> LINK FIREBASE GENERADO:`, linkFirebase);
      } catch (err) {
        console.error(`No se pudo obtener oobCode para ${usuario.email}:`, err.message);
      }
    }

    const linkSanitized = usuario.linkFirebase ? usuario.linkFirebase.replace(/"/g, "&quot;") : "#";

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
        <p><strong>Usuario:</strong><br>${usuario.nombre} ${usuario.apellido}<br>${usuario.email}</p>
        <button id="verificarBtn">Verificar correo</button>
        <div class="debug"><b>DEBUG LINK:</b><br>${linkSanitized}</div>
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
});
