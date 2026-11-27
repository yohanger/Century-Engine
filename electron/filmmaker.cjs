// Entrada de la app de escritorio Nether Film Maker (AppImage propia): el mismo proceso principal que Century, abriendo
// directamente la ventana de rodaje.
if (!process.argv.includes('--filmmaker')) process.argv.push('--filmmaker')
require('./main.cjs')
