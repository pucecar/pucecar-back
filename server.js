const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Directorio y archivo para almacenar usuarios
const DATA_DIR = path.join(__dirname, 'data');
const DATA_PATH = path.join(DATA_DIR, 'usuarios.json');

// Crear carpeta y archivo si no existen
fs.ensureDirSync(DATA_DIR);
fs.ensureFileSync(DATA_PATH);
if (!fs.readJsonSync(DATA_PATH, { throws: false })) {
  fs.writeJsonSync(DATA_PATH, [], { spaces: 2 });
}

// ----------------------------
// Endpoint POST /registro
// Recibe datos desde la app y los guarda
// ----------------------------
app.post('/registro', async (req, res) => {
  try {
    const { uid, nombre, apellido, email } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ ok: false, mensaje: 'Faltan parámetros obligatorios' });
    }

    let usuarios = await fs.readJson(DATA_PATH);

    // Evitar duplicados por UID o email
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

// ----------------------------
// Endpoint GET /usuarios
// Devuelve todos los usuarios
// ----------------------------
app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    res.json({ ok: true, usuarios });
  } catch (error) {
    console.error('Error en GET /usuarios:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al leer los usuarios' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
