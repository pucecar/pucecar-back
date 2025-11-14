// test-gmail.js
const gmail = require('./gmail');

(async () => {
  try {
    console.log('Leyendo últimos correos enviados...');
    const correos = await gmail.leerUltimosCorreosEnviados(20);

    if (correos.length === 0) {
      console.log('No se encontraron correos.');
      return;
    }

    correos.forEach((correo, index) => {
      console.log(`Correo #${index + 1}`);
      console.log('TO:', correo.to);
      console.log('Link Firebase:', correo.firebaseURL || 'No encontrado');
      console.log('---------------------------');
    });
  } catch (err) {
    console.error('Error al leer correos:', err);
  }
})();
