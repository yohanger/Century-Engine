// Comandos de evento · Mensajes, flujo, datos y comunicación. Definición declarativa (ver commandDefs.js); la ejecución está en exec-commands.js.
import { G, OPS, slotParams, slotText, CMPS, VCMPS, ANIM_PARAMS, animSummary, q } from './cmd-shared.js'
import { matchBlocks, newMatchCase } from './match.js'

export const CMD_CORE = {
  // ---------------- Mensajes ----------------
  text: {
    label: 'Mostrar texto', group: G.MSG,
    params: [
      { key: 'speaker', label: 'Quién habla', type: 'text', def: '' },
      { key: 'text', label: 'Texto', type: 'textarea', def: '', hint: 'Usa {v:3} para insertar el valor de la variable 3' },
      { key: 'pos', label: 'Posición', type: 'select', def: 'bottom', options: [['bottom', 'Abajo'], ['center', 'Centro'], ['top', 'Arriba']] },
      { key: 'loc', label: 'Localización', type: 'lockey', def: '', hint: 'Enlaza el texto con una clave de Juego ▸ Localización: el juego lo muestra en el idioma del jugador' },
      { key: 'voice', label: 'Voz (audio)', type: 'audio', def: '', hint: 'Audio en el idioma base; el de cada idioma se elige en Localización' },
      { key: 'voiceAdvance', label: 'Al terminar la voz, pasar al siguiente texto', type: 'bool', def: true, hint: 'Desmárcalo para que el jugador tenga que pulsar aunque la voz haya terminado' },
      { key: 'voiceGroup', label: 'Grupo de la voz', type: 'audiogroup', def: 'voice' },
      ...ANIM_PARAMS,
    ],
    preview: true,
    summary: (p) => `${p.speaker ? p.speaker + ': ' : ''}«${q(p.text)}»${p.voice ? ' · 🔊' : ''}${p.loc ? ' · 🌐 ' + p.loc : ''}${animSummary(p)}`,
  },
  choices: {
    label: 'Mostrar opciones', group: G.MSG,
    params: [
      { key: 'options', label: 'Opciones', type: 'stringlist', def: ['Sí', 'No'] },
      { key: 'cancel', label: 'Al cancelar (Esc)', type: 'select', def: -1, options: [[-1, 'Nada (no se puede cancelar)'], [0, 'Opción 1'], [1, 'Opción 2'], [2, 'Opción 3'], [3, 'Opción 4']] },
      { key: 'prompt', label: 'Pregunta (opcional)', type: 'text', def: '' },
      ...ANIM_PARAMS,
    ],
    preview: true,
    blocks: (p) => (p.options || []).map((o, i) => ({ key: 'c' + i, label: `Si: ${q(o, 28) || 'opción ' + (i + 1)}` })),
    summary: (p) => `Opciones: ${(p.options || []).map((o) => q(o, 14)).join(' | ')}`,
  },
  // ---------------- Flujo ----------------
  wait: { label: 'Esperar', group: G.FLOW, params: [{ key: 'seconds', label: 'Segundos', type: 'number', def: 1, min: 0, step: 0.1 }], summary: (p) => `${p.seconds} s` },
  waitInput: { label: 'Esperar entrada', group: G.FLOW, params: [{ key: 'action', label: 'Acción o tecla', type: 'action', def: 'interact' }], summary: (p) => `Hasta pulsar «${p.action}»` },
  inputAction: {
    label: 'Modificar Input Map', group: G.FLOW,
    params: [
      { key: 'action', label: 'Acción', type: 'action', def: 'jump' },
      { key: 'op', label: 'Operación', type: 'select', def: 'disable', options: [['disable', 'Desactivar acción'], ['enable', 'Activar acción'], ['bind', 'Añadir tecla'], ['rebind', 'Reasignar (sustituye todas)'], ['reset', 'Restaurar por defecto']] },
      { key: 'key', label: 'Tecla', type: 'key', def: '', when: { op: ['bind', 'rebind'] } },
    ],
    summary: (p) => `${p.op} «${p.action}»${p.key ? ' ' + p.key : ''}`,
  },
  if: {
    label: 'Condición (Si…)', group: G.FLOW,
    params: [
      { key: 'kind', label: 'Comprobar', type: 'select', def: 'switch', options: [['switch', 'Interruptor'], ['variable', 'Variable'], ['self', 'Auto-interruptor'], ['gold', 'Oro'], ['item', 'Objeto en el inventario'], ['actor', 'Personaje en el grupo'], ['skill', 'Personaje conoce habilidad'], ['quest', 'Estado de misión'], ['held', 'En la mano (view model)'], ['save', 'Partida guardada'], ['animating', 'Se está reproduciendo una animación'], ['input', 'Entrada (acción o tecla)'], ['script', 'Script']] },
      { key: 'node', label: 'Nodo', type: 'node', def: '', optional: true, none: 'Este evento', when: { kind: 'animating' } },
      { key: 'clip', label: 'Animación (vacío = cualquiera)', type: 'animation', def: '', optional: true, when: { kind: 'animating' } },
      { key: 'sq', label: 'Comprobar', type: 'select', def: 'exists', options: [['exists', 'La ranura tiene una partida'], ['any', 'Hay alguna partida guardada'], ['canSave', 'Se puede guardar (acceso permitido)']], when: { kind: 'save' } },
      ...slotParams({ kind: 'save', sq: 'exists' }),
      { key: 'what', label: 'Comprobar', type: 'select', def: 'node', options: [['node', 'Un nodo está en la mano'], ['slotFull', 'Un slot tiene algo'], ['slotEmpty', 'Un slot está vacío'], ['any', 'Hay algo en las manos'], ['none', 'Las manos están vacías']], when: { kind: 'held' } },
      { key: 'node', label: 'Nodo', type: 'node', def: '', optional: true, none: 'Este evento (el que ejecuta el comando)', when: { kind: 'held', what: 'node' } },
      { key: 'slot', label: 'Slot', type: 'slot', def: 'right', when: { kind: 'held', what: ['slotFull', 'slotEmpty'] } },
      { key: 'action', label: 'Acción o tecla', type: 'action', def: 'interact', when: { kind: 'input' } },
      { key: 'state', label: 'Estado', type: 'select', def: 'held', options: [['held', 'Mantenida'], ['pressed', 'Se acaba de pulsar'], ['released', 'Se acaba de soltar']], when: { kind: 'input' } },
      { key: 'id', label: 'Interruptor', type: 'switch', def: 1, when: { kind: 'switch' } },
      { key: 'on', label: 'Está', type: 'select', def: true, options: [[true, 'ON'], [false, 'OFF']], when: { kind: ['switch', 'self'] } },
      { key: 'vid', label: 'Variable', type: 'variable', def: 1, when: { kind: 'variable' } },
      { key: 'op', label: 'Comparación', type: 'select', def: '>=', options: VCMPS, when: { kind: 'variable' } },
      { key: 'src', label: 'Comparar con', type: 'select', def: 'const', options: [['const', 'Constante (número)'], ['text', 'Texto'], ['variable', 'Otra variable']], when: { kind: 'variable' } },
      { key: 'value', label: 'Valor', type: 'number', def: 0, step: 1, when: { kind: 'variable', src: 'const' } },
      { key: 'text', label: 'Texto', type: 'text', def: '', when: { kind: 'variable', src: 'text' } },
      { key: 'vid2', label: 'Variable', type: 'variable', def: 1, when: { kind: 'variable', src: 'variable' } },
      { key: 'ch', label: 'Auto-interruptor', type: 'selfswitch', def: 'A', when: { kind: 'self' } },
      { key: 'op2', label: 'Comparación', type: 'select', def: '>=', options: CMPS, when: { kind: ['gold', 'item'] } },
      { key: 'n', label: 'Cantidad', type: 'number', def: 1, step: 1, when: { kind: ['gold', 'item'] } },
      { key: 'item', label: 'Objeto', type: 'ref', kind: 'items', def: 1, when: { kind: 'item' } },
      { key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 1, when: { kind: ['actor', 'skill'] } },
      { key: 'skill', label: 'Habilidad', type: 'ref', kind: 'skills', def: 1, when: { kind: 'skill' } },
      { key: 'quest', label: 'Misión', type: 'ref', kind: 'quests', def: 1, when: { kind: 'quest' } },
      { key: 'qs', label: 'Estado', type: 'select', def: 'active', options: [['none', 'Sin empezar'], ['active', 'En curso'], ['done', 'Completada'], ['failed', 'Fallida']], when: { kind: 'quest' } },
      { key: 'expr', label: 'Expresión JS', type: 'text', js: true, def: 'true', when: { kind: 'script' }, hint: 'Ej. game.variable("Llaves") >= 2' },
      { key: 'hasElse', label: 'Con «Si no»', type: 'bool', def: true },
    ],
    blocks: (p) => [{ key: 'then', label: 'Si se cumple' }, ...(p.hasElse ? [{ key: 'else', label: 'Si no' }] : [])],
    summary: (p, r) => {
      if (p.kind === 'animating') return `Si ${p.node ? r.node(p.node) : 'este evento'} reproduce ${p.clip ? '«' + p.clip + '»' : 'una animación'}`
      if (p.kind === 'held') return p.what === 'any' ? 'Si hay algo en las manos' : p.what === 'none' ? 'Si las manos están vacías' : p.what === 'slotFull' ? `Si el slot «${p.slot}» tiene algo` : p.what === 'slotEmpty' ? `Si el slot «${p.slot}» está vacío` : `Si ${p.node ? r.node(p.node) : 'este evento'} está en la mano`
      if (p.kind === 'input') return `Si «${p.action}» ${p.state === 'pressed' ? 'se acaba de pulsar' : p.state === 'released' ? 'se acaba de soltar' : 'está mantenida'}`
      if (p.kind === 'save') return p.sq === 'any' ? 'Si hay alguna partida guardada' : p.sq === 'canSave' ? 'Si se puede guardar' : `Si ${slotText(p, r)} tiene partida`
      if (p.kind === 'switch') return `Si interruptor ${r.sw(p.id)} está ${p.on ? 'ON' : 'OFF'}`
      if (p.kind === 'variable') return `Si variable ${r.vr(p.vid)} ${{ has: 'contiene', nhas: 'no contiene' }[p.op] || p.op} ${p.src === 'variable' ? r.vr(p.vid2) : p.src === 'text' ? q(p.text, 20) : p.value}`
      if (p.kind === 'self') return `Si auto-interruptor ${p.ch} está ${p.on ? 'ON' : 'OFF'}`
      if (p.kind === 'gold') return `Si oro ${p.op2} ${p.n}`
      if (p.kind === 'item') return `Si tiene objeto «${r.db('items', p.item)}» ${p.op2} ${p.n}`
      if (p.kind === 'actor') return `Si «${r.db('actors', p.actor)}» está en el grupo`
      if (p.kind === 'skill') return `Si «${r.db('actors', p.actor)}» conoce «${r.db('skills', p.skill)}»`
      if (p.kind === 'quest') return `Si misión «${r.db('quests', p.quest)}» = ${p.qs}`
      return `Si script: ${q(p.expr)}`
    },
  },
  match: {
    label: 'Match (casos)', group: G.FLOW,
    params: [
      { key: 'src', label: 'Comparar', type: 'select', def: 'variable', options: [['variable', 'Variable'], ['number', 'Número'], ['text', 'Texto'], ['bool', 'Sí / No'], ['signal', 'Dato de señal'], ['script', 'Expresión JS']] },
      { key: 'variable', label: 'Variable', type: 'variable', def: 1, when: { src: 'variable' } },
      { key: 'value', label: 'Número', type: 'number', def: 0, when: { src: 'number' } },
      { key: 'text', label: 'Texto', type: 'text', def: '', when: { src: 'text' } },
      { key: 'flag', label: 'Valor', type: 'select', def: true, options: [[true, 'Sí'], [false, 'No']], when: { src: 'bool' } },
      { key: 'signalField', label: 'Campo recibido', type: 'text', def: 'data', when: { src: 'signal' }, hint: 'Ejemplos: data, itemId, metadata.id. Solo dentro de una señal.' },
      { key: 'expr', label: 'Expresión JS', type: 'text', js: true, def: '0', when: { src: 'script' } },
      { key: 'cases', label: 'Casos', type: 'matchcases', def: [newMatchCase()] },
      { key: 'hasDefault', label: 'Añadir Default (_)', type: 'bool', def: true },
    ],
    blocks: matchBlocks,
    summary: (p, r) => `Match ${p.src === 'variable' ? r.vr(p.variable) : p.src === 'number' ? p.value : p.src === 'text' ? '«' + q(p.text, 18) + '»' : p.src === 'bool' ? (p.flag === false ? 'No' : 'Sí') : p.src === 'signal' ? 'Señal: ' + (p.signalField || 'data') : 'script'} · ${(p.cases || []).length} casos${p.hasDefault ? ' + Default' : ''}`,
  },
  loop: { label: 'Bucle', group: G.FLOW, params: [], blocks: () => [{ key: 'body', label: 'Repetir' }], summary: () => 'Repite hasta «Romper bucle»' },
  break: { label: 'Romper bucle', group: G.FLOW, params: [], summary: () => 'Sale del bucle' },
  exit: { label: 'Salir del evento', group: G.FLOW, params: [], summary: () => 'Termina la ejecución' },
  comment: { label: 'Comentario', group: G.FLOW, params: [{ key: 'text', label: 'Comentario', type: 'textarea', def: '' }], summary: (p) => q(p.text, 60) },
  // ---------------- Datos ----------------
  switch: {
    label: 'Interruptor', group: G.DATA,
    params: [
      { key: 'id', label: 'Interruptor', type: 'switch', def: 1 },
      { key: 'value', label: 'Valor', type: 'select', def: 'on', options: [['on', 'ON'], ['off', 'OFF'], ['toggle', 'Alternar']] },
    ],
    summary: (p, r) => `${r.sw(p.id)} = ${p.value === 'toggle' ? 'alternar' : p.value.toUpperCase()}`,
  },
  variable: {
    label: 'Variable', group: G.DATA,
    params: [
      { key: 'id', label: 'Variable', type: 'variable', def: 1 },
      { key: 'op', label: 'Operación', type: 'select', def: 'set', options: OPS },
      { key: 'src', label: 'Operando', type: 'select', def: 'const', options: [['const', 'Número'], ['text', 'Texto'], ['bool', 'Sí / No'], ['list', 'Lista'], ['variable', 'Otra variable'], ['random', 'Aleatorio'], ['script', 'Script'], ['signal', 'Dato de la señal recibida']] },
      { key: 'signalField', label: 'Campo recibido', type: 'text', def: 'itemId', when: { src: 'signal' }, hint: 'Ejemplos: itemId, delta, objectName, data. Solo dentro de una señal.' },
      { key: 'value', label: 'Valor', type: 'number', def: 1, step: 1, when: { src: 'const' } },
      { key: 'text', label: 'Texto', type: 'text', def: '', when: { src: 'text' }, hint: 'Admite \\V[n] y {v:n}. Con «+ (sumar)» se concatena.' },
      { key: 'flag', label: 'Valor', type: 'select', def: true, options: [[true, 'Sí'], [false, 'No']], when: { src: 'bool' } },
      { key: 'list', label: 'Elementos', type: 'text', def: '', when: { src: 'list' }, hint: 'Separados por comas: 1, 2, hola · o JSON: [1,[2,3]]. Con «+ (sumar)» se añaden a la lista.' },
      { key: 'id2', label: 'Variable', type: 'variable', def: 1, when: { src: 'variable' } },
      { key: 'min', label: 'Mínimo', type: 'number', def: 0, step: 1, when: { src: 'random' } },
      { key: 'max', label: 'Máximo', type: 'number', def: 10, step: 1, when: { src: 'random' } },
      { key: 'expr', label: 'Expresión JS', type: 'text', js: true, def: '0', when: { src: 'script' } },
    ],
    summary: (p, r) => {
      const o = { set: '=', add: '+=', sub: '−=', mul: '×=', div: '÷=', mod: '%=' }[p.op]
      const v = p.src === 'const' ? p.value : p.src === 'text' ? q(p.text, 24) : p.src === 'bool' ? (p.flag === false ? 'No' : 'Sí') : p.src === 'list' ? `[${q(p.list, 24)}]` : p.src === 'variable' ? r.vr(p.id2) : p.src === 'random' ? `aleatorio ${p.min}…${p.max}` : `script ${q(p.expr, 20)}`
      return `${r.vr(p.id)} ${o} ${v}`
    },
  },
  variableArray: {
    label: 'Variable: lista', group: G.DATA,
    params: [
      { key: 'id', label: 'Variable (lista)', type: 'variable', def: 1 },
      { key: 'op', label: 'Operación', type: 'select', def: 'push', options: [
        ['push', 'Añadir al final'], ['unshift', 'Añadir al principio'], ['insert', 'Insertar en la posición'], ['setAt', 'Fijar la posición'],
        ['pop', 'Sacar el último (→ resultado)'], ['shift', 'Sacar el primero (→ resultado)'], ['removeAt', 'Quitar la posición (→ resultado)'], ['removeValue', 'Quitar el valor'],
        ['at', 'Leer la posición (→ resultado)'], ['length', 'Cantidad de elementos (→ resultado)'], ['includes', 'Contiene el valor (1/0 → resultado)'], ['indexOf', 'Posición del valor (→ resultado)'],
        ['sum', 'Suma (→ resultado)'], ['min', 'Mínimo (→ resultado)'], ['max', 'Máximo (→ resultado)'], ['random', 'Elemento al azar (→ resultado)'], ['join', 'Unir en texto (→ resultado)'],
        ['sort', 'Ordenar'], ['reverse', 'Invertir'], ['shuffle', 'Mezclar'], ['clear', 'Vaciar'],
      ] },
      { key: 'idxSrc', label: 'Posición (desde 0)', type: 'select', def: 'const', options: [['const', 'Número'], ['variable', 'Variable']], when: { op: ['insert', 'setAt', 'removeAt', 'at'] } },
      { key: 'index', label: 'Posición', type: 'number', def: 0, min: 0, step: 1, when: { op: ['insert', 'setAt', 'removeAt', 'at'], idxSrc: 'const' } },
      { key: 'idxVar', label: 'Variable de la posición', type: 'variable', def: 1, when: { op: ['insert', 'setAt', 'removeAt', 'at'], idxSrc: 'variable' } },
      { key: 'valSrc', label: 'Valor', type: 'select', def: 'const', options: [['const', 'Número'], ['text', 'Texto'], ['literal', 'Texto / número / lista (JSON)'], ['variable', 'Variable']], when: { op: ['push', 'unshift', 'insert', 'setAt', 'removeValue', 'includes', 'indexOf'] } },
      { key: 'value', label: 'Número', type: 'number', def: 0, step: 1, when: { op: ['push', 'unshift', 'insert', 'setAt', 'removeValue', 'includes', 'indexOf'], valSrc: 'const' } },
      { key: 'text', label: 'Texto', type: 'text', def: '', when: { op: ['push', 'unshift', 'insert', 'setAt', 'removeValue', 'includes', 'indexOf'], valSrc: 'text' } },
      { key: 'literal', label: 'Valor', type: 'text', def: '', when: { op: ['push', 'unshift', 'insert', 'setAt', 'removeValue', 'includes', 'indexOf'], valSrc: 'literal' }, hint: '3 · hola · true · [1,2] · {"a":1}' },
      { key: 'valVar', label: 'Variable del valor', type: 'variable', def: 1, when: { op: ['push', 'unshift', 'insert', 'setAt', 'removeValue', 'includes', 'indexOf'], valSrc: 'variable' } },
      { key: 'sep', label: 'Separador', type: 'text', def: ', ', when: { op: 'join' } },
      { key: 'out', label: 'Guardar el resultado en', type: 'variable', def: 0, optional: true, none: 'No guardar', when: { op: ['pop', 'shift', 'removeAt', 'at', 'length', 'includes', 'indexOf', 'sum', 'min', 'max', 'random', 'join', 'push', 'unshift', 'insert', 'setAt'] } },
    ],
    summary: (p, r) => `${r.vr(p.id)} · ${{ push: 'añadir', unshift: 'añadir al principio', insert: 'insertar', setAt: 'fijar', pop: 'sacar último', shift: 'sacar primero', removeAt: 'quitar posición', removeValue: 'quitar valor', at: 'leer', length: 'cantidad', includes: 'contiene', indexOf: 'posición de', sum: 'suma', min: 'mínimo', max: 'máximo', random: 'al azar', join: 'unir', sort: 'ordenar', reverse: 'invertir', shuffle: 'mezclar', clear: 'vaciar' }[p.op] || p.op}${p.out ? ' → ' + r.vr(p.out) : ''}`,
  },
  selfSwitch: {
    label: 'Auto-interruptor', group: G.DATA,
    params: [
      { key: 'ch', label: 'Auto-interruptor', type: 'selfswitch', def: 'A' },
      { key: 'value', label: 'Valor', type: 'select', def: 'on', options: [['on', 'ON'], ['off', 'OFF'], ['toggle', 'Alternar']] },
    ],
    summary: (p) => `Auto-interruptor ${p.ch} = ${p.value === 'toggle' ? 'alternar' : p.value.toUpperCase()}`,
  },
  // ---------------- Comunicación entre eventos y scripts ----------------
  signal: {
    label: 'Emitir señal', group: G.ADV,
    params: [
      { key: 'name', label: 'Señal', type: 'signal', def: '', hint: 'Nativas y personalizadas. Emitir una señal no ejecuta su operación: solo avisa a quien la escuche.' },
      { key: 'dataSrc', label: 'Dato que lleva', type: 'select', def: 'none', options: [['none', 'Ninguno'], ['number', 'Número'], ['text', 'Texto'], ['variable', 'Valor de una variable'], ['received', 'Datos de la señal recibida']] },
      { key: 'value', label: 'Número', type: 'number', def: 0, step: 1, when: { dataSrc: 'number' } },
      { key: 'text', label: 'Texto', type: 'text', def: '', when: { dataSrc: 'text' }, hint: 'Admite \\V[n] y {v:n}.' },
      { key: 'dataVar', label: 'Variable', type: 'variable', def: 1, when: { dataSrc: 'variable' } },
      { key: 'wait', label: 'Esperar a que terminen los game.on', type: 'bool', def: false },
    ],
    summary: (p, r) => `«${p.name || '?'}»${p.dataSrc === 'variable' ? ' + ' + r.vr(p.dataVar) : p.dataSrc === 'number' ? ' + ' + p.value : p.dataSrc === 'text' ? ' + ' + q(p.text, 16) : ''}`,
  },
  waitSignal: {
    label: 'Esperar señal', group: G.ADV,
    params: [
      // Los comandos antiguos no tienen «flow»: siguen esperando de forma lineal.
      { key: 'flow', label: 'Ejecutar ramas', type: 'bool', def: true, hint: 'Los comandos nuevos tienen cuerpo propio. Desactivar conserva la espera lineal antigua.' },
      { key: 'name', label: 'Señal', type: 'signal', def: '' },
      { key: 'timeout', label: 'Tiempo máximo (s)', type: 'number', def: 0, min: 0, step: 0.5, hint: '0 = esperar sin límite' },
      { key: 'out', label: 'Variable (opcional, proyectos anteriores)', type: 'variable', def: 0, optional: true, none: 'No guardar' },
      { key: 'okSw', label: 'Interruptor de resultado (opcional)', type: 'switch', def: 0, optional: true, none: 'No usar', when: { timeout: (v) => +v > 0 } },
    ],
    blocks: (p) => p.flow === true ? [{ key: 'received', label: 'Cuando se recibe' }, { key: 'timeout', label: 'Si se agota el tiempo' }] : [],
    summary: (p, r) => `«${p.name || '?'}»${+p.timeout > 0 ? ` (máx. ${p.timeout} s)` : ''}${p.flow === true ? ' · con ramas' : ' · espera lineal'}${p.out ? ' → ' + r.vr(p.out) : ''}`,
  },
  runEvent: {
    label: 'Ejecutar evento', group: G.ADV,
    params: [
      { key: 'node', label: 'Evento', type: 'node', only: ['event'], def: '', hint: 'Corre los comandos de ese evento en segundo plano (no bloquea al jugador). Si ya se está ejecutando, no se repite.' },
      { key: 'page', label: 'Página (0 = la activa)', type: 'number', def: 0, min: 0, step: 1, hint: 'Número de página a ejecutar aunque no cumpla sus condiciones; 0 = la página que está activa ahora.' },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: true },
    ],
    summary: (p, r) => `${p.node ? r.node(p.node) : '?'}${+p.page ? ' · página ' + p.page : ''}${p.wait ? ' (esperar)' : ''}`,
  },
}
