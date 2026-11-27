# LevelForge · S13-G008-G003 · Recorte Audio ambos extremos

## Autoridad y baseline

- Gate autorizado literalmente: `Listo. LF-TIMELINE-AUDIO-TRIM-BOTH-ENDS-S13-G008-G003-INTEGRAL autoriza comenzar`.
- Base: `LF_TIMELINE_TEMPORAL_GEOMETRY_S13_G008_G002_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.
- Previos: usuario aporta 32/32 Node, 43/43 Electron y build Editor+Player, y aprueba QA visual de geometría temporal.

## Diseño implementado (EXTEND BEFORE DUPLICATE)

`src/core/timeline/model.js` extiende el modelo con `trimTimelineAudioKey(tl, trackId, keyId, edge, seconds, sourceSeconds)`.

- Borde **izquierdo**: `seconds` es el nuevo instante **absoluto** de Timeline. Se modifica `t`, `offset` según `delta * normalizeSource({pitch}).pitch` y `duration`, preservando el extremo derecho. Para duración histórica cero se usa longitud **real** de la fuente PCM, no el placeholder visual.
- Borde **derecho**: `seconds` es la nueva duración **relativa**. Se reutiliza `resizeTimelineAudioKey` con comprobación de fuente y fundidos. `Home` en el asa derecha conserva la semántica histórica de `duration=0` (fuente completa) cuando no pierde datos.
- Para ambas operaciones: `sourceSeconds` real y finito es indispensable; sin análisis no se edita. Se rechazan valores fuera de Timeline, fuente agotada, pista bloqueada, clave Stop, eliminación silenciosa de puntos de automatización y fundidos que no caben en el tramo.
- Los puntos existentes conservan ID, nombre y **tiempo absoluto** (`t_clave + t_punto`). No se agregan gestores ni otra estructura persistida. La curva resultante sigue siendo relativa al nuevo borde del clip; no se añaden puntos implícitos. El recorte que cruzaría un punto existente se bloquea.
- `src/components/TimelinePanel.vue` amplía la interacción existente con el asa izquierda `audio-duration-head`. El asa derecha delega en el mecanismo validado. `timelineDrag` mantiene umbral, cancelación reversible, Ctrl/Snap y un commit por gesto; al encontrar un límite, vuelve al último estado válido, no al comienzo.
- Waveform PCM lee de `TimelineAudioSource.vue` los mismos `clip`, `duration`, `offset`, `pitch` y `loop`. No hay cambio ni duplicación de decodificador.
- Preview y Player **no cambian**: ya consumen la clave temporal existente, su `offset` y su `duration`. La prueba local debe verificar que en ambas rutas se reproduce exactamente el fragmento editado.

## Conservación

Se conservan audio original, Asset, FX, buses, mezcla, señales de tiempo, proyecto/escenas, IDs, estado persistente y Editor/Player. Sin migraciones, sin refactor externo. Se adapta una prueba histórica que buscaba expresiones literales del asa anterior para que compruebe el nuevo mecanismo y la reversibilidad completa, sin suprimir aserciones.

## Limitaciones del contrato

- La fuente debe estar analizada antes de recortar; no se extrapola la duración PCM ni se utiliza el placeholder de 1 s.
- El recorte izquierdo no elimina puntos existentes: si se atraviesa uno, se bloquea el gesto hasta reubicarlo o eliminarlo deliberadamente.
- Los fundidos quedan íntegros y dentro del tramo. En esta entrega no se crea un editor DSP ni se reinterpretan amplitudes de fundido o interpolación de volumen.
- Undo/Redo y reproducción real necesitan QA de usuario sobre Electron; no se atribuye PASS por pruebas de código fuente.
