# LF-TIMELINE-PREVIEW-RUNTIME-S11-G001-INTEGRAL — Implementación

**Autorización literal:** «Listo. LF-TIMELINE-PREVIEW-RUNTIME-S11-G001-INTEGRAL autoriza comenzar».
**SOURCE_BASELINE:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G006_INTEGRAL_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO EN FUENTES; NODE PASS PARCIAL; QA LOCAL NO VERIFICADO; NO CERRADO.

## Auditoría

- OBSERVADO: `TimelinePreview` del Editor aplica transformaciones de nodos, cámara y restaura poses; no ejecutaba eventos ni audio desde el transporte Play. El Player disponía ya de `TimelineRunner`, sus claves y el despachador de eventos de audio/comandos.
- CAUSA INMEDIATA: el transporte del Editor avanzaba su propio cabezal mediante `requestAnimationFrame` sin despachar las pistas de eventos.
- RESTRICCIÓN: el Editor no puede ejecutar arbitrariamente scripts, operaciones persistentes ni entradas del juego sin aislarlas.

## Diseño integrado (sin reproductor paralelo)

- `src/components/TimelinePanel.vue`: Play/Pause/Resume/Seek/Stop actualizan una sesión de `TimelineEventPreview` además de la previsualización visual existente. `TimelinePreview` sigue siendo el único aplicador de poses del viewport. Se cancela la sesión al ocultar el dock, activar PlayMode, cambiar escena o proyecto, desactivar Preview o desmontar el componente. Al detener, restaura el estado visual y no aplica de nuevo la pose en el mismo fotograma cero. Se muestran subtítulos de comandos de texto y avisos para acciones no seguras.
- `src/core/timeline/event-preview.js` **nuevo**: adaptador por sesión que reutiliza `TimelineRunner` del Player (`eventsOnly`) para el reloj y el orden de eventos, `getAudio` para el sonido y `Game` (intérprete existente) para comandos declarativos permitidos. Mantiene solo estado efímero (voces creadas, token de cancelación, subtítulo, snapshot meteorológico). No serializa estado nuevo en Timeline ni crea otro motor de eventos.
- `src/engine/runtime/timeline/player.js`: opción de host `eventsOnly` para omitir poses desde el Runner cuando `TimelinePreview` ya las aplica; el Player normal sigue evaluando sus poses y eventos sin cambiar su comportamiento.
- `src/engine/runtime/audio/config.js`, `src/engine/runtime/audio/scene.js`: resolver compartido de recurso de audio por ID/nombre sin crear otros assets ni otra infraestructura de mezcla. El modo de Preview usa el motor de audio existente y detiene exclusivamente las voces propias al parar, Seek o cambiar la sesión.
- Audio: inicio en la clave, `key.duration` y `fadeIn/fadeOut`, Pause/Resume, Seek (reconstrucción desde el offset), Loop y cancelación de cargas tardías comprobados en Node con las interfaces originales simuladas.
- Comandos: lista permitida por inspección recursiva (`text`, `comment`, `switch`, `variable` sin expresiones arbitrarias, `if`/`match` con orígenes controlados, `weather` reversible sin esperas externas). `Game` opera en memoria para estado de variables/interruptores. `weather` afecta al mundo temporal del Editor y se restaura en Stop. La previsualización de `text` expone subtítulo informativo, no diálogo interactivo.

## Límites de seguridad explícitos

**No previsualizable sin contrato adicional:** métodos de scripts, señales arbitrarias, scripts evaluados, guardado/carga persistente, comandos con IO externo, esperas con contexto no reversible, rayos/truenos destructivos, acciones de nodos persistentes o interfaces de diálogo con interacción del jugador. Se muestra advertencia y no se simula un PASS. Esta decisión no altera su comportamiento en el Player.

Las escenas, proyectos, recursos, modelos de pista, Inspector, Timeline de FilmMaker y exportadores no se migran ni se sobreescriben. La recuperación del estado incluye transformaciones de Preview, cámara, sonidos de la sesión y variables meteorológicas que haya modificado el comando reversible.

## Evidencia y pendientes

- Suite específica S11-G001: **21 PASS / 1 SKIP / 0 FAIL** (22 tests). SKIP: compilador Vue ausente.
- Regresión Node disponible Timeline/Cinematics/persistencia: **353 PASS / 14 SKIP / 0 FAIL** (367 tests en 23 suites).
- Las suites Electron y tres suites históricas adicionales requieren paquetes que no están instalados (`three`, `vite`, `jszip`). `npm ci --offline` se bloqueó por `zip-stream@4.1.1` no presente en caché. **No declarar Vite/Electron/Player compilado o QA local PASS**.
- QA auditivo/visual de Editor, Editor ↔ Player real, persistencia y limpieza de la sesión requieren evidencia de usuario en Linux/Electron.

## Continuidad aprobada para corregir — CORR-001 (2026-11-07)

La regla anterior que detenía Preview al ocultar/desmontar Timeline fue identificada como defecto de continuidad y **queda sustituida por el Gate `LF-TIMELINE-PREVIEW-RUNTIME-S11-G001-INTEGRAL_CORR-001`**, autorizado literalmente. La implementación del transporte estable y sus límites se documentan en `LF-TIMELINE-PREVIEW-RUNTIME-S11-G001-INTEGRAL_CORR-001_IMPLEMENTATION.md`. Esta nota preserva el historial de G001; no interpreta el antiguo STOP por visibilidad como comportamiento correcto.
