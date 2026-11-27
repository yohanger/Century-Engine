// Comandos de evento · Guardado, personajes e inventario. Definición declarativa (ver commandDefs.js); la ejecución está en exec-commands.js.
import { G, slotParams, slotText } from './cmd-shared.js'

export const CMD_PARTY = {
  // ---------------- Guardado ----------------
  saveGame: {
    label: 'Guardar partida', group: G.PLAYER,
    params: [
      ...slotParams(),
      { key: 'name', label: 'Nombre de la partida', type: 'text', def: '', hint: 'Vacío = «Partida N». Admite \\V[n] y {v:n}.' },
      { key: 'ok', label: 'Guardar si salió bien en el interruptor', type: 'switch', def: 0, optional: true, none: 'No usar', hint: 'Se activa si se guardó y se desactiva si el guardado está bloqueado.' },
    ],
    summary: (p, r) => `En ${slotText(p, r)}`,
  },
  loadGame: {
    label: 'Cargar partida', group: G.PLAYER,
    params: [
      ...slotParams(),
      { key: 'ok', label: 'Resultado en el interruptor', type: 'switch', def: 0, optional: true, none: 'No usar', hint: 'ON si se cargó, OFF si la ranura estaba vacía (entonces no pasa nada).' },
    ],
    summary: (p, r) => `Desde ${slotText(p, r)}`,
  },
  deleteSave: { label: 'Borrar partida guardada', group: G.PLAYER, params: [...slotParams()], summary: (p, r) => `Borrar ${slotText(p, r)}` },
  saveAccess: {
    label: 'Permitir / bloquear guardado', group: G.PLAYER,
    params: [{ key: 'value', label: 'Guardar', type: 'select', def: 'on', options: [['on', 'Permitido'], ['off', 'Bloqueado'], ['toggle', 'Alternar']] }],
    summary: (p) => ({ on: 'Permitir', off: 'Bloquear', toggle: 'Alternar' }[p.value] + ' guardado'),
  },
  saveScreen: {
    label: 'Abrir pantalla de guardado / carga', group: G.PLAYER,
    params: [
      { key: 'mode', label: 'Modo', type: 'select', def: 'save', options: [['save', 'Guardar'], ['load', 'Cargar']] },
      { key: 'ui', label: 'Interfaz', type: 'ui', def: '', hint: 'Tu pantalla de ranuras (Assets/UI). Recibe las props { mode, slots } y puede usar game.save. Vacío = la de Base de datos ▸ Jugador.' },
      { key: 'wait', label: 'Esperar a que se cierre', type: 'bool', def: true },
    ],
    summary: (p, r) => `${p.mode === 'load' ? 'Cargar' : 'Guardar'} · ${p.ui ? r.ui(p.ui) : 'pantalla por defecto del Jugador'}`,
  },
  // ---------------- Personajes e inventario ----------------
  gold: {
    label: 'Cambiar oro', group: G.DB,
    params: [{ key: 'op', label: 'Operación', type: 'select', def: 'add', options: [['add', 'Aumentar'], ['sub', 'Disminuir'], ['set', 'Fijar']] }, { key: 'n', label: 'Cantidad', type: 'number', def: 10, min: 0, step: 1 }],
    summary: (p) => `${{ add: '+', sub: '−', set: '=' }[p.op]} ${p.n}`,
  },
  items: {
    label: 'Cambiar objetos / armas / armaduras', group: G.DB,
    params: [
      { key: 'kind', label: 'Tipo', type: 'select', def: 'items', options: [['items', 'Objeto'], ['weapons', 'Arma'], ['armors', 'Armadura']] },
      { key: 'item', label: 'Objeto', type: 'ref', kind: 'items', def: 1, when: { kind: 'items' } },
      { key: 'weapon', label: 'Arma', type: 'ref', kind: 'weapons', def: 1, when: { kind: 'weapons' } },
      { key: 'armor', label: 'Armadura', type: 'ref', kind: 'armors', def: 1, when: { kind: 'armors' } },
      { key: 'op', label: 'Operación', type: 'select', def: 'add', options: [['add', 'Dar'], ['sub', 'Quitar'], ['set', 'Fijar la cantidad'], ['all', 'Quitar todos los que tenga']] },
      { key: 'nsrc', label: 'Cantidad desde', type: 'select', def: 'const', options: [['const', 'Constante'], ['variable', 'Variable']], when: { op: ['add', 'sub', 'set'] } },
      { key: 'n', label: 'Cantidad', type: 'number', def: 1, min: 0, step: 1, when: { op: ['add', 'sub', 'set'], nsrc: 'const' } },
      { key: 'nvar', label: 'Variable con la cantidad', type: 'variable', def: 1, when: { op: ['add', 'sub', 'set'], nsrc: 'variable' } },
      { key: 'msg', label: 'Mostrar aviso', type: 'bool', def: false },
    ],
    summary: (p, r) => `${{ add: '+', sub: '−', set: '=', all: 'todos' }[p.op] || ''}${p.op === 'all' ? '' : p.nsrc === 'variable' ? ' ' + r.vr(p.nvar) : p.n} ${r.db(p.kind, p[{ items: 'item', weapons: 'weapon', armors: 'armor' }[p.kind]])}`,
  },
  clearItems: {
    label: 'Vaciar inventario', group: G.DB,
    params: [{ key: 'kind', label: 'Qué vaciar', type: 'select', def: 'all', options: [['all', 'Todo (objetos, armas y armaduras)'], ['items', 'Solo objetos'], ['weapons', 'Solo armas'], ['armors', 'Solo armaduras']] }],
    summary: (p) => ({ all: 'todo', items: 'objetos', weapons: 'armas', armors: 'armaduras' }[p.kind] || 'todo'),
  },
  party: {
    label: 'Cambiar grupo', group: G.DB,
    params: [{ key: 'action', label: 'Acción', type: 'select', def: 'join', options: [['join', 'Añadir al grupo'], ['leave', 'Quitar del grupo']] }, { key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 1 }],
    summary: (p, r) => `${p.action === 'join' ? 'Añadir' : 'Quitar'} ${r.db('actors', p.actor)}`,
  },
  actorStat: {
    label: 'Cambiar vida / energía', group: G.DB,
    params: [
      { key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 0, all: true },
      { key: 'stat', label: 'Parámetro', type: 'select', def: 'hp', options: [['hp', 'Vida'], ['mp', 'Energía']] },
      { key: 'op', label: 'Operación', type: 'select', def: 'add', options: [['add', 'Aumentar'], ['sub', 'Disminuir'], ['full', 'Recuperar todo']] },
      { key: 'n', label: 'Cantidad', type: 'number', def: 10, min: 0, step: 1, when: { op: ['add', 'sub'] } },
    ],
    summary: (p, r) => `${p.actor ? r.db('actors', p.actor) : 'Todo el grupo'}: ${p.stat === 'hp' ? 'vida' : 'energía'} ${p.op === 'full' ? 'al máximo' : (p.op === 'add' ? '+' : '−') + p.n}`,
  },
  level: {
    label: 'Cambiar nivel / experiencia', group: G.DB,
    params: [
      { key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 1 },
      { key: 'what', label: 'Qué', type: 'select', def: 'level', options: [['level', 'Nivel'], ['exp', 'Experiencia']] },
      { key: 'op', label: 'Operación', type: 'select', def: 'add', options: [['add', 'Aumentar'], ['sub', 'Disminuir'], ['set', 'Fijar (solo nivel)']] },
      { key: 'n', label: 'Cantidad', type: 'number', def: 1, min: 0, step: 1 },
    ],
    summary: (p, r) => `${r.db('actors', p.actor)}: ${p.what === 'level' ? 'nivel' : 'exp'} ${{ add: '+', sub: '−', set: '=' }[p.op]} ${p.n}`,
  },
  equip: {
    label: 'Cambiar equipo', group: G.DB,
    params: [
      { key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 1 },
      { key: 'slot', label: 'Ranura', type: 'ref', kind: 'sys:equipTypes', def: 1 },
      { key: 'item', label: 'Objeto de equipo (0 = quitar)', type: 'equipitem', def: 0 },
    ],
    summary: (p, r) => `${r.db('actors', p.actor)} · ranura ${p.slot}: ${p.item ? r.db(+p.slot === 1 ? 'weapons' : 'armors', p.item) : 'quitar'}`,
  },
  weapon3D: {
    label: 'Arma equipada 3D', group: G.DB,
    params: [
      { key: 'action', label: 'Acción', type: 'select', def: 'equip', options: [['equip', 'Equipar y mostrar en la mano'], ['use', 'Ejecutar acción del arma'], ['unequip', 'Desequipar y guardar el modelo']] },
      { key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 1 },
      { key: 'node', label: 'Evento del arma (vacío = este evento)', type: 'node', def: '', when: { action: 'equip' }, hint: 'El evento debe tener el gráfico «Arma» de Database.' },
      { key: 'slot', label: 'Slot del View Model', type: 'slot', def: 'right', when: { action: 'equip' } },
      { key: 'targetType', label: 'Objetivo', type: 'select', def: 'default', options: [['default', 'Según el alcance de la habilidad'], ['actor', 'Personaje'], ['enemy', 'Enemigo de Database']], when: { action: 'use' } },
      { key: 'targetActor', label: 'Personaje objetivo', type: 'ref', kind: 'actors', def: 1, when: { action: 'use', targetType: 'actor' } },
      { key: 'targetEnemy', label: 'Enemigo objetivo', type: 'ref', kind: 'enemies', def: 1, when: { action: 'use', targetType: 'enemy' } },
      { key: 'msg', label: 'Mostrar mensaje', type: 'bool', def: false, when: { action: 'use' } },
    ],
    summary: (p, r) => `${{ equip: 'Equipar', unequip: 'Desequipar', use: 'Acción' }[p.action] || 'Arma'} · ${r.db('actors', p.actor)}${p.node && p.action === 'equip' ? ' · ' + r.node(p.node) : ''}`,
  },
  skill: {
    label: 'Aprender / olvidar habilidad', group: G.DB,
    params: [{ key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 1 }, { key: 'action', label: 'Acción', type: 'select', def: 'learn', options: [['learn', 'Aprender'], ['forget', 'Olvidar']] }, { key: 'skill', label: 'Habilidad', type: 'ref', kind: 'skills', def: 1 }],
    summary: (p, r) => `${r.db('actors', p.actor)} ${p.action === 'learn' ? 'aprende' : 'olvida'} ${r.db('skills', p.skill)}`,
  },
  state: {
    label: 'Cambiar estado', group: G.DB,
    params: [{ key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 0, all: true }, { key: 'action', label: 'Acción', type: 'select', def: 'add', options: [['add', 'Añadir'], ['remove', 'Quitar']] }, { key: 'state', label: 'Estado', type: 'ref', kind: 'states', def: 1 }],
    summary: (p, r) => `${p.actor ? r.db('actors', p.actor) : 'Grupo'}: ${p.action === 'add' ? '+' : '−'} ${r.db('states', p.state)}`,
  },
  recoverAll: { label: 'Recuperar a todo el grupo', group: G.DB, params: [], summary: () => 'Vida, energía y estados' },
  item3D: {
    label: 'Objeto 3D de Database', group: G.DB,
    params: [
      { key: 'action', label: 'Acción', type: 'select', def: 'pickup', options: [['pickup', 'Recoger en la mano'], ['use', 'Usar el objeto de la mano'], ['store', 'Guardar en el inventario'], ['take', 'Sacar del inventario a la mano']] },
      { key: 'node', label: 'Evento del objeto (vacío = este evento)', type: 'node', def: '', hint: 'Debe ser un nodo Evento. Su gráfico «Objeto» vincula el registro de Database.' },
      { key: 'item', label: 'Objeto de Database (0 = usar el gráfico del evento)', type: 'ref', kind: 'items', def: 0, optional: true, when: { action: 'pickup' } },
      { key: 'slot', label: 'Slot de la mano', type: 'slot', def: 'right', when: { action: ['pickup', 'take'] } },
      { key: 'target', label: 'Usar sobre', type: 'ref', kind: 'actors', def: 0, optional: true, when: { action: 'use' } },
      { key: 'msg', label: 'Mostrar mensaje', type: 'bool', def: false, when: { action: 'use' } },
    ],
    summary: (p, r) => ({ pickup: 'Recoger', use: 'Usar', store: 'Guardar', take: 'Sacar' }[p.action] || 'Objeto') + ' · ' + (p.node ? r.node(p.node) : 'este evento'),
  },
  useItem: {
    label: 'Usar objeto', group: G.DB,
    params: [{ key: 'item', label: 'Objeto', type: 'ref', kind: 'items', def: 1 }, { key: 'target', label: 'Sobre', type: 'ref', kind: 'actors', def: 0, all: true }, { key: 'msg', label: 'Mostrar mensaje', type: 'bool', def: false }],
    summary: (p, r) => `${r.db('items', p.item)} → ${p.target ? r.db('actors', p.target) : '1.º del grupo'}`,
  },
  useSkill: {
    label: 'Usar habilidad', group: G.DB,
    params: [{ key: 'skill', label: 'Habilidad', type: 'ref', kind: 'skills', def: 1 }, { key: 'user', label: 'Usuario', type: 'ref', kind: 'actors', def: 1 }, { key: 'target', label: 'Sobre', type: 'ref', kind: 'actors', def: 0, all: true }, { key: 'msg', label: 'Mostrar mensaje', type: 'bool', def: false }],
    summary: (p, r) => `${r.db('actors', p.user)}: ${r.db('skills', p.skill)}`,
  },
  nameActor: {
    label: 'Cambiar nombre / apodo', group: G.DB,
    params: [{ key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 1 }, { key: 'name', label: 'Nombre (vacío = no cambiar)', type: 'text', def: '' }, { key: 'nickname', label: 'Apodo (vacío = no cambiar)', type: 'text', def: '' }],
    summary: (p, r) => `${r.db('actors', p.actor)} → ${p.name || ''}${p.nickname ? ' «' + p.nickname + '»' : ''}`,
  },
  commonEvent: {
    label: 'Llamar evento común', group: G.DB,
    params: [{ key: 'id', label: 'Evento común', type: 'ref', kind: 'commonEvents', def: 1 }],
    summary: (p, r) => r.db('commonEvents', p.id),
  },
  journal: {
    label: 'Misiones y documentos', group: G.DB,
    params: [
      { key: 'kind', label: 'Tipo', type: 'select', def: 'quest', options: [['quest', 'Misión'], ['lore', 'Documento']] },
      { key: 'quest', label: 'Misión', type: 'ref', kind: 'quests', def: 1, when: { kind: 'quest' } },
      { key: 'qa', label: 'Acción', type: 'select', def: 'start', options: [['start', 'Empezar'], ['objective', 'Marcar objetivo'], ['complete', 'Completar (da recompensa)'], ['fail', 'Fallar'], ['reset', 'Reiniciar']], when: { kind: 'quest' } },
      { key: 'obj', label: 'Objetivo n.º', type: 'number', def: 1, min: 1, step: 1, when: { kind: 'quest', qa: 'objective' } },
      { key: 'lore', label: 'Documento', type: 'ref', kind: 'lore', def: 1, when: { kind: 'lore' } },
      { key: 'la', label: 'Acción', type: 'select', def: 'collect', options: [['collect', 'Conseguir'], ['remove', 'Quitar']], when: { kind: 'lore' } },
      { key: 'msg', label: 'Mostrar aviso', type: 'bool', def: false },
    ],
    summary: (p, r) => (p.kind === 'quest' ? `${r.db('quests', p.quest)}: ${p.qa}${p.qa === 'objective' ? ' ' + p.obj : ''}` : `${r.db('lore', p.lore)}: ${p.la}`),
  },
}
