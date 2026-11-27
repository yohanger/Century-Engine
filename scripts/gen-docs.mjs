// Genera la referencia de la documentación a partir del código (no se escribe a mano):
//   docs/referencia/comandos.md  ← src/engine/runtime/events/commandDefs.js (comandos de evento, parámetros, opciones, ayudas)
//   docs/referencia/api.md       ← src/core/events/game-api.d.ts (game.*, sus objetos y la documentación de cada miembro)
// Uso: node scripts/gen-docs.mjs          (escribe)
//      node scripts/gen-docs.mjs --check  (falla si están desactualizados; lo usa test-docs.mjs)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMMANDS, GROUP_ORDER } from '../src/engine/runtime/events/commandDefs.js'
import { COND_PARAMS, GRAPHIC_PARAMS } from '../src/engine/runtime/events/model.js'
import { parseDts, signatureOf } from '../src/core/editor/types.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs/referencia')
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

// ---------------------------------------------------------------- comandos
/** Equivalente en script de los comandos más usados (lo demás: ver la API). */
const SCRIPT = {
  text: "await game.say('Hola', 'Anciana', 'bottom', { key, voice, advance })", choices: "const i = await game.choose(['Sí', 'No'])", caption: "await game.caption('…', 3)",
  wait: 'await game.wait(1)', waitInput: "await game.input.wait('interact')", switch: "game.setSwitch('Llave', true)", variable: "game.setVariable('Oro', 10)",
  variableArray: "game.variables.push('Lista', valor)", selfSwitch: "game.setSelfSwitch('A', true)", signal: "await game.emit('abrir', dato)", waitSignal: "await game.waitFor('abrir')",
  runEvent: "await game.event('Puerta').run()", saveGame: 'await game.save.save(1)', loadGame: 'await game.save.load(1)', deleteSave: 'game.save.delete(1)',
  gold: 'game.party.addGold(50)', items: "game.party.gain('items', 'Poción', 1)", party: "game.party.join('Ana')", commonEvent: "await game.common('Curar')",
  control: "game.control('locked')", teleport: 'await game.teleport(x, y, z)', viewModel: "await game.viewModel.attach('Linterna')", viewModelRelease: 'await game.viewModel.release()',
  stashItem: 'game.viewModel.stash()', unstashItem: 'await game.viewModel.unstash(item)', scene: "await game.goScene('Nivel2', 'inicio')", sound: "game.audio.play('puerta.ogg')",
  fade: "await game.fade('out', 1, '#000')", letterbox: 'game.letterbox(12)', ui: "await game.ui.open('inventario')", timeline: "await game.timeline.play('Intro')",
  timelineStop: "game.timeline.stop('Intro')", nodeVisible: "game.node('Puerta').visible = false", playAnimation: "game.node('Puerta').playAnimation('Abrir')",
  stopAnimation: "game.node('Puerta').stopAnimation()", light: "game.lights('Pasillo').forEach((l) => l.turnOff(1))", nodeMove: "await game.node('Caja').move([0, 1, 0], 1, true)",
  moveRoute: "await game.moveRoute('this', [['forward', 2]])", weather: "game.weather.set('rain', 1, 5)", profile: "game.profile.set('Noche', 2)", clock: 'game.clock.set(20, 5)',
  erase: 'event.erase()', script: '(el propio código)', callFn: "await game.call('miFuncion', 1, 2)",
}
const TYPE = {
  text: 'texto', textarea: 'texto largo', code: 'código JS', number: 'número', bool: 'sí / no', select: 'lista', switch: 'interruptor', variable: 'variable', selfswitch: 'auto-interruptor',
  scene: 'escena', node: 'nodo', slot: 'slot', model: 'modelo', vec3: 'x, y, z', color: 'color', stringlist: 'lista de textos', audio: 'audio', audiogroup: 'grupo del mezclador',
  timeline: 'cinemática', ui: 'interfaz', ref: 'registro de la base de datos', action: 'acción o tecla', key: 'tecla', route: 'ruta', lockey: 'clave de localización', prefab: 'prefab',
  animation: 'animación', cameranode: 'cámara', header: '—', list: 'lista', point: 'punto del mapa', weather: 'clima', profile: 'perfil',
}
const typeOf = (p) => (p.js ? 'expresión JS' : TYPE[p.type] || p.type)
const defOf = (p) => {
  if (p.def === undefined || p.def === null || p.def === '') return ''
  if (p.type === 'select' && p.options) { const o = p.options.find(([v]) => v === p.def); if (o) return o[1] }
  if (p.type === 'bool') return p.def ? 'sí' : 'no'
  if (Array.isArray(p.def)) return p.def.join(', ')
  return String(p.def).split('\n')[0]
}
const whenOf = (w) => {
  if (!w) return ''
  return Object.entries(w).map(([k, v]) => (typeof v === 'function' ? `según «${k}»` : `${k} = ${Array.isArray(v) ? v.join(' / ') : v}`)).join(', ')
}
function paramsTable(params) {
  const rows = params.filter((p) => p.type !== 'header')
  if (!rows.length) return '_Sin parámetros._\n'
  let s = '| Parámetro | Tipo | Por defecto | Notas |\n|---|---|---|---|\n'
  for (const p of rows) {
    const notes = [p.hint, p.options && p.type === 'select' ? 'Valores: ' + p.options.map(([, l]) => l).join(' · ') : '', p.when ? `Solo si ${whenOf(p.when)}` : '', p.optional ? 'Opcional' : '']
      .filter(Boolean).join('. ')
    s += `| ${cell(p.label)} \`${p.key}\` | ${cell(typeOf(p))} | ${cell(defOf(p))} | ${cell(notes)} |\n`
  }
  return s
}
function commandsMd() {
  const byGroup = new Map(GROUP_ORDER.map((g) => [g, []]))
  for (const [code, d] of Object.entries(COMMANDS)) { if (!byGroup.has(d.group)) byGroup.set(d.group, []); byGroup.get(d.group).push([code, d]) }
  let s = `# Referencia de comandos de evento

Los comandos se insertan en la lista **Contenido** de una página de evento (doble clic en una línea vacía o «Insertar comando…»).
Se ejecutan en orden, uno detrás de otro; los que esperan (texto, esperar, fundido, cinemática…) detienen la lista hasta terminar.
Cada comando tiene un **equivalente en script** cuando existe (ver la [API de scripts](api.md)).

Hay ${Object.keys(COMMANDS).length} comandos en ${byGroup.size} grupos:

`
  for (const [g, list] of byGroup) if (list.length) s += `- **${g}**: ${list.map(([c, d]) => `[${d.label}](#${c.toLowerCase()})`).join(' · ')}\n`
  for (const [g, list] of byGroup) {
    if (!list.length) continue
    s += `\n## ${g}\n`
    for (const [code, d] of list) {
      s += `\n<a id="${code.toLowerCase()}"></a>\n### ${d.label}\n\nCódigo interno: \`${code}\`${SCRIPT[code] ? ` · En script: \`${SCRIPT[code]}\`` : ''}\n\n`
      if (d.blocks) s += 'Tiene bloques anidados (ramas o cuerpo) donde se insertan más comandos.\n\n'
      s += paramsTable(d.params || [])
    }
  }
  s += `\n## Condiciones de página\n\nUna página está activa si se cumplen **todas** las condiciones marcadas (gana la última página activa, como en RPG Maker).\n\n${paramsTable(COND_PARAMS)}`
  s += `\n## Gráfico de página\n\nLo que se dibuja mientras la página está activa.\n\n${paramsTable(GRAPHIC_PARAMS)}`
  return s
}

// ---------------------------------------------------------------- API
function apiMd() {
  const dts = fs.readFileSync(path.join(ROOT, 'src/core/events/game-api.d.ts'), 'utf8')
  const { interfaces, aliases } = parseDts(dts)
  const order = ['Game', ...[...interfaces.keys()].filter((k) => k !== 'Game' && k !== 'ProjectNames' && k !== 'Console' && !k.startsWith('__') && !['Math', 'JSON', 'Object'].includes(k))]
  let s = `# API de scripts (\`game\`)

En un script del proyecto (\`Assets/Scripts/*.js\`), en el comando «Script» de un evento y en las pantallas \`.ui\` tienes:

- \`game\` — la API del juego (abajo).
- \`event\` — el evento que ejecuta el código (comando «Script» o condición); \`undefined\` en scripts del proyecto. Tipo [EventHandle](#eventhandle).
- \`args\` — argumentos con los que se llamó (game.call / «Llamar función de script»).

Los scripts Global y los comandos Script de evento admiten \`await\` en el nivel superior. Los recursos Nodo se ejecutan con \`game\` y \`node\` en un ámbito síncrono; utiliza una función async interna para esperar promesas. Los nombres de proyecto se sugieren a partir de los recursos; un identificador numérico solo es válido cuando la firma lo admite.

## Índice

${order.map((n) => `- [${n}](#${n.toLowerCase()})`).join('\n')}

`
  for (const name of order) {
    const it = interfaces.get(name)
    s += `\n<a id="${name.toLowerCase()}"></a>\n## ${name}${it.extends.length ? ` (amplía ${it.extends.map((e) => `[${e}](#${e.toLowerCase()})`).join(', ')})` : ''}\n\n`
    if (it.doc) s += `${it.doc}\n\n`
    const props = it.members.filter((m) => m.kind === 'property'), methods = it.members.filter((m) => m.kind === 'method')
    if (props.length) {
      s += '| Propiedad | Tipo | Descripción |\n|---|---|---|\n'
      for (const m of props) s += `| \`${m.name}\`${m.readonly ? ' _(solo lectura)_' : ''} | \`${cell(m.type)}\` | ${cell(m.doc)} |\n`
      s += '\n'
    }
    if (methods.length) {
      const seen = new Set()
      for (const m of methods) {
        const first = !seen.has(m.name)
        seen.add(m.name)
        if (first) s += `\n#### ${name === 'Game' ? 'game.' : ''}${m.name}()\n\n`
        s += `\`\`\`ts\n${signatureOf(m)}\n\`\`\`\n${m.doc ? m.doc + '\n' : ''}\n`
      }
    }
  }
  const al = [...aliases.values()].filter((a) => !a.generic)
  if (al.length) {
    s += '\n## Tipos auxiliares\n\n| Tipo | Definición | Descripción |\n|---|---|---|\n'
    for (const a of al) s += `| \`${a.name}\` | \`${cell(a.type)}\` | ${cell(a.doc)} |\n`
  }
  return s
}

const files = { 'comandos.md': commandsMd(), 'api.md': apiMd() }
if (process.argv.includes('--check')) {
  const stale = Object.entries(files).filter(([f, txt]) => { try { return fs.readFileSync(path.join(OUT, f), 'utf8') !== txt } catch { return true } }).map(([f]) => f)
  if (stale.length) { console.error('Desactualizado: ' + stale.join(', ') + ' → node scripts/gen-docs.mjs'); process.exit(1) }
  console.log('✓ referencia al día')
} else {
  fs.mkdirSync(OUT, { recursive: true })
  for (const [f, txt] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), txt)
  console.log('✓ docs/referencia: ' + Object.keys(files).join(', '))
}
