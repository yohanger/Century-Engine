'use strict'
// Datos del jugador del juego exportado en disco: <datos del usuario>/<juego>/saves/<clave>.json
// Cada archivo lleva su versión ({ saveFormat, key, value }) y se escribe de forma atómica (archivo temporal + rename), así un corte
// a mitad de escritura nunca deja una partida a medias. Claves lógicas: 'language', 'graphics', 'input', 'audio', 'save/<ranura>'.
const fs = require('node:fs')
const path = require('node:path')

const SAVE_FORMAT = 1
const MAX_VALUE = 32 * 1024 * 1024 // 32 MB por clave
const file = (dir, key) => path.join(dir, encodeURIComponent(key) + '.json')
const validKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 200 && !k.includes('\0')

function createSaves(dir) {
  fs.mkdirSync(dir, { recursive: true })
  return {
    get(key) {
      if (!validKey(key)) return null
      try {
        const o = JSON.parse(fs.readFileSync(file(dir, key), 'utf8'))
        return o && o.saveFormat <= SAVE_FORMAT && typeof o.value === 'string' ? o.value : null
      } catch { return null }
    },
    set(key, value) {
      if (!validKey(key) || typeof value !== 'string' || value.length > MAX_VALUE) return false
      try {
        const f = file(dir, key), tmp = f + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify({ saveFormat: SAVE_FORMAT, key, value }))
        fs.renameSync(tmp, f)
        return true
      } catch { return false }
    },
    remove(key) { if (validKey(key)) try { fs.unlinkSync(file(dir, key)) } catch { /* no existía */ } return true },
    keys(prefix) {
      try {
        return fs.readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => { try { return decodeURIComponent(n.slice(0, -5)) } catch { return '' } }).filter((k) => k && k.startsWith(String(prefix)))
      } catch { return [] }
    },
  }
}
module.exports = { createSaves, SAVE_FORMAT }
