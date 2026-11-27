// Sincroniza los scripts del proyecto con archivos reales en la carpeta del proyecto (Assets/Scripts/*.js) para editarlos en VS Code.
// Cada segundo compara tres versiones (proyecto · disco · última sincronizada) con plan.js y aplica lo que corresponde.
// No conoce Vue ni el store: todo lo que toca el proyecto entra por `apply` (lo implementa store.js).
import { planSync, scriptPath, isScriptFile } from './plan.js'
import { FOLDER } from './files.js'

export const MANIFEST = `${FOLDER}/sync.json`
const dec = new TextDecoder()

/**
 * @param {object} d
 * @param {object} d.disk     módulo core/disk.js (scanFiles · readFile · writeFiles)
 * @param {() => object|null} d.getLoc       ubicación de la carpeta del proyecto
 * @param {() => object[]|null} d.getScripts scripts del proyecto: [{ id, name, folder, code }]
 * @param {{ updateScript:Function, importScript:Function, deleteScript:Function }} d.apply  cambios en el proyecto
 * @param {(msg:string, kind?:string) => void} [d.notify]
 */
export function createScriptSync({ disk, getLoc, getScripts, apply, notify = () => {}, interval = 1000 }) {
  let man = new Map(), manJson = '{}'
  const known = new Map()   // ruta → { mtime, size, text }: lo último leído del disco
  const pending = new Map() // ruta → { mtime, size }: cambió hace un instante; se espera a que se quede quieto
  let timer = 0, busy = false, on = false, loc = null, generation = 0
  const status = { on: false, lastError: '', passes: 0 }

  const readText = async (loc, path) => { const b = await disk.readFile(loc, path); return b ? dec.decode(b).replace(/^﻿/, '') : null }

  async function loadManifest(loc) {
    try {
      const b = await disk.readFile(loc, MANIFEST)
      if (b) { const o = JSON.parse(dec.decode(b)); if (o?.files && typeof o.files === 'object') return new Map(Object.entries(o.files)) }
    } catch { /* manifiesto ilegible: se reconstruye */ }
    return new Map()
  }

  async function reconcile({ force = false } = {}) {
    if (busy || !on) return
    const target = loc, pass = generation
    const current = () => generation === pass && target === getLoc() && getScripts() !== null
    if (!target || !current()) return
    busy = true
    try {
      const files = await disk.scanFiles(target, 'Assets', '.js')
      if (!current()) return
      const diskMap = new Map(), skip = new Set()
      for (const f of files) {
        if (!isScriptFile(f.path)) continue
        const k = known.get(f.path)
        if (!force && k && k.mtime === f.mtime && k.size === f.size) { diskMap.set(f.path, k.text); pending.delete(f.path); continue }
        const w = pending.get(f.path)
        if (force || (w && w.mtime === f.mtime && w.size === f.size)) { // estable (o arranque): se lee y se actúa
          const text = await readText(target, f.path)
          if (!current()) return
          if (force && text === null) throw new Error('No se pudo leer ' + f.path)
          if (text === null) { skip.add(f.path); continue }
          known.set(f.path, { mtime: f.mtime, size: f.size, text }); pending.delete(f.path); diskMap.set(f.path, text)
        } else { // acaba de cambiar: VS Code puede estar a mitad de escribirlo. Se mira otra vez en la siguiente pasada
          pending.set(f.path, { mtime: f.mtime, size: f.size })
          skip.add(f.path) // ni el disco ni el proyecto se tocan en esta ruta: si no, se pisaría lo que VS Code está escribiendo
        }
      }
      for (const path of [...known.keys()]) if (!files.some((f) => f.path === path)) { known.delete(path); pending.delete(path) }
      const proj = new Map(getScripts().map((s) => [scriptPath(s), s.code ?? '']))
      // lo que está a medias no se toca esta pasada
      const manIn = new Map(man)
      for (const path of skip) { proj.delete(path); manIn.delete(path) }
      const { acts, man: next } = planSync(proj, diskMap, manIn)
      for (const path of skip) if (man.has(path)) next.set(path, man.get(path))

      const write = new Map(), remove = []
      const notes = []
      for (const a of acts) {
        if (a.op === 'writeDisk') write.set(a.path, a.code)
        else if (a.op === 'deleteDisk') remove.push(a.path)
        else if (a.op === 'updateScript') { apply.updateScript(a.path, a.code); notes.push(a.note ? `${a.path}: ${a.note}` : null) }
        else if (a.op === 'importScript') { apply.importScript(a.path, a.code); notes.push(null) }
        else if (a.op === 'deleteScript') { apply.deleteScript(a.path); notes.push(null) }
      }
      if (write.size || remove.length) {
        await disk.writeFiles(target, write, { remove })
        if (!current()) return
        // lo que acabamos de escribir ya es «lo conocido»: si no, la pasada siguiente lo tomaría por un cambio de VS Code
        const after = await disk.scanFiles(target, 'Assets', '.js')
        if (!current()) return
        for (const [path, code] of write) { const f = after.find((x) => x.path === path); if (f) known.set(path, { mtime: f.mtime, size: f.size, text: code }); pending.delete(path) }
        for (const path of remove) { known.delete(path); pending.delete(path) }
      }
      // lo que se cambió en el proyecto desde VS Code también queda conocido (el disco ya tenía ese texto)
      const json = JSON.stringify({ version: 1, files: Object.fromEntries([...next].sort()) }, null, 1)
      if (json !== manJson) {
        await disk.writeFiles(target, new Map([[MANIFEST, json]]))
        if (!current()) return
        manJson = json
      }
      man = next
      for (const n of notes) if (n) notify(n, 'info')
      status.passes++
      status.lastError = ''
      return acts
    } catch (err) {
      if (current()) status.lastError = String(err?.message || err)
      console.error('Sincronización de scripts:', err)
    } finally { busy = false }
  }

  const waitForPass = async () => {
    while (busy) await new Promise(resolve => setTimeout(resolve, 20))
  }
  const loop = (pass) => {
    timer = setTimeout(async () => {
      if (pass !== generation) return
      await reconcile()
      if (pass === generation) loop(pass)
    }, interval)
  }

  return {
    status,
    /** Empieza a sincronizar con la carpeta `l`: primera pasada inmediata (sin esperas) y después cada `interval` ms. */
    async start(l) {
      this.stop()
      const pass = generation
      await waitForPass()
      if (pass !== generation || l !== getLoc()) return
      const manifest = await loadManifest(l)
      if (pass !== generation || l !== getLoc()) return
      loc = l; on = true; status.on = true
      man = manifest; manJson = '{}'
      known.clear(); pending.clear()
      await reconcile({ force: true })
      if (pass === generation) loop(pass)
    },
    stop() { generation++; on = false; status.on = false; clearTimeout(timer); loc = null; known.clear(); pending.clear() },
    /** Una pasada ya (al guardar, al cerrar). `force`: no esperar a que los archivos cambiados se queden quietos. */
    async flush({ force = false } = {}) {
      if (!on) return
      const pass = generation
      while (busy) await waitForPass()
      if (pass === generation) return reconcile({ force })
    },
    get active() { return on },
  }
}
