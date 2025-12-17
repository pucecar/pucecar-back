// server.js - VERSIÓN OPTIMIZADA
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
// CONFIGURACIÓN DE COLAS MEJORADA
// ======================================================
const DATA_PATH = path.join(__dirname, "data/usuarios.json");

// COLAS MEJORADAS CON ESTADOS
const colas = {
  pendientes: [],      // Usuarios esperando verificación
  procesando: [],     // Usuarios siendo procesados
  completados: []     // Usuarios ya verificados
};

// CACHE para evitar múltiples consultas a Gmail
const emailCache = new Map();

// ======================================================
// ENDPOINT /registro (OPTIMIZADO)
// ======================================================
app.post("/registro", async (req, res) => {
  try {
    const { uid, nombre, apellido, email } = req.body;
    
    if (!uid || !email) {
      return res.status(400).json({ 
        ok: false, 
        mensaje: "Faltan parámetros" 
      });
    }

    console.log(`📥 Registro recibido: ${email} (UID: ${uid})`);

    // 1. Guardar usuario en archivo
    let usuarios = await fs.readJson(DATA_PATH).catch(() => []);
    
    // Evitar duplicados
    const usuarioExistente = usuarios.find(u => u.uid === uid);
    if (usuarioExistente) {
      return res.json({
        estado: "en_cola",
        mensaje: "Usuario ya en cola de verificación",
        usuario: usuarioExistente
      });
    }

    const nuevoUsuario = { 
      uid, 
      nombre, 
      apellido, 
      email, 
      oobCode: null,
      timestamp: Date.now(),
      estado: "pendiente"
    };

    usuarios.push(nuevoUsuario);
    await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });

    // 2. Agregar a cola de pendientes (NO procesar inmediatamente)
    colas.pendientes.push(nuevoUsuario);
    console.log(`✅ Usuario agregado a cola. Pendientes: ${colas.pendientes.length}`);

    // 3. Respuesta inmediata (NO esperar por Gmail)
    res.json({
      estado: "en_cola",
      mensaje: "Usuario agregado a cola de verificación",
      usuario: nuevoUsuario,
      posicion: colas.pendientes.length
    });

    // 4. Procesar en segundo plano (si no hay muchos procesando)
    if (colas.procesando.length < 3) { // Máximo 3 simultáneos
      procesarCola();
    }

  } catch (error) {
    console.error("❌ Error en POST /registro:", error);
    res.status(500).json({ 
      ok: false, 
      mensaje: "Error interno del servidor" 
    });
  }
});

// ======================================================
// PROCESAR COLA EN SEGUNDO PLANO
// ======================================================
async function procesarCola() {
  // Evitar procesar múltiples veces
  if (colas.procesando.length >= 3) return;
  
  while (colas.pendientes.length > 0 && colas.procesando.length < 3) {
    const usuario = colas.pendientes.shift();
    colas.procesando.push(usuario);
    
    console.log(`🔄 Procesando: ${usuario.email}`);
    
    // Procesar en segundo plano
    procesarUsuarioAsync(usuario);
  }
}

async function procesarUsuarioAsync(usuario) {
  try {
    // 1. Revisar cache primero
    let oobCode = emailCache.get(usuario.email);
    
    if (!oobCode) {
      console.log(`📧 Buscando oobCode para: ${usuario.email}`);
      
      // Intentar máximo 3 veces con delays
      for (let intento = 1; intento <= 3; intento++) {
        try {
          oobCode = await obtenerUltimoOobCodePorEmail(usuario.email);
          if (oobCode) {
            emailCache.set(usuario.email, oobCode);
            console.log(`✅ oobCode encontrado (intento ${intento})`);
            break;
          }
          
          // Esperar antes del siguiente intento
          if (intento < 3) {
            await new Promise(resolve => setTimeout(resolve, 5000 * intento));
          }
        } catch (err) {
          console.log(`⚠️ Intento ${intento} fallado:`, err.message);
        }
      }
    }

    // 2. Actualizar usuario si se encontró oobCode
    if (oobCode) {
      usuario.oobCode = oobCode;
      usuario.estado = "listo";
      usuario.timestampProcesado = Date.now();
      
      // Actualizar archivo
      const usuarios = await fs.readJson(DATA_PATH);
      const index = usuarios.findIndex(u => u.uid === usuario.uid);
      if (index >= 0) {
        usuarios[index] = usuario;
        await fs.writeJson(DATA_PATH, usuarios, { spaces: 2 });
      }
      
      console.log(`🎯 Usuario listo para verificación: ${usuario.email}`);
    } else {
      usuario.estado = "error";
      console.log(`❌ No se pudo encontrar oobCode para: ${usuario.email}`);
    }

  } catch (error) {
    console.error(`💥 Error procesando usuario ${usuario.email}:`, error);
    usuario.estado = "error";
  } finally {
    // Mover a completados
    const index = colas.procesando.findIndex(u => u.uid === usuario.uid);
    if (index >= 0) {
      colas.procesando.splice(index, 1);
    }
    
    colas.completados.push(usuario);
    
    // Procesar siguiente en cola
    procesarCola();
  }
}

// ======================================================
// ENDPOINT PARA VER ESTADO DE COLAS
// ======================================================
app.get("/estado", (req, res) => {
  res.json({
    ok: true,
    estadisticas: {
      pendientes: colas.pendientes.length,
      procesando: colas.procesando.length,
      completados: colas.completados.length,
      cacheSize: emailCache.size
    },
    pendientes: colas.pendientes.slice(0, 10),
    procesando: colas.procesando,
    completados: colas.completados.slice(-10)
  });
});

// ======================================================
// ENDPOINT PRINCIPAL (optimizado)
// ======================================================
app.get("/", async (req, res) => {
  try {
    // Buscar usuario LISTO para verificación (no pendiente)
    const usuarioListo = colas.completados.find(u => u.estado === "listo");
    
    let linkFirebase = "#";
    let usuarioMostrar = null;

    if (usuarioListo) {
      usuarioMostrar = usuarioListo;
      const API_KEY = "AIzaSyDTEcMQgFHR9KwZGbi0RaN_XBwnDDs7ikI";
      linkFirebase = `https://pucecar-ff3e3.firebaseapp.com/__/auth/action?` +
        `mode=verifyEmail&oobCode=${encodeURIComponent(usuarioListo.oobCode)}` +
        `&apiKey=${API_KEY}&lang=es-419`;
      
      // Remover de completados para evitar reusar
      const index = colas.completados.findIndex(u => u.uid === usuarioListo.uid);
      if (index >= 0) colas.completados.splice(index, 1);
    }

    const html = generarHTML(usuarioMostrar, linkFirebase);
    res.send(html);

  } catch (error) {
    console.error("Error en GET /:", error);
    res.status(500).send(generarHTML(null, "#"));
  }
});

// ======================================================
// FUNCIÓN PARA GENERAR HTML
// ======================================================
function generarHTML(usuario, linkFirebase) {
  const linkSanitized = linkFirebase.replace(/"/g, '&quot;');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Verificación PUCECar</title>
      <style>
        body { font-family: Arial; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100vh; display: flex; justify-content: center; align-items: center; margin: 0; }
        .container { background: rgba(255,255,255,0.95); padding: 40px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; width: 90%; text-align: center; }
        h1 { color: #333; margin-bottom: 20px; }
        .info { background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 20px 0; }
        .btn { background: #4CAF50; color: white; border: none; padding: 15px 30px; font-size: 18px; border-radius: 10px; cursor: pointer; transition: 0.3s; }
        .btn:hover { background: #45a049; }
        .debug { font-size: 12px; color: #666; margin-top: 20px; background: #f0f0f0; padding: 10px; border-radius: 5px; word-break: break-all; }
        .stats { font-size: 14px; color: #666; margin-top: 20px; padding: 10px; background: #e8f4fd; border-radius: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Verificación de Email - PUCECar</h1>
        
        ${usuario ? `
          <div class="info">
            <p><strong>Estado:</strong> <span style="color: green;">✓ Listo para verificar</span></p>
          </div>
          
          <button class="btn" onclick="window.location.href='${linkSanitized}'">
            Verificar Correo Electrónico
          </button>
          
          <div class="debug">
            <strong>Enlace de verificación:</strong><br>
            <small>${linkSanitized}</small>
          </div>
        ` : `
          <button class="btn" onclick="location.reload()">
            Recargar Página
          </button>
        `}
          
        
        <p style="margin-top: 20px; font-size: 12px; color: #888;">
          Gracias por elegir a PUCECAR
        </p>
        
        <script>
          // Auto-reload cada 30 segundos
          setTimeout(() => location.reload(), 30000);
          
          // Mostrar link en consola para debugging
          console.log("Link de verificación:", "${linkSanitized}");
        </script>
      </div>
    </body>
    </html>
  `;
}

// ======================================================
// LIMPIAR CACHE PERIÓDICAMENTE (cada hora)
// ======================================================
setInterval(() => {
  console.log("🧹 Limpiando cache de emails...");
  emailCache.clear();
}, 60 * 60 * 1000);

// ======================================================
// INICIAR SERVIDOR
// ======================================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor optimizado iniciado en puerto ${PORT}`);
  console.log(`📊 Configuración: Máx 3 usuarios simultáneos`);
  console.log(`💾 Cache activado para emails`);
});
