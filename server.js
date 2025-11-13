const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const DATA_PATH = path.join(__dirname, 'data', 'usuarios.json');

// Crear archivo si no existe
fs.ensureFileSync(DATA_PATH);
fs.writeJsonSync(DATA_PATH, fs.readJsonSync(DATA_PATH, { throws: false }) || []);

// Endpoint para recibir datos desde la app
app.post('/registro', async (req, res) => {
  try {
    const { uid, nombre, apellido, email } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ ok: false, mensaje: 'Faltan parámetros obligatorios' });
    }

    // Leer datos existentes
    let usuarios = await fs.readJson(DATA_PATH);

    // Evitar duplicados
    if (usuarios.find(u => u.uid === uid)) {
      return res.status(400).json({ ok: false, mensaje: 'Usuario ya registrado' });
    }

    const nuevoUsuario = { uid, nombre, apellido, email };
    usuarios.push(nuevoUsuario);

    // Guardar JSON actualizado
    await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

    return res.json({ ok: true, mensaje: 'Usuario registrado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
});

// Endpoint para obtener todos los usuarios (para la página de validación)
app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await fs.readJson(DATA_PATH);
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, mensaje: 'Error al leer los usuarios' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
