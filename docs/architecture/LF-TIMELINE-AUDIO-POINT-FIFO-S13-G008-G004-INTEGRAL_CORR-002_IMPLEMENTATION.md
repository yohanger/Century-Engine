# LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-002

**Autorizado literalmente:** 2026-11-09.
**SOURCE_BASELINE de entrada:** `LF_TIMELINE_AUDIO_POINT_LIFO_S13_G008_G004_INTEGRAL_CORR001_SOURCE_BASELINE(1).zip` adjuntado por el usuario (2.915 archivos).
**Estado:** IMPLEMENTADO; pruebas Node focales PASS; Electron y compilación NO VERIFICADOS en el entorno de implementación; QA LOCAL PENDIENTE; NO APROBADO NI CERRADO.

## Objetivo y mecanismo contractual
Se reemplaza el orden visual LIFO por **FIFO** bajo `CA-LF-TIMELINE-AUDIO-POINT-ORDER-001`. La prioridad del último Gate autorizado y de la corrección explícita del usuario supersede la instrucción anterior de presentación LIFO. La enmienda se incorpora documentalmente sin atribuirle una ratificación separada que no consta.

## Auditoría del código real
- `src/engine/runtime/audio/automation.js` contiene `volumeAutomationVisualOrder(points)` y normalizador `normalizeVolumeAutomation()`. El primero ordenaba descendentemente por `createdOrder` y posición de entrada. El segundo conserva ordinales válidos en el arreglo cronológicamente ordenado.
- `src/components/TemporalResourceInspector.vue` ya muestra `visualVolumePoints`, una vista `computed` derivada y separada de la colección real sin guardar listas duplicadas.
- `src/core/timeline/model.js` ya asigna ordinales en nuevas altas/movimientos válidos, preserva IDs y persistencia. No necesita ser modificado.
- Preview/Player leen el mismo modelo temporal, no el orden visual del Inspector.

## Cambio de producción aplicado
Único archivo de producción modificado: `src/engine/runtime/audio/automation.js`.

En `volumeAutomationVisualOrder` se usa **orden ascendente** por `createdOrder` y, en empate, por posición de origen. Se mantiene la creación de la vista derivada y la misma API pública; no se altera el arreglo recibido, WebAudio ni estado del proyecto. El comportamiento para puntos antiguos sin ordinal sigue siendo estable, sin migración al abrir el archivo.

## Cobertura actualizada, sin árboles paralelos
Se actualizan en sus ubicaciones originales los tests históricos con nombre de archivo `lifo` para conservar referencias externas. El nombre físico del archivo es histórico; sus **aserciones y etiquetas visibles son ahora FIFO**. Se añaden dos tests al archivo existente para proyectos previamente guardados con `createdOrder`, y el runner Electron exige las 25 aserciones originales, todas adaptadas a FIFO.

## Impacto y exclusiones
No se modifica `TemporalResourceInspector.vue`, `TimelinePanel.vue`, `src/core/timeline/model.js`, persistencia, escenas, AudioMixer, PCM, AudioEngine, Player ni paquetes de exportación. No se añaden campos, managers, componentes ni estado persistente duplicado. El Gate CORR-001 de origen PCM permanece implementado y pendiente de confirmación Electron; no se declara cerrado indirectamente.

## Evidencia y limitación
- **157/157 Node focal PASS** (26 pruebas originales actualizadas + 2 nuevas FIFO, 9 CORR-001 PCM, resto regresiones de Inspector, audio y recorte).
- Suite ampliada: **819 PASS, 19 SKIP y 12 FAIL históricos**; el listado de los 12 FAIL coincide exactamente con el baseline aportado.
- Fixture Electron real preparada: **25 verificaciones obligatorias**, sin ejecución disponible aquí porque el SOURCE_BASELINE carece de `node_modules` (falta Vite).
- `npm run build`: **NO VERIFICADO** (`vite: not found`).

**Cierre:** requiere pruebas Electron/Editor/Player en máquina del usuario y aprobación explícita posterior.
