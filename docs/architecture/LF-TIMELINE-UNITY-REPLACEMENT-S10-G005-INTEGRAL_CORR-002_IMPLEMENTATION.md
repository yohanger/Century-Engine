# S10-G005 CORR-002 · Implementación y límites contractuales

**Gate autorizado literalmente:** `LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL_CORR-002`, 2026-11-07.
**Base:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G005_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO PARCIALMENTE EN FUENTES · QA LOCAL PENDIENTE · NO CERRADO.

## Auditoría observada

- `TimelinePanel.vue`: el límite de `timeline.duration` utiliza `beginDurationResize` y el mismo dato editable por la opción de duración; el indicador anterior era un círculo amarillo sin línea vertical de alcance.
- `TemporalResourceInspector.vue` utiliza `keyParams(track)` para claves de Timeline. `model.js` identifica `audio` `action=play` como clave con `duration`: `0` significa reproducir archivo completo; `>0` fija parada automática. Los comandos (`commands`, incluida Naturaleza) y métodos (`method`) solamente tienen `t` y sus parámetros, **no una duración propia**.
- El contrato aprobado `LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL_CONTRACT.md` declara esos eventos discretos. El ancho `keyWidth()` en pistas de comandos se deriva de un límite estético o de la siguiente clave; NO es una duración editable del evento.
- Las etiquetas de suavizado proceden de `engine/runtime/anim/model.js`, compartido con otros módulos: no se debe renombrar globalmente el contrato/selector de FilmMaker para corregir el Inspector de Timeline.

## Cambios realizados

1. **Límite `]`:** el botón `.duration-grip` muestra la forma de corchete derecho y se alinea con una guía vertical `.duration-boundary`. Ambos usan `tl.duration * zoom` y mantienen el arrastre, teclado y `commit()` originales; no se crea un estado de duración nuevo. La guía no recibe eventos de puntero.
2. **Audio:** `resizeTimelineAudioKey(timeline, trackId, keyId, seconds)` extiende las operaciones originales del modelo, sin nuevos campos. Solo acepta pistas audio desbloqueadas y claves `action=play`; valida límites y valores finitos. El asa exterior `audio-duration-tail` edita ese mismo `key.duration`, lo selecciona en Inspector y registra Undo/Redo mediante `commit`. Arrastrar con `duration=0` permite fijar una duración, pero **un clic sin desplazamiento no cambia** la reproducción completa. La tecla `Home` restablece `0`. La longitud visible de Audio usa `duration` real cuando es positiva; cuando es cero, la representación provisional para acceder al asa no constituye un intervalo persistido. `timelineMinDuration()` reconoce el final de un Audio con parada programada, y el Inspector de duración general usa ahora el mismo límite para impedir recortes silenciosos.
3. **Etiquetas en inglés:** `core/timeline/model.js` exporta las mismas IDs de interpolación y suavizado con nombres `Ease In Out`, `Linear`, `Ease In`, `Ease Out`, `Bezier`, `Back`, `Bounce`, `Elastic`, `Cut`, `Nearest`, `Cubic`, `Linear Angle`, `Cubic Angle`. La normalización y los algoritmos no cambian; el catálogo global `engine/runtime/anim/model.js` no se modifica.
4. **Regresión:** el test histórico S04 sobre ancho visual se actualiza para distinguir Audio real de etiquetas discretas; el test histórico CORR001 sobre punto amarillo se actualiza por el nuevo asa, conservando su validación del mismo mecanismo de arrastre.

## Bloqueo específico de Comandos, Naturaleza y Métodos

**PENDIENTE · BLOQUEO CONTRACTUAL.** No se implementa un asa de **duración independiente** en eventos sin campo `duration` persistente. Ni el Inspector ni el modelo del baseline proporcionan tal propiedad; agregarla y dotarla de significado de ejecución contradice G003. Tampoco se adelanta el instante `t` de la clave siguiente para simular duración. Para completar esta parte del deseo del usuario hay que definir y aprobar un **Contract Amendment** (por ejemplo, intervalo ocupado sin ejecución repetida, o activación continua) antes de implementarla. El usuario no autorizó ese cambio semántico mediante el Gate de corrección.

## Exclusiones y continuidad

No se modifica `src/engine/runtime/timeline/player.js`, `eval.js`, FilmMaker, Cinematics ni los proyectos del usuario. Se conserva la estructura fija/desplazable G001, selección múltiple G002, edición G003, bloqueos y marcadores G004 y Curvas G005. Editor y Player deben ser verificados en equipo local; pruebas Node no acreditan QA visual.
