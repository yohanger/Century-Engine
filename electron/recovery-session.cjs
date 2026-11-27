// Marca mínima de sesión: el contenido de los proyectos permanece en IndexedDB.
const fs = require('node:fs')
const path = require('node:path')

function createRecoverySession(file) {
  let previous = null
  try { previous = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { /* primer arranque */ }
  let interrupted = previous?.version === 1 && previous.active === true
  const write = (active) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const temp = file + '.tmp'
    fs.writeFileSync(temp, JSON.stringify({ version: 1, active, updatedAt: Date.now() }))
    fs.renameSync(temp, file)
  }
  // Si no se puede escribir el marcador no debe comunicarse falsamente que está protegido.
  write(true)
  return {
    get interrupted() { return interrupted },
    rendererCrashed() { interrupted = true },
    markClean() { write(false); interrupted = false },
  }
}
module.exports = { createRecoverySession }
