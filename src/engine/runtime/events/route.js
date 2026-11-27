// Rutas de movimiento (Set Movement Route de RPG Maker MZ). Declarativas, como los comandos: la interfaz se genera sola.
//
//  Ruta:    { list: [Paso], repeat, skip }       (repeat = bucle · skip = saltar los pasos bloqueados)
//  Paso:    { id, c: código, p: {parámetros} }
//  Avanzar/Retroceder/Izquierda/Derecha/Subir/Bajar son RELATIVOS a hacia dónde mira el nodo (no lo giran); los giros son pasos aparte.
import { defaults, clone } from './model.js'
import { uid } from '../util.js'

export const ROUTE_GROUPS = ['Mover', 'Girar', 'Ajustes', 'Acciones']
const q = (s, n = 30) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }
const dist = { key: 'dist', label: 'Distancia (m)', type: 'number', def: 1, min: 0, step: 0.25 }
const moveCmd = (label, group = 'Mover') => ({ label, group, params: [dist], summary: (p) => `${p.dist} m` })

export const ROUTE_CMDS = {
  forward: moveCmd('Avanzar'), back: moveCmd('Retroceder'), left: moveCmd('Paso a la izquierda'), right: moveCmd('Paso a la derecha'),
  up: moveCmd('Subir'), down: moveCmd('Bajar'),
  stepRandom: moveCmd('Paso aleatorio'), stepToward: moveCmd('Acercarse al jugador'), stepAway: moveCmd('Alejarse del jugador'),
  goto: {
    label: 'Ir a un punto (navegación)', group: 'Mover',
    params: [{ key: 'pos', label: 'Punto', type: 'point', def: [0, null, 0], hint: 'X y Z a mano o con «Mapa». La altura Y sale del mapa de navegación.' }, { key: 'straight', label: 'Sin mapa: ir en línea recta', type: 'bool', def: true }],
    summary: (p) => { const v = p.pos || []; return `(${(+v[0] || 0).toFixed(1)}, ${v[1] === null || v[1] === undefined || v[1] === '' ? 'auto' : (+v[1]).toFixed(1)}, ${(+v[2] || 0).toFixed(1)})` },
  },
  moveTo: {
    label: 'Ir a una posición', group: 'Mover',
    params: [{ key: 'pos', label: 'Posición', type: 'vec3', def: [0, 0, 0] }, { key: 'rel', label: 'Relativa al punto actual', type: 'bool', def: false }],
    summary: (p) => `${p.rel ? '+' : ''}(${(p.pos || []).map((v) => +(+v).toFixed(1)).join(', ')})`,
  },
  turnBy: { label: 'Girar (relativo)', group: 'Girar', params: [{ key: 'deg', label: 'Grados (+ izquierda)', type: 'number', def: 90, step: 15 }], summary: (p) => `${p.deg}°` },
  turnTo: { label: 'Mirar hacia (ángulo)', group: 'Girar', params: [{ key: 'deg', label: 'Ángulo (°)', type: 'number', def: 0, step: 15 }], summary: (p) => `${p.deg}°` },
  turnPlayer: { label: 'Mirar al jugador', group: 'Girar', params: [], summary: () => '' },
  turnAway: { label: 'Dar la espalda al jugador', group: 'Girar', params: [], summary: () => '' },
  turnRandom: { label: 'Girar al azar', group: 'Girar', params: [], summary: () => '' },
  turnNode: { label: 'Mirar a un nodo', group: 'Girar', params: [{ key: 'node', label: 'Nodo', type: 'node', def: '' }], summary: (p) => q(p.node) },
  speed: { label: 'Cambiar velocidad', group: 'Ajustes', params: [{ key: 'n', label: 'Velocidad', type: 'select', def: 4, options: [[1, '1: muy lenta'], [2, '2: lenta'], [3, '3: normal'], [4, '4: rápida'], [5, '5: muy rápida'], [6, '6: veloz']] }], summary: (p) => `${p.n}` },
  through: { label: 'Atravesar paredes', group: 'Ajustes', params: [{ key: 'on', label: 'Activado', type: 'bool', def: true }], summary: (p) => (p.on ? 'ON' : 'OFF') },
  dirFix: { label: 'Dirección fija', group: 'Ajustes', params: [{ key: 'on', label: 'Activado', type: 'bool', def: true }], summary: (p) => (p.on ? 'ON' : 'OFF') },
  wait: { label: 'Esperar', group: 'Acciones', params: [{ key: 'seconds', label: 'Segundos', type: 'number', def: 0.5, min: 0, step: 0.1 }], summary: (p) => `${p.seconds} s` },
  jump: { label: 'Saltar', group: 'Acciones', params: [{ key: 'height', label: 'Altura (m)', type: 'number', def: 1, min: 0, step: 0.25 }, { key: 'seconds', label: 'Duración (s)', type: 'number', def: 0.5, min: 0.1, step: 0.1 }], summary: (p) => `${p.height} m` },
  visible: { label: 'Mostrar / ocultar', group: 'Acciones', params: [{ key: 'on', label: 'Visible', type: 'bool', def: true }], summary: (p) => (p.on ? 'mostrar' : 'ocultar') },
  switch: { label: 'Interruptor', group: 'Acciones', params: [{ key: 'id', label: 'Interruptor', type: 'switch', def: 1 }, { key: 'on', label: 'Valor', type: 'bool', def: true }], summary: (p) => `[${String(p.id).padStart(3, '0')}] ${p.on ? 'ON' : 'OFF'}` },
  sound: { label: 'Reproducir sonido', group: 'Acciones', params: [{ key: 'clip', label: 'Clip', type: 'audio', def: '' }, { key: 'group', label: 'Grupo', type: 'audiogroup', def: 'sfx' }], summary: (p) => q(p.clip) },
  script: { label: 'Script', group: 'Acciones', params: [{ key: 'code', label: 'Código JS', type: 'text', def: '', hint: 'Disponibles: game, node' }], summary: (p) => q(p.code) },
}

export const newRouteStep = (c, p = null) => ({ id: uid('r'), c, p: { ...defaults(ROUTE_CMDS[c].params), ...(p ? clone(p) : {}) } })
export const routeSummary = (st) => { const d = ROUTE_CMDS[st.c]; if (!d) return st.c; let s = ''; try { s = d.summary(st.p) } catch { /* nada */ } return s ? `${d.label}: ${s}` : d.label }
export const routeText = (r) => ((r?.list || []).length ? (r.list.length === 1 ? routeSummary(r.list[0]) : `${r.list.length} pasos`) : 'sin pasos')
