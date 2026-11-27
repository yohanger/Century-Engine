// Comandos de evento · Jugador y escena. Definición declarativa (ver commandDefs.js); la ejecución está en exec-commands.js.
import { G, ANIM_PARAMS, animSummary, q } from './cmd-shared.js'

export const CMD_PLAYER = {
  // ---------------- Jugador y escena ----------------
  control: {
    label: 'Control del jugador', group: G.PLAYER,
    params: [{ key: 'mode', label: 'Jugador', type: 'select', def: 'free', options: [['free', 'Libre (puede moverse y mirar)'], ['locked', 'Bloqueado (puede mirar, no moverse)'], ['frozen', 'Congelado (ni moverse ni mirar)']] }],
    summary: (p) => ({ free: 'Permitir movimiento', locked: 'Bloquear movimiento (puede mirar)', frozen: 'Congelar al jugador' }[p.mode ?? (p.enabled === false ? 'locked' : 'free')]),
  },
  teleport: {
    label: 'Teletransportar jugador', group: G.PLAYER,
    params: [
      { key: 'mode', label: 'Destino', type: 'select', def: 'node', options: [['node', 'Un nodo de la escena (p. ej. un Spawn)'], ['pos', 'Posición']] },
      { key: 'node', label: 'Nodo', type: 'node', def: '', when: { mode: 'node' } },
      { key: 'pos', label: 'Posición', type: 'vec3', def: [0, 0, 0], when: { mode: 'pos' } },
      { key: 'yaw', label: 'Mirar hacia (°, vacío = igual)', type: 'text', def: '' },
    ],
    summary: (p, r) => (p.mode === 'pos' ? `A (${(p.pos || []).map((v) => +(+v).toFixed(1)).join(', ')})` : `A ${r.node(p.node)}`),
  },
  viewModel: {
    label: 'Mover al view model', group: G.PLAYER,
    params: [
      { key: 'node', label: 'Qué mover', type: 'node', def: '', optional: true, none: 'Este evento (el que ejecuta el comando)', hint: 'Vacío = el propio evento. O elige otro nodo: un evento, un trigger, un modelo…' },
      { key: 'slot', label: 'Slot', type: 'slot', def: 'right', hint: 'Mano derecha, mano izquierda, ojos… (Base de datos ▸ Jugador)' },
      { key: 'pos', label: 'Ajuste de posición', type: 'vec3', def: [0, 0, 0], hint: 'Respecto al slot, en metros' },
      { key: 'rot', label: 'Ajuste de rotación (°)', type: 'vec3', def: [0, 0, 0] },
      { key: 'scale', label: 'Escala', type: 'number', def: 1, min: 0.01, step: 0.05 },
      { key: 'seconds', label: 'Duración (s)', type: 'number', def: 0.25, min: 0, step: 0.05 },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: false },
    ],
    summary: (p, r) => `${p.node ? r.node(p.node) : 'Este evento'} → ${p.slot || 'right'}`,
  },
  viewModelRelease: {
    label: 'Sacar del view model', group: G.PLAYER,
    params: [
      { key: 'what', label: 'Qué sacar', type: 'select', def: 'node', options: [['node', 'Un nodo (por defecto, este evento)'], ['slot', 'Todo lo que haya en un slot'], ['all', 'Todo el view model']] },
      { key: 'node', label: 'Nodo', type: 'node', def: '', optional: true, none: 'Este evento (el que ejecuta el comando)', when: { what: 'node' } },
      { key: 'slot', label: 'Slot', type: 'slot', def: 'right', when: { what: 'slot' } },
      { key: 'how', label: 'Cómo', type: 'select', def: 'drop', options: [['drop', 'Soltar'], ['throw', 'Tirar (lanzar hacia donde miras)']], when: { what: 'node' } },
      { key: 'speed', label: 'Fuerza (m/s)', type: 'number', def: 8, min: 0.5, max: 60, step: 0.5, when: { what: 'node', how: 'throw' } },
      { key: 'where', label: 'Dónde queda', type: 'select', def: 'ground', options: [['ground', 'Delante del jugador, en el suelo'], ['pos', 'En una posición del mundo']], when: { what: 'node', how: 'drop' } },
      { key: 'pos', label: 'Posición', type: 'vec3', def: [0, 0, 0], when: { what: 'node', how: 'drop', where: 'pos' } },
      { key: 'seconds', label: 'Duración (s)', type: 'number', def: 0.35, min: 0, step: 0.05, when: { how: (v) => v !== 'throw' } },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: false },
    ],
    summary: (p, r) => (p.what === 'all' ? 'Todo el view model' : p.what === 'slot' ? `Todo lo de «${p.slot || 'right'}»` : p.how === 'throw' ? `Tirar ${p.node ? r.node(p.node) : 'este evento'} (${p.speed} m/s)` : `${p.node ? r.node(p.node) : 'Este evento'} → ${p.where === 'pos' ? 'posición' : 'suelo'}`),
  },
  stashItem: {
    label: 'Guardar objeto en variable', group: G.PLAYER,
    params: [
      { key: 'what', label: 'Qué guardar', type: 'select', def: 'hand', options: [['hand', 'Lo que el jugador lleva en la mano'], ['node', 'Un nodo (se quita del mundo)']], hint: 'El objeto desaparece (sin colisión ni eventos) pero sigue existiendo: puedes devolverlo después con «Sacar objeto guardado».' },
      { key: 'slot', label: 'Slot', type: 'slot', def: 'right', when: { what: 'hand' } },
      { key: 'node', label: 'Nodo', type: 'node', def: '', when: { what: 'node' } },
      { key: 'out', label: 'Guardarlo en la variable', type: 'variable', def: 0, optional: true, none: 'No guardar la referencia', hint: 'Queda una referencia al objeto (no una copia). Con ella, «Sacar objeto guardado» lo devuelve, aunque entretanto haya cambiado de página.' },
      { key: 'okSw', label: 'Interruptor: ON si había algo que guardar', type: 'switch', def: 0, optional: true, none: 'No usar' },
    ],
    summary: (p, r) => `${p.what === 'node' ? r.node(p.node) : `Mano «${p.slot || 'right'}»`}${p.out ? ' → ' + r.vr(p.out) : ''}`,
  },
  unstashItem: {
    label: 'Sacar objeto guardado', group: G.PLAYER,
    params: [
      { key: 'src', label: 'Qué sacar', type: 'select', def: 'variable', options: [['variable', 'El objeto guardado en una variable'], ['node', 'Un nodo guardado']] },
      { key: 'var', label: 'Variable', type: 'variable', def: 1, when: { src: 'variable' } },
      { key: 'node', label: 'Nodo', type: 'node', def: '', when: { src: 'node' } },
      { key: 'to', label: 'Dónde aparece', type: 'select', def: 'hand', options: [['hand', 'En la mano del jugador'], ['world', 'En el mundo']] },
      { key: 'slot', label: 'Slot', type: 'slot', def: 'right', when: { to: 'hand' } },
      { key: 'where', label: 'Posición', type: 'select', def: 'ground', options: [['ground', 'Delante del jugador, en el suelo'], ['pos', 'En una posición del mundo']], when: { to: 'world' } },
      { key: 'pos', label: 'Coordenadas', type: 'vec3', def: [0, 0, 0], when: { to: 'world', where: 'pos' } },
      { key: 'clear', label: 'Vaciar la variable después', type: 'bool', def: true, when: { src: 'variable' } },
      { key: 'okSw', label: 'Interruptor: ON si se sacó, OFF si no había nada', type: 'switch', def: 0, optional: true, none: 'No usar' },
    ],
    summary: (p, r) => `${p.src === 'node' ? r.node(p.node) : r.vr(p.var)} → ${p.to === 'world' ? (p.where === 'pos' ? 'mundo (posición)' : 'suelo') : `mano «${p.slot || 'right'}»`}`,
  },
  scene: {
    label: 'Ir a otra escena', group: G.PLAYER,
    params: [
      { key: 'scene', label: 'Escena', type: 'scene', def: '' },
      { key: 'where', label: 'Dónde aparece', type: 'select', def: 'spawn', options: [['spawn', 'En un nodo por etiqueta o nombre'], ['pos', 'En una posición exacta']] },
      { key: 'tag', label: 'Etiqueta o nombre del nodo', type: 'text', def: 'player', when: { where: 'spawn' } },
      { key: 'pos', label: 'Posición', type: 'vec3', def: [0, 0, 0], when: { where: 'pos' } },
      { key: 'yaw', label: 'Mirar hacia (°, vacío = el del marcador antiguo)', type: 'text', def: '' },
      { key: 'fadeOut', label: 'Fundido al salir (s)', type: 'number', def: 0.5, min: 0, step: 0.1, hint: '0 = corte directo' },
      { key: 'fadeIn', label: 'Fundido al llegar (s)', type: 'number', def: 0.5, min: 0, step: 0.1 },
      { key: 'color', label: 'Color del fundido', type: 'color', def: '#000000' },
    ],
    summary: (p, r) => `${r.scene(p.scene)} · ${p.where === 'pos' ? `(${(p.pos || []).map((v) => +(+v).toFixed(1)).join(', ')})` : `nodo «${p.tag || 'player'}»`}${+p.fadeOut || +p.fadeIn ? ' · con fundido' : ''}`,
  },
  sound: {
    label: 'Reproducir sonido', group: G.AUDIO,
    params: [
      { key: 'clip', label: 'Clip', type: 'audio', def: '' },
      { key: 'group', label: 'Grupo del mezclador', type: 'audiogroup', def: 'sfx' },
      { key: 'volume', label: 'Volumen', type: 'number', def: 1, min: 0, max: 2, step: 0.05 },
      { key: 'pitch', label: 'Tono', type: 'number', def: 1, min: 0.1, max: 4, step: 0.05 },
      { key: 'loop', label: 'En bucle', type: 'bool', def: false },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: false, when: { loop: false } },
    ],
    summary: (p) => `${p.clip ? q(p.clip) : '(sin clip)'} → ${p.group || 'sfx'}`,
  },
  soundStop: {
    label: 'Detener sonidos', group: G.AUDIO,
    params: [
      { key: 'group', label: 'Grupo (vacío = todos)', type: 'audiogroup', def: '', optional: true },
      { key: 'fade', label: 'Fundido (s)', type: 'number', def: 0, min: 0, step: 0.1 },
    ],
    summary: (p) => (p.group ? `Grupo ${p.group}` : 'Todos'),
  },
  audioGroup: {
    label: 'Volumen de un grupo', group: G.AUDIO,
    params: [
      { key: 'group', label: 'Grupo', type: 'audiogroup', def: 'music' },
      { key: 'volume', label: 'Volumen (0–1)', type: 'number', def: 1, min: 0, max: 2, step: 0.05 },
      { key: 'seconds', label: 'Fundido (s)', type: 'number', def: 0, min: 0, step: 0.1 },
      { key: 'mute', label: 'Silenciar', type: 'select', def: 'keep', options: [['keep', 'No cambiar'], ['on', 'Silenciar'], ['off', 'Activar']] },
      { key: 'wait', label: 'Esperar al fundido', type: 'bool', def: false },
    ],
    summary: (p) => `${p.group} → ${p.volume}${+p.seconds ? ' en ' + p.seconds + ' s' : ''}`,
  },
  fade: {
    label: 'Fundido de pantalla', group: G.PLAYER,
    params: [
      { key: 'dir', label: 'Fundido', type: 'select', def: 'out', options: [['out', 'A color (oscurecer)'], ['in', 'Desde color (aclarar)']] },
      { key: 'seconds', label: 'Duración (s)', type: 'number', def: 1, min: 0, step: 0.1 },
      { key: 'color', label: 'Color', type: 'color', def: '#000000' },
    ],
    summary: (p) => `${p.dir === 'out' ? 'Oscurecer' : 'Aclarar'} en ${p.seconds} s`,
  },
  caption: {
    label: 'Subtítulo', group: G.MSG,
    params: [
      { key: 'text', label: 'Texto', type: 'textarea', def: '', hint: 'Se muestra sin pedir confirmación y se quita solo. Ideal para cinemáticas. Usa {v:3} para variables.' },
      { key: 'seconds', label: 'Duración (s)', type: 'number', def: 3, min: 0.1, step: 0.1 },
      { key: 'pos', label: 'Posición', type: 'select', def: 'bottom', options: [['bottom', 'Abajo'], ['center', 'Centro'], ['top', 'Arriba']] },
      { key: 'wait', label: 'Esperar a que desaparezca', type: 'bool', def: false },
      ...ANIM_PARAMS,
    ],
    preview: true,
    summary: (p) => `«${q(p.text)}» · ${p.seconds} s${animSummary(p)}`,
  },
  levelName: {
    label: 'Mostrar nombre del mapa', group: G.MSG,
    params: [
      { key: 'text', label: 'Texto (vacío = nombre del nivel)', type: 'text', def: '' },
      { key: 'pos', label: 'Posición', type: 'select', def: '', options: [['', 'La del nivel'], ['bottom-right', 'Abajo a la derecha'], ['bottom-left', 'Abajo a la izquierda'], ['top-right', 'Arriba a la derecha'], ['top-left', 'Arriba a la izquierda'], ['center', 'Centro']] },
    ],
    preview: true,
    summary: (p) => (p.text ? `«${q(p.text)}»` : 'Nombre del nivel'),
  },
  letterbox: {
    label: 'Barras de cine', group: G.PLAYER,
    params: [{ key: 'percent', label: 'Alto de cada barra (% de la pantalla)', type: 'number', def: 12, min: 0, max: 25, step: 1, hint: '0 = quitar las barras. Las cinemáticas las quitan al terminar.' }],
    summary: (p) => (+p.percent ? `${p.percent} %` : 'Quitar'),
  },
  ui: {
    label: 'Mostrar / cerrar interfaz', group: G.PLAYER,
    params: [
      { key: 'action', label: 'Acción', type: 'select', def: 'open', options: [['open', 'Abrir'], ['close', 'Cerrar'], ['toggle', 'Alternar'], ['showCanvas', 'Mostrar Canvas'], ['hideCanvas', 'Ocultar Canvas'], ['toggleCanvas', 'Alternar Canvas']] },
      { key: 'canvas', label: 'Nodo Canvas', type: 'node', only: ['canvas'], def: '', when: { action: ['showCanvas', 'hideCanvas', 'toggleCanvas'] } },
      { key: 'ui', label: 'Interfaz', type: 'ui', def: '', when: { action: ['open', 'close', 'toggle'] } },
      { key: 'props', label: 'Datos (JSON, opcional)', type: 'text', def: '', hint: 'Llegan a la interfaz como «props»: {"mensaje":"Hola"}', when: { action: ['open', 'toggle'] } },
      { key: 'modal', label: 'Modo', type: 'select', def: 'auto', options: [['auto', 'El que indique la interfaz'], ['yes', 'Modal (libera el ratón y pausa)'], ['no', 'No modal']], when: { action: ['open', 'toggle'] } },
      { key: 'wait', label: 'Esperar a que se cierre', type: 'bool', def: false, when: { action: 'open' } },
    ],
    summary: (p, r) => /Canvas$/.test(p.action) ? `${{ showCanvas: 'Mostrar', hideCanvas: 'Ocultar', toggleCanvas: 'Alternar' }[p.action]} Canvas ${p.canvas ? r.node?.(p.canvas) ?? '' : ''}` : `${{ open: 'Abrir', close: 'Cerrar', toggle: 'Alternar' }[p.action] || ''} ${r.ui(p.ui)}${p.wait && p.action === 'open' ? ' (esperar)' : ''}`,
  },
}
