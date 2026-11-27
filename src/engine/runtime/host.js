// Contrato del `host` del Runtime: lo único que el motor pide al mundo exterior. El editor y el juego exportado dan cada uno el suyo.
//
// @typedef {object} RuntimeHost
// Escena (scene-graph.js):
//   project                   proyecto en curso (solo lectura): objetos, entorno, render, base de datos, prefabs, UI, scripts…
//   view                      opciones de vista (luces, wireframe, terreno, follaje, clima, bake, renderMethod…)
//   getObject(id)             objeto del proyecto por id
//   assetData(id)             → Promise<{ name, bytes } | null>      assetImage(id) → Promise<HTMLImageElement | null>
//   toast?(msg, kind, ms)     aviso al usuario            foliageCounts?(counts)
// Juego (events/play.js):
//   playState?                estado reactivo del juego (si no se da, el Runtime crea el suyo: play-state.js)
//   assetUrl(id)              → Promise<string|null>   URL (blob:) de un recurso, para imágenes y tipografías de la interfaz
//   switchScene(id)           → Promise<boolean>       carga otra escena del proyecto (host.project pasa a ser esa escena) y monta la escena
//   bakeState?(state)         estado del bake para la interfaz del editor
//   log(msg, kind?, context?) registro de scripts; niveles log/info/warn/error/debug
//   storage                   datos del jugador, síncrono, por claves lógicas:
//       get(key) → string|null · set(key, value) (puede lanzar si no hay espacio) · remove(key) · keys(prefix) → string[]
//       claves: 'language', 'graphics', 'input', 'audio', 'save/<ranura>'
//   muted?  locked?          (getters, opcionales) silencio de audio del jugador / bloqueo que impide iniciar Jugar
// Sesión de edición (opcional; solo el editor la da: `new PlayMode(editor, session)`, core/editor/play-session.js → EditorPlaySession). Sin ella el juego no toca nada del editor:
//   begin()                   (async) antes de jugar: cierra edición y pintura, guarda selección, cámara, herramienta y luces
//   showPlayView()            esconde lo del editor que no es del juego (superposición, cuadrícula, anillos, órbita); también tras cambiar de escena
//   lightsShown               ¿se ven las luces de los objetos? (sin sesión: siempre)
//   returnToScene(switchFn)   (async) al detener, vuelve a la escena que se editaba
//   end()                     al detener: devuelve cámara, herramienta, luces, vista y selección
/** Consola léxica del autor. No modifica console de Electron ni captura mensajes internos. */
export function createScriptConsole(getHost, context = '', active = () => true) {
  const native = globalThis.console
  const output = Object.create(native)
  for (const kind of ['log', 'info', 'warn', 'error', 'debug']) {
    output[kind] = (...args) => {
      if (!active()) return
      const msg = args.map(value => {
        const seen = new WeakSet()
        try {
          if (typeof value === 'string') return value
          if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`
          if (value === undefined) return 'undefined'
          return JSON.stringify(value, (_, v) => {
            if (typeof v === 'bigint') return `${v}n`
            if (typeof v === 'object' && v !== null) {
              if (seen.has(v)) return '[Circular]'
              seen.add(v)
            }
            return v
          }) ?? String(value)
        } catch { return '[Valor no representable]' }
      }).join(' ').slice(0, 8000)
      const host = getHost()
      if (host?.log) host.log(msg, kind, context)
      else native[kind](...args)
    }
  }
  return output
}

/** El ámbito exterior permite que el autor declare const/let/var console sin colisiones. */
export function compileScript(parameters, source, { async = false, strict = true } = {}) {
  return new Function('console', `return ${async ? 'async ' : ''}function(${parameters.join(',')}) {\n${strict ? '"use strict";\n' : ''}${source}\n}`)
}
