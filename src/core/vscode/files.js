// Archivos que Century deja en la carpeta del proyecto para que VS Code conozca la API y los nombres del proyecto.
//
//   Assets/Scripts/*.js         los scripts del proyecto (se sincronizan en los dos sentidos: ver plan.js / sync.js)
//   jsconfig.json               enseña a VS Code que son scripts de Century (solo se crea si no existe: es tuyo)
//   .levelforge/api.d.ts        la API: game, event, args (events/game-api.d.ts; se reescribe al guardar)
//   .levelforge/project.d.ts    los nombres de TU proyecto (objetos, interruptores, nodos…) para autocompletar (se reescribe)
//   .levelforge/script-owners.json  propietario único, si existe, para IntelliSense contextual
//   .levelforge/sync.json       manifiesto de la sincronización de scripts
import { AUDIO_EXT } from '../../engine/runtime/audio/config.js'
import { scriptPath, isScriptFile } from './plan.js'

export const FOLDER = '.levelforge'
export const JSCONFIG = {
  compilerOptions: {
    // checkJs: marca en rojo game.noExiste(), argumentos del tipo equivocado, etc. moduleDetection «force»: cada script es su propio módulo
    // (permite await al nivel superior y que dos scripts declaren la misma const sin chocar), igual que los ejecuta Century.
    checkJs: true, allowJs: true, noEmit: true, strict: false,
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', moduleDetection: 'force', lib: ['ES2022'],
  },
  include: ['Assets/**/*.js', `${FOLDER}/*.d.ts`],
}

const q = (s) => JSON.stringify(String(s))
const uniq = (list) => [...new Set(list.map((s) => String(s ?? '').trim()).filter((s) => s && s.length <= 80))].slice(0, 400)

/** { clave: [nombres] } de todo lo que el proyecto nombra. `scenes` = Map(sceneId → { objects }) de TODAS las escenas guardadas. */
export function projectNames(meta, scenes = new Map()) {
  const db = meta.database || {}
  const objs = [...scenes.values()].flatMap((s) => s?.objects || [])
  const names = (kind) => uniq((db[kind] || []).map((r) => r.name))
  return {
    switches: uniq(db.switches || []),
    variables: uniq(db.variables || []),
    nodes: uniq(objs.map((o) => o.name)),
    events: uniq(objs.filter((o) => o.type === 'event').map((o) => o.name)),
    scenes: uniq((meta.scenes || []).map((s) => s.name)),
    prefabs: uniq((meta.prefabs || []).map(p => p.name)),
    timelines: uniq((meta.timelines || []).map((t) => t.name)),
    uis: uniq((meta.uis || []).map((u) => String(u.name).replace(/\.ui$/, ''))),
    clips: uniq((meta.assets || []).filter((a) => AUDIO_EXT.includes(String(a.ext || a.name.split('.').pop()).toLowerCase())).map((a) => a.name)),
    groups: uniq((meta.audio?.groups || []).map((g) => g.name)),
    slots: uniq((db.player?.slots || []).map((s) => s.id)),
    items: names('items'), weapons: names('weapons'), armors: names('armors'), skills: names('skills'), actors: names('actors'),
    classes: names('classes'), enemies: names('enemies'), states: names('states'), quests: names('quests'), lore: names('lore'), commonEvents: names('commonEvents'),
    texts: uniq((meta.localization?.entries || []).map((e) => e.key)), languages: uniq((meta.localization?.languages || []).map((l) => l.code)),
  }
}

/** .levelforge/project.d.ts: amplía LF.ProjectNames con los nombres reales (los que no existen se omiten). */
export function projectDts(meta, scenes) {
  const n = projectNames(meta, scenes)
  const rows = Object.entries(n).filter(([, v]) => v.length).map(([k, v]) => `    ${k}: ${v.map(q).join(' | ')}`)
  return `// Generado por Century al guardar el proyecto «${String(meta.name || '').replace(/[\r\n*/]/g, ' ')}»: no lo edites.
// Sirve para que VS Code sugiera los nombres reales (game.party.gain("items", "…"), game.setSwitch("…")…).
declare namespace LF {
  interface ProjectNames {
${rows.join('\n')}
  }
}
`
}

/** Tipado contextual del propietario: solo hay tipo concreto si TODAS las asociaciones guardadas coinciden.
 * El recurso JS puede estar adjunto a nodos de varias escenas y a Prefabs sin instanciar.
 * Las referencias ambiguas o sin propietario conservan el tipo genérico. */
export function scriptOwnerTypes(meta, scenes = new Map()) {
  const owners = new Map()
  for (const scene of [...scenes.values(), ...(meta.prefabs || [])]) {
    for (const obj of scene?.objects || []) {
      const ids = Array.isArray(obj?.scriptIds) ? obj.scriptIds : obj?.scriptId ? [obj.scriptId] : []
      for (const id of ids) {
        if (!owners.has(id)) owners.set(id, new Set())
        owners.get(id).add(obj.type)
      }
    }
  }
  const resolved = {}, nodeScripts = []
  const complete = (meta.scenes || []).every(scene => scenes.has(scene.id))
  for (const script of meta.scripts || []) {
    const path = scriptPath(script)
    const types = owners.get(script.id)
    if (script.execution !== 'node' || !isScriptFile(path)) continue
    nodeScripts.push(path)
    if (complete && types?.size === 1 && types.has('characterbody3d')) resolved[path] = 'characterbody3d'
  }
  return JSON.stringify({ version: 1, nodeScripts: nodeScripts.sort(), owners: Object.fromEntries(Object.entries(resolved).sort(([a],[b]) => a.localeCompare(b))) }, null, 2) + '\n'
}
