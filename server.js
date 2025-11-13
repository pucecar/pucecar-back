// ======================================================
// MANEJO DE ERRORES GLOBALES PARA RENDER
// ======================================================
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

// ======================================================
// IMPORTACIONES
// ======================================================
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs-extra");
const path = require("path");
const { obtenerUltimoOobCode } = require("./gmail");

// ======================================================
// CONFIGURACIÓN
// ======================================================
const app = express();

// Render OBLIGA a usar solo process.env.PORT
const PORT = process.env.PORT;

app.use(cors());
app.use(bodyParser.json());

// ======================================================
// DIRECTORIO Y ARCHIVO JSON
// ======================================================
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "usuarios.json");

fs.ensureDirSync(DATA_DIR);
fs.ensureFileSync(DATA_PATH);

// Si el archivo está vacío, inicialízalo correctamente
try {
  const contenido = fs.readJsonSync(DATA_PATH, { throws: false });
  if (!Array.isArray(contenido)) {
    fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
  }
} catch {
  fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
}

// ======================================================
// POST /registro
// ======================================================
app.post("/registro", async (req, res) => {
  try {
    const { uid, nombre, apellido, email } = req.body;

    if (!uid || !email) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "Faltan parámetros obligatorios" });
    }

    let usuarios = await fs.readJson(DATA_PATH);

    if (usuarios.find((u) => u.uid === uid || u.email === email)) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "Usuario ya registrado" });
    }

    const nuevoUsuario = { uid, nombre, apellido, email };
    usuarios.push(nuevoUsuario);
    await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

    return res.json({
      ok: true,
      mensaje: "Usuario registrado correctamente",
      usuario: nuevoUsuario,
    });
  } catch (error) {
    console.error("Error en POST /registro:", error);
    res
      .status(500)
      .json({ ok: false, mensaje: "Error interno del servidor" });
  }
});

// ======================================================
// GET /usuarios
// ======================================================
app.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    res.json({ ok: true, usuarios });
  } catch (error) {
    console.error("Error en GET /usuarios:", error);
    res.status(500).json({ ok: false, mensaje: "Error al leer los usuarios" });
  }
});

// ======================================================
// PÁGINA PRINCIPAL CON LINK DE VERIFICACIÓN
// ======================================================
app.get("/", async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    const ultimo = usuarios.length ? usuarios[usuarios.length - 1] : null;

    let linkFirebase = "#";

    if (ultimo) {
      const oobCode = await obtenerUltimoOobCode();

      console.log("OOB CODE OBTENIDO:", oobCode);

      if (oobCode) {
        const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";

        linkFirebase =
          `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail` +
          `&oobCode=${encodeURIComponent(oobCode)}` +
          `&apiKey=${API_KEY}` +
          `&lang=es-419`;
      }
    }

    console.log("LINK FINAL GENERADO:", linkFirebase);

    // Evitar romper HTML al meter el link
    const linkSanitized = linkFirebase.replace(/"/g, "&quot;");

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Verificación PUCECar</title>

      <style>
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-family: Arial, sans-serif;
          background: #eef2f5;
        }
        .card {
          background: white;
          padding: 32px;
          width: 380px;
          border-radius: 16px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
          text-align: center;
        }
        button {
          padding: 12px 20px;
          font-size: 16px;
          background: #0077ff;
          color: white;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          width: 100%;
        }
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
          ultimo
            ? `
          <p><strong>Usuario:</strong><br>${ultimo.nombre} ${ultimo.apellido}<br>${ultimo.email}</p>
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
            : "<p>No hay usuarios registrados aún.</p>"
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
app.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
