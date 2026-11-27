// Comandos de evento · Mundo y avanzado. Definición declarativa (ver commandDefs.js); la ejecución está en exec-commands.js.
import { newRoute } from './model.js'
import { routeText } from './route.js'
import { WEATHER_LIST } from '../world/weather.js'
import { G, q } from './cmd-shared.js'

export const CMD_WORLD = {
  // ---------------- Mundo ----------------
  timeline: {
    label: 'Reproducir timeline (cinemática)', group: G.WORLD,
    params: [
      { key: 'timeline', label: 'Timeline', type: 'timeline', def: '' },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: true },
      { key: 'speed', label: 'Velocidad', type: 'number', def: 1, min: 0.1, max: 8, step: 0.1 },
      { key: 'from', label: 'Empezar en (s)', type: 'number', def: 0, min: 0, step: 0.1 },
    ],
    summary: (p) => `${p.timeline || '(sin timeline)'}${p.wait === false ? ' · sin esperar' : ''}`,
  },
  cameraControl: {
    label: 'Controlar cámara', group: G.WORLD,
    params: [
      { key: 'action', label: 'Acción', type: 'select', def: 'activate', options: [['activate', 'Activar Camera3D'], ['change', 'Cambiar Camera3D del evento'], ['release', 'Liberar control de cámara']] },
      { key: 'node', label: 'Camera3D', type: 'node', only: ['camera'], def: '', when: { action: ['activate', 'change'] }, hint: 'Selecciona un nodo Camera3D de esta escena. No se usa la cámara de navegación del Editor.' },
      { key: 'to', label: 'Al liberar', type: 'select', def: 'keep', options: [['keep', 'Mantener Camera3D viva'], ['base', 'Volver a cámara base'], ['camera3d', 'Activar otra Camera3D'], ['previous', 'Recuperar fuente anterior'], ['player', 'Activar jugador'], ['pose', 'Mantener pose fija']], when: { action: 'release' }, hint: 'Mantener sigue una Camera3D viva. Pose fija conserva una captura, sin seguir al nodo.' },
      { key: 'cameraId', label: 'Camera3D destino', type: 'node', only: ['camera'], def: '', when: { action: 'release', to: 'camera3d' } },
      { key: 'seconds', label: 'Duración (s)', type: 'number', def: 0, min: 0, max: 60, step: .05, hint: '0 = corte inmediato. Duración en segundos del juego.' },
      { key: 'ease', label: 'Interpolación', type: 'select', def: 'inOut', options: [['inOut', 'Suave (In/Out)'], ['linear', 'Lineal']], hint: 'Durante el blend, solo el propietario puede cambiar la cámara.' },
    ],
    summary: (p, r) => p.action === 'release'
      ? `Liberar cámara · ${p.to === 'base' ? 'volver a base' : 'mantener activa'}`
      : `${p.action === 'change' ? 'Cambiar' : 'Activar'} ${p.node ? r.node(p.node) : '(sin Camera3D)'}`,
  },
  timelineStop: {
    label: 'Detener / omitir timeline', group: G.WORLD,
    params: [
      { key: 'timeline', label: 'Timeline (vacío = el último)', type: 'timeline', def: '', optional: true },
      { key: 'skip', label: 'Omitir (salta al final y ejecuta lo imprescindible)', type: 'bool', def: false },
    ],
    summary: (p) => `${p.skip ? 'Omitir' : 'Detener'} ${p.timeline || 'el último'}`,
  },
  nodeVisible: {
    label: 'Mostrar / ocultar nodo', group: G.WORLD,
    params: [
      { key: 'node', label: 'Nodo', type: 'node', def: '' },
      { key: 'visible', label: 'Visible', type: 'bool', def: true },
    ],
    summary: (p, r) => `${r.node(p.node)} → ${p.visible ? 'mostrar' : 'ocultar'}`,
  },
  nodePersist: {
    label: 'DontDestroyOnLoad', group: G.WORLD,
    params: [
      { key: 'node', label: 'Nodo (vacío = este evento)', type: 'node', def: '', optional: true, none: 'Este evento' },
      { key: 'enabled', label: 'Conservar entre escenas', type: 'bool', def: true },
    ],
    summary: (v, r) => `${v.node ? r.node(v.node) : 'Este evento'} → ${v.enabled !== false ? 'persistente' : 'normal'}`,
  },
  playAnimation: {
    label: 'Reproducir animación', group: G.WORLD,
    params: [
      { key: 'node', label: 'Nodo', type: 'node', def: '', optional: true, none: 'Este evento (el que ejecuta el comando)', hint: 'Sobre quién se reproduce. Las pistas del clip se resuelven desde este nodo hacia sus hijos.' },
      { key: 'clip', label: 'Animación', type: 'animation', def: '' },
      { key: 'loop', label: 'Bucle', type: 'select', def: 'clip', options: [['clip', 'Como dice la animación'], ['yes', 'Sí, en bucle'], ['no', 'No']] },
      { key: 'speed', label: 'Velocidad', type: 'number', def: 1, min: 0.05, step: 0.1 },
      { key: 'fade', label: 'Mezcla de entrada (s)', type: 'number', def: 0, min: 0, step: 0.1 },
      { key: 'from', label: 'Empezar en (s)', type: 'number', def: 0, min: 0, step: 0.1 },
      { key: 'layer', label: 'Capa (animaciones de modelo)', type: 'text', def: '', hint: 'Los clips de una misma capa se sustituyen entre sí; capas distintas suenan a la vez (p. ej. «piernas» y «brazos»). Vacío = capa única.' },
      { key: 'mask', label: 'Solo huesos que contengan…', type: 'text', def: '', hint: 'Animaciones de modelo: textos separados por comas (p. ej. «spine, arm, hand») para animar solo esa parte del cuerpo. Vacío = todo.' },
      { key: 'weight', label: 'Peso de mezcla (0–1)', type: 'number', def: 1, min: 0, max: 1, step: 0.05 },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: false },
    ],
    summary: (p, r) => `«${p.clip || '?'}» en ${p.node ? r.node(p.node) : 'este evento'}${p.loop === 'yes' ? ' (bucle)' : ''}`,
  },
  stopAnimation: {
    label: 'Detener animación', group: G.WORLD,
    params: [
      { key: 'node', label: 'Nodo', type: 'node', def: '', optional: true, none: 'Este evento (el que ejecuta el comando)' },
      { key: 'clip', label: 'Animación (vacío = todas las del nodo)', type: 'animation', def: '', optional: true },
      { key: 'reset', label: 'Volver a la pose inicial', type: 'bool', def: false },
      { key: 'layer', label: 'Solo esta capa', type: 'text', def: '', hint: 'Vacío = todas las animaciones. Con nombre: solo las de esa capa (animaciones de modelo).' },
    ],
    summary: (p, r) => `${p.clip ? '«' + p.clip + '»' : 'todas'} en ${p.node ? r.node(p.node) : 'este evento'}`,
  },
  light: {
    label: 'Controlar luz', group: G.WORLD,
    params: [
      { key: 'node', label: 'Luz', type: 'node', only: ['light'], def: '', optional: true, none: '— ninguna (usar etiqueta) —' },
      { key: 'tag', label: 'O todas las luces con la etiqueta', type: 'text', def: '', hint: 'Si se escribe, afecta a todas las luces con esa etiqueta (Tags y Layers)' },
      { key: 'state', label: 'Estado', type: 'select', def: 'keep', options: [['keep', 'No cambiar'], ['on', 'Encender'], ['off', 'Apagar'], ['toggle', 'Alternar']] },
      { key: 'setColor', label: 'Cambiar color', type: 'bool', def: false },
      { key: 'color', label: 'Color', type: 'color', def: '#ffffff', when: { setColor: true } },
      { key: 'setEnergy', label: 'Cambiar intensidad', type: 'bool', def: false },
      { key: 'energy', label: 'Intensidad (energía)', type: 'number', def: 1.5, min: 0, step: 0.1, when: { setEnergy: true } },
      { key: 'setRange', label: 'Cambiar alcance', type: 'bool', def: false },
      { key: 'range', label: 'Alcance (m)', type: 'number', def: 12, min: 0.1, step: 0.5, when: { setRange: true } },
      { key: 'seconds', label: 'Fundido (s)', type: 'number', def: 0, min: 0, step: 0.1, hint: 'Encender/apagar y los cambios se mezclan en este tiempo' },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: false },
    ],
    summary: (p, r) => `${p.tag ? `etiqueta «${p.tag}»` : r.node(p.node)}: ${[{ on: 'encender', off: 'apagar', toggle: 'alternar' }[p.state], p.setColor && `color ${p.color}`, p.setEnergy && `intensidad ${p.energy}`, p.setRange && `alcance ${p.range}`].filter(Boolean).join(', ') || 'sin cambios'}`,
  },
  nodeMove: {
    label: 'Mover nodo', group: G.WORLD,
    params: [
      { key: 'node', label: 'Nodo', type: 'node', def: '' },
      { key: 'rel', label: 'Desplazamiento relativo', type: 'bool', def: true },
      { key: 'pos', label: 'Posición / desplazamiento', type: 'vec3', def: [0, 1, 0] },
      { key: 'seconds', label: 'Duración (s)', type: 'number', def: 1, min: 0, step: 0.1 },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: true },
    ],
    summary: (p, r) => `${r.node(p.node)} ${p.rel ? '+=' : '→'} (${(p.pos || []).map((v) => +(+v).toFixed(1)).join(', ')}) en ${p.seconds} s`,
  },
  moveRoute: {
    label: 'Ruta de movimiento', group: G.WORLD,
    params: [
      { key: 'target', label: 'Quién se mueve', type: 'select', def: 'this', options: [['this', 'Este evento'], ['player', 'El jugador'], ['node', 'Otro nodo']] },
      { key: 'node', label: 'Nodo', type: 'node', def: '', when: { target: 'node' } },
      { key: 'route', label: 'Ruta', type: 'route', def: newRoute() },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: true },
    ],
    summary: (p, r) => `${p.target === 'player' ? 'Jugador' : p.target === 'node' ? r.node(p.node) : 'Este evento'}: ${routeText(p.route)}${p.route?.repeat ? ' (bucle)' : ''}${p.wait ? ' · esperar' : ''}`,
  },
  weather: {
    label: 'Cambiar el clima', group: G.WORLD,
    params: [
      { key: 'preset', label: 'Tiempo', type: 'select', def: 'rain', options: WEATHER_LIST },
      { key: 'intensity', label: 'Intensidad', type: 'number', def: 1, min: 0, max: 1, step: 0.05 },
      { key: 'seconds', label: 'Transición (s)', type: 'number', def: 8, min: 0, step: 0.5, hint: '0 = cambio inmediato' },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: false, when: { seconds: (v) => +v > 0 } },
    ],
    summary: (p) => `${(WEATHER_LIST.find(([k]) => k === p.preset) || [, p.preset])[1]} ${Math.round((+p.intensity || 0) * 100)} %${+p.seconds > 0 ? ` en ${p.seconds} s` : ''}`,
  },
  weatherLightning: {
    label: 'Relámpago (sin trueno automático)', group: G.WORLD,
    params: [
      { key: 'distance', label: 'Distancia (m)', type: 'number', def: 1200, min: 30, max: 8000, step: 10 },
      { key: 'bearing', label: 'Rumbo (°)', type: 'number', def: 0, min: 0, max: 360, step: 1 },
    ],
    summary: p => `Relámpago a ${p.distance} m · rumbo ${p.bearing}° (trueno separado)`,
  },
  weatherThunder: {
    label: 'Trueno independiente', group: G.WORLD,
    params: [
      { key: 'distance', label: 'Distancia acústica (m)', type: 'number', def: 1200, min: 30, max: 8000, step: 10 },
      { key: 'bearing', label: 'Rumbo (°)', type: 'number', def: 0, min: 0, max: 360, step: 1 },
    ],
    summary: p => `Trueno a ${p.distance} m · rumbo ${p.bearing}°`,
  },
  profile: {
    label: 'Perfil de post-proceso', group: G.WORLD,
    params: [
      { key: 'profile', label: 'Perfil', type: 'profile', def: '', hint: 'Un recurso de Assets/Profiles. Vacío = restaurar Cámara, GameManager o Render' },
      { key: 'seconds', label: 'Transición (s)', type: 'number', def: 1.5, min: 0, step: 0.5 },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: false },
    ],
    summary: (p) => (p.profile ? `Perfil «${String(p.profile).replace(/\.(post|profile)$/i, '')}»` : 'Render del proyecto') + (+p.seconds > 0 ? ` en ${p.seconds} s` : ''),
  },
  clock: {
    label: 'Hora del día', group: G.WORLD,
    params: [
      { key: 'action', label: 'Acción', type: 'select', def: 'set', options: [['set', 'Poner la hora'], ['advance', 'Avanzar horas'], ['flow', 'Que transcurra el tiempo'], ['stop', 'Detener el tiempo']] },
      { key: 'hour', label: 'Hora (0–24)', type: 'number', def: 20, min: 0, max: 24, step: 0.25, when: { action: 'set' } },
      { key: 'hours', label: 'Horas a avanzar', type: 'number', def: 6, min: 0, max: 24, step: 0.5, when: { action: 'advance' } },
      { key: 'dayMinutes', label: 'Minutos reales por día', type: 'number', def: 24, min: 0.5, step: 0.5, when: { action: 'flow' } },
      { key: 'seconds', label: 'Transición (s)', type: 'number', def: 4, min: 0, step: 0.5, when: { action: ['set', 'advance'] }, hint: 'El sol avanza hasta esa hora, no salta' },
      { key: 'wait', label: 'Esperar a que termine', type: 'bool', def: false, when: { action: ['set', 'advance'] } },
    ],
    summary: (p) => (p.action === 'set' ? `Poner las ${p.hour} h` : p.action === 'advance' ? `Avanzar ${p.hours} h` : p.action === 'flow' ? `El tiempo transcurre (${p.dayMinutes} min/día)` : 'Detener el tiempo'),
  },
  erase: { label: 'Borrar este evento', group: G.WORLD, params: [], summary: () => 'Desaparece hasta recargar la escena' },
  // ---------------- Avanzado ----------------
  script: {
    label: 'Script (JavaScript)', group: G.ADV,
    params: [{ key: 'code', label: 'Código', type: 'code', def: '// game, event y args disponibles; se admite await\nawait game.say("Hola")' }],
    summary: (p) => `JS: ${q((p.code || '').replace(/^\s*\/\/.*\n?/gm, ''), 60)}`,
  },
  callFn: {
    label: 'Llamar función de script', group: G.ADV,
    params: [
      { key: 'name', label: 'Nombre de la función', type: 'text', def: '', hint: 'Definida en un script del proyecto con game.define("nombre", fn)' },
      { key: 'args', label: 'Argumentos (JSON, lista)', type: 'text', def: '[]' },
    ],
    summary: (p) => `${p.name || '(sin nombre)'}(${q((p.args || '').replace(/^\[|\]$/g, ''), 30)})`,
  },
}
