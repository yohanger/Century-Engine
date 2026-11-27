# LevelForge — S11-G005 · Efectos por clave Audio (implementación)

Estado: IMPLEMENTADO EN FUENTES; QA ELECTRON Y PLAYER LOCAL PENDIENTE. La autorización literal fue recibida el 2026-11-07. Esto no significa APROBADO ni CERRADO.

## Contrato de datos
- Las pistas Audio siguen usando claves `track.keys`. `key.fx` es una lista **opcional** de efectos `{ id, type, on, parámetros }` del catálogo existente `FX_TYPES`.
- `normalizeKey('audio', ...)` normaliza FX mediante `normalizeFx`. Si el dato antiguo no tenía `fx`, no se añade; no hay migración destructiva.
- Los nuevos FX se crean solo por edición explícita en el Inspector. Los duplicados conservan ajustes mediante la clonación profunda existente de `duplicateTimelineSelection`.
- `key.group` sigue apuntando al bus canónico; `project.audio.groups[*].fx` mantiene efectos del bus independientes de cada clave.

## Recorrido real
- Inspector contextual `TemporalResourceInspector.vue`: clave Audio `play` muestra el mismo control de cadena de `AudioMixerInspector.vue` en modo FX de clip. Los eventos se traducen en edición de `item.fx`, `commit()` y revisión de Preview. Bloqueo de pista/Play/Editor impide mutaciones.
- Preview (`event-preview.js`) entrega `key.fx` al `AudioEngine.play` configurado con los buses del proyecto.
- Player (`play-timeline.js`): la ruta avanzada lleva `k.fx` a `engine.play`; la ordinaria lo lleva al comando `sound`, `exec-commands.sound`, `AudioScene.script.play` y finalmente `AudioEngine.play`.
- `AudioEngine._voice` acepta `opts.fx` sin cambiar `normalizeSource`: crea instancias de `makeEffect` por voz y conecta **fuente → FX de clip → ganancia de voz → espacialización opcional → bus elegido → FX del bus → padre/Master**.
- No hay gestor nuevo, Mixer paralelo, buses nuevos ni procesadores DSP duplicados. Los ocho tipos y presets existentes siguen siendo los mismos.

## Ciclo de vida y límites
- Cada `Voice` conserva su cadena durante pausas y reanudaciones; el volumen de salida se silencia cuando hay FX y la voz se pausa.
- El fin natural mantiene las colas de eco/reverb hasta su desaparición aproximada y luego desconecta nodos. Las colas seriales se suman, con límite conservador de 20 segundos por voz para evitar retención indefinida. Stop explícito cancela las colas registradas; detener una voz no elimina FX de las demás.
- Un eco con feedback 0 sigue esperando el primer retardo. El parámetro `on:false` utiliza el bypass de `makeEffect` sin crear una segunda implementación.
- Se limita a 16 la cadena editable por clave en este Gate para evitar un número de nodos descontrolado en equipos de pocos recursos.
- PCM, análisis de onda, rutas de audio por bus y comandos de Timeline no reciben nuevas semánticas ni automatización.

## Límites de evidencia
- Node focal G005: 25/25 PASS. Regresión focal ejecutable: 101 PASS, 5 SKIP, 0 FAIL (106).
- Regresión extendida: 117 PASS, 5 SKIP, 3 FAIL (125): dos aserciones históricas del Inspector anterior al Gate y un fallo de carga de la suite G003 por faltar `@vue/compiler-sfc`.
- La fixture Electron embebido está definida y requiere Vite y Electron instalados en el entorno QA; aquí no arrancó. `npm run build` aquí no inicia porque falta Vite. Ni Editor, ni Player ni QA visual/auditivo local están declarados PASS.

## Pendientes fuera de G005
- S11-G006: integración y persistencia exhaustiva tras guardar/reabrir Editor y Player real/exportación.
- S11-G007: envolventes, automatización y fundidos visuales.
- Sprint UX: tooltips globales.
- Comandos/Naturaleza/Métodos conservan el alcance y deuda contractual de S10, sin cambios en este Gate.
