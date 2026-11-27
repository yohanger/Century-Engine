// Sincronización de scripts entre el proyecto (dentro del .lfproj) y la carpeta del proyecto en disco, donde VS Code los edita.
// Este archivo es la LÓGICA pura (sin DOM, sin Vue): decide qué hacer; sync.js lo ejecuta. Se prueba en «prueba retirada».
//
// Tres versiones de cada script: P = la del proyecto (lo que ve el editor), D = la del disco (lo que ve VS Code) y M = el hash de
// lo último que se dejó igual en las dos (el «manifiesto», .levelforge/sync.json). Comparando las tres se sabe quién cambió algo:
//
//   P y D existen  · iguales                         → nada (el manifiesto se pone al día)
//                  · solo D cambió respecto a M      → edición en VS Code: el proyecto toma D
//                  · solo P cambió respecto a M      → edición en Century: el disco toma P
//                  · ambos cambiaron                 → gana VS Code (se avisa)
//   solo P existe  · sin M                           → script nuevo en Century: se escribe en disco
//                  · con M                           → se borró en VS Code: se quita del proyecto
//   solo D existe  · sin M                           → archivo nuevo en VS Code: se importa como script
//                  · con M y D = M                   → se borró en Century: se borra del disco
//                  · con M y D ≠ M                   → lo borraron en Century pero lo editaron en VS Code: se conserva (se importa)
//   ninguno        · solo queda M                    → se limpia

/** Hash corto y estable de un texto (FNV-1a de 32 bits + longitud). */
export function hashText(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0') + ':' + s.length.toString(16)
}

/**
 * @param {Map<string,string>} proj  ruta → código del proyecto
 * @param {Map<string,string>} disk  ruta → texto del disco (solo archivos ya estables)
 * @param {Map<string,string>} man   ruta → hash de lo último sincronizado
 * @returns {{ acts: object[], man: Map<string,string> }} acciones y manifiesto resultante
 */
export function planSync(proj, disk, man) {
  const acts = [], next = new Map(man)
  const set = (path, text) => next.set(path, hashText(text))
  const all = new Set([...proj.keys(), ...disk.keys(), ...man.keys()])
  for (const path of [...all].sort()) {
    const P = proj.get(path), D = disk.get(path), M = man.get(path)
    if (P !== undefined && D !== undefined) {
      if (P === D) { set(path, P); continue }
      const hP = hashText(P), hD = hashText(D)
      if (M === undefined) { acts.push({ op: 'updateScript', path, code: D, note: 'sin historial: se tomó la versión de la carpeta' }); set(path, D) } // el disco es lo que el usuario ve en VS Code
      else if (hP === M) { acts.push({ op: 'updateScript', path, code: D }); set(path, D) }
      else if (hD === M) { acts.push({ op: 'writeDisk', path, code: P }); set(path, P) }
      else { acts.push({ op: 'updateScript', path, code: D, note: 'cambió en los dos sitios: gana VS Code' }); set(path, D) }
    } else if (P !== undefined) {
      if (M === undefined) { acts.push({ op: 'writeDisk', path, code: P }); set(path, P) }
      else { acts.push({ op: 'deleteScript', path }); next.delete(path) }
    } else if (D !== undefined) {
      if (M === undefined || hashText(D) !== M) { acts.push({ op: 'importScript', path, code: D }); set(path, D) }
      else { acts.push({ op: 'deleteDisk', path }); next.delete(path) }
    } else next.delete(path)
  }
  return { acts, man: next }
}

/** Ruta en disco de un script del proyecto. */
export const scriptPath = (s) => `${s.folder}/${s.name}`.replace(/\/+/g, '/')

/** Carpeta y nombre de una ruta ('Assets/Scripts/a.js' → { folder: 'Assets/Scripts', name: 'a.js' }). */
export function splitPath(path) {
  const i = path.lastIndexOf('/')
  return { folder: i < 0 ? 'Assets' : path.slice(0, i), name: path.slice(i + 1) }
}

/** ¿Es una ruta de script que se sincroniza? Cualquier .js bajo Assets/ (sin temporales ni ocultos). */
export const isScriptFile = (path) => /^Assets\/(.+\/)?[^/]+\.js$/.test(path) && !path.split('/').some((p) => p.startsWith('.') || p.endsWith('.lftmp'))
