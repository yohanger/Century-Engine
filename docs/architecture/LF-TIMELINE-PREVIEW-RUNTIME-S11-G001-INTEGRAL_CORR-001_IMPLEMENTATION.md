# LF-TIMELINE-PREVIEW-RUNTIME-S11-G001-INTEGRAL_CORR-001 — implementación

**Autorización literal:** «Listo. LF-TIMELINE-PREVIEW-RUNTIME-S11-G001-INTEGRAL_CORR-001 autoriza comenzar». Fecha: 2026-11-07.

**SOURCE_BASELINE:** `LF_TIMELINE_PREVIEW_RUNTIME_S11_G001_INTEGRAL_SOURCE_BASELINE.zip`.

**Estado:** IMPLEMENTADO EN FUENTES · TEST NODE PASS · COMPILACIÓN Y QA LOCAL NO VERIFICADOS · GATE ABIERTO.

## Auditoría y causa

**Observado:** `TimelinePanel.vue` era propietario de `TimelineEventPreview`, `TimelinePreview`, `requestAnimationFrame` y el tiempo de reproducción. `BottomDock.vue` desmonta la pestaña Timeline al cambiar a Mixer/Proyecto. El `watch` de visibilidad y `onBeforeUnmount` llamaban a `stop()`. En `keyDown`, `clipDragDown`, `pickSegment` y `TimelineCurveEditor` se cancelaba directamente el frame al pulsar, aunque no se hubiera arrastrado nada; no se llamaba a `TimelineEventPreview.pause()`, por lo que audio y reloj quedaban desincronizados. La selección editorial no filtraba el modelo de pistas; la interrupción ocurría en el transporte.

**Causa raíz:** acoplamiento del ciclo de vida del transporte a `TimelinePanel.vue` e interrupciones del reloj sin pausar al ejecutor de eventos.

## Extensión de la arquitectura existente

- **`src/core/timeline/playback-session.js` (nuevo y específico):** una sola sesión temporal por Editor, suministrada a través del `provide`/`inject` de Vue. Reutiliza `TimelineEventPreview`, `TimelinePreview`, sus calendarios, `TimelineRunner`, AudioEngine y restauración previa. No crea un Player, motor de audio ni evaluador nuevos. Su estado `time`, `playing`, `caption` y `previewEnabled` es temporal, compartido y **no se serializa**. Solo programa un bucle `requestAnimationFrame`.
- **`src/App.vue` (propietario estable):** instancia y proporciona la sesión al Editor. Al cambiar proyecto, escena, recurso Timeline, editor, bloquear el proyecto, entrar a PlayMode o abrir Cinematics incompatible, valida el contexto y detiene toda la sesión; el cierre de App llama `dispose()` antes de destruir el Editor. Cambiar la pestaña o el dock no constituye Stop.
- **`src/components/TimelinePanel.vue`:** conserva un solo selector de recursos, Inspector contextual, cabeceras y timeline. Usa las referencias del transporte inyectado; al desmontarse solo libera listeners/ResizeObserver y selección visual. Al remontar refleja reloj, transporte y recurso reales. `preview()` sigue mostrando las poses a través de la misma instancia de `TimelinePreview`, ahora propiedad de App.
- **Edición real:** el clic de selección no detiene Play. Las operaciones de arrastre de clip, clave, segmento, audio o evento hacen una sola pausa sincronizada al superar el umbral de movimiento, antes de mutar. Step, scrub y teclado son cambios explícitos de tiempo y llaman a `pause()` antes de avanzar. La selección de pistas, clips, claves y Curvas no controla Solo/Mute ni filtra Audio/Comandos.
- **`src/components/TimelineCurveEditor.vue`:** un clic en el punto solo selecciona. Las ediciones reales de punto, tangente y Bézier emiten `pause` al iniciar la mutación, reutilizando el transporte del panel.

## Invariantes

1. El transporte no pertenece a `BottomDock`, `TimelinePanel`, `TimelineCurveEditor` ni al contexto visual de docking. No se usan service locators globales.
2. La selección no modifica el tiempo ni el filtro de pistas. El motor `TimelineRunner` sigue evaluando todas las pistas habilitadas.
3. Una edición real puede pausar, pero lo hace mediante `TimelineEventPreview.pause()`, cancelando el frame y pausando voces de la sesión. Stop mantiene la limpieza de voces y la restauración de poses/clima de S11-G001.
4. El `time` actualizado desde un tick no provoca `seek` redundante. Un `seek` explícito sí utiliza el mecanismo de audio y comandos ya implementado.
5. Cambiar proyecto, escena, Timeline, PlayMode o destruir la App termina la sesión. Cambiar de pestaña no.
6. Los comandos no aislables (`weatherThunder`, scripts arbitrarios, métodos externos) siguen bloqueados por el contrato S11-G001. No se amplía su alcance.
7. No se modifica `src/engine/runtime/timeline/player.js`, `src/core/timeline/event-preview.js`, ni la persistencia del proyecto.

## Estado técnico y límites

- Suite nueva: 14 PASS / 1 SKIP / 0 FAIL (15 tests). Incluye ciclo del transporte productivo con fakes deterministas de RAF y Audio Runner, selección previa, selección durante reproducción, navegación, cambio de contexto, Stop, Pause/Resume, Seek, clic frente a arrastre y aislamiento de PlayMode.
- Regresión: 427 tests de 27 suites, 411 PASS / 16 SKIP / 0 FAIL. Omite suites Electron y tres suites antiguas no ejecutables por falta de `vite/jszip`.
- Suite histórica `test-cinematics-viewer-s05-g002.mjs`: **3 fallos PREEXISTENTES** ya detectados al ejecutar esta suite sobre el SOURCE_BASELINE de entrada (20 tests: 17 PASS, 3 FAIL). Se conserva evidencia y no se contabiliza como PASS ni como fallo nuevo de CORR-001.
- `npm ci --offline` bloqueado por ausencia de `zip-stream@4.1.1` en caché. Compilación Vue/Vite/Electron, audio real, Player visual, persistencia local y rendimiento **NO VERIFICADOS**.

Esta corrección sustituye únicamente la regla histórica de G001 que detenía Preview al ocultar/desmontar Timeline. **No altera otras funciones ni contratos persistentes.**
