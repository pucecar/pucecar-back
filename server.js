const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { obtenerUltimoOobCode } = require('./gmail');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // opcional

// Directorio y archivo de usuarios
const DATA_DIR = path.join(__dirname, 'data');
const DATA_PATH = path.join(DATA_DIR, 'usuarios.json');

fs.ensureDirSync(DATA_DIR);
fs.ensureFileSync(DATA_PATH);
if (!fs.readJsonSync(DATA_PATH, { throws: false })) {
  fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
}

// POST /registro
app.post('/registro', async (req, res) => {
  try {
    const { uid, nombre, apellido, email } = req.body;

    if (!uid || !email) return res.status(400).json({ ok: false, mensaje: 'Faltan parámetros obligatorios' });

    let usuarios = await fs.readJson(DATA_PATH);

    if (usuarios.find(u => u.uid === uid || u.email === email)) {
      return res.status(400).json({ ok: false, mensaje: 'Usuario ya registrado' });
    }

    const nuevoUsuario = { uid, nombre, apellido, email };
    usuarios.push(nuevoUsuario);
    await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

    return res.json({ ok: true, mensaje: 'Usuario registrado correctamente', usuario: nuevoUsuario });
  } catch (error) {
    console.error('Error en POST /registro:', error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
});

// GET /usuarios
app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    res.json({ ok: true, usuarios });
  } catch (error) {
    console.error('Error en GET /usuarios:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al leer los usuarios' });
  }
});

// Página principal con botón de verificación
app.get('/', async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    const ultimo = usuarios.length ? usuarios[usuarios.length - 1] : null;

    let linkFirebase = '#';
    if (ultimo) {
      const oobCode = await obtenerUltimoOobCode();
      if (oobCode) {
        const API_KEY = 'AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI'; 
        linkFirebase = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=${oobCode}&apiKey=${API_KEY}&lang=es-419`;
      }
    }

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
          text-align: center;
          font-family: Arial, sans-serif;
        }
        button {
          padding: 12px 24px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 16px;
        }
        p { font-size: 18px; }
        div { border: 1px solid #ccc; padding: 32px; border-radius: 8px; box-shadow: 0 0 12px rgba(0,0,0,0.1); }
      </style>
    </head>
    <body>
      <div>
        <h1>Verificación de correo</h1>
        ${ultimo ? `
          <p>Usuario: ${ultimo.nombre} ${ultimo.apellido} (${ultimo.email})</p>
          <button id="verificarBtn">Verificar correo</button>
          <script>
            const linkFirebase = "${linkFirebase}";
            document.getElementById("verificarBtn").addEventListener("click", () => {
              if(linkFirebase === "#") {
                alert("No se encontró el link de verificación aún.");
              } else {
                window.location.href = linkFirebase;
              }
            });
          </script>
        ` : '<p>No hay usuarios registrados aún.</p>'}
      </div>
    </body>
    </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error en GET /:', error);
    res.status(500).send('<p>Error al cargar la página</p>');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
