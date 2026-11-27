# S11-G007-G002 · CORR-001 — Interacción Ctrl y automatización de audio

**Gate:** `LF-TIMELINE-AUDIO-VOLUME-AUTOMATION-S11-G007-G002-INTEGRAL_CORR-001`, autorización literal del 2026-11-08.
**Origen:** ZIP adjunto por el usuario `LF_TIMELINE_AUDIO_VOLUME_AUTOMATION_S11_G007_G002_INTEGRAL_SOURCE_BASELINE(1).zip` (2593 archivos). **Estado:** IMPLEMENTADO; no aprobado ni cerrado.

## Observado antes de cambiar

- `TimelinePanel.vue` tenía doble clic normal sobre claves Audio que creaba puntos mediante `audioVolumeAddFromClip`.
- Las claves tenían cursor `grab`, los tramos/colas cursor de redimensionamiento y los clips temporales un cursor independiente. No existía un estado de Ctrl destinado a controlar el cursor.
- `keyDown` ya reserva Ctrl para selección múltiple y `Ctrl+D` para duplicar. Los arrastres de clips de Cámara/Nodo y las asas de audio siguen siendo mecanismos independientes que no deben alterarse.
- El modelo `editTimelineAudioVolumePoint` ya valida duración, pista bloqueada, duplicados, IDs y rango; no hace falta extenderlo.

## Cambios implementados

- `src/components/TimelinePanel.vue`:
  - Estado de UI no persistente `ctrlOverClips` alimentado por `window.keydown`/`keyup` y `pointerenter` del root. Limpieza en blur, ocultación de documento y desmontaje; sin listeners fuera de Timeline ni estados globales paralelos.
  - Clase temporal sobre `.tlp` y una sola regla CSS local que establece `cursor: default` para claves de Audio, Comandos, Métodos, Cámara y Nodo; además, clips temporales, bake, tramos, asas y controles superpuestos. Al soltar Ctrl se retiran clase y CSS, reapareciendo los cursores anteriores.
  - `audioVolumeAddFromClip` exige `event.ctrlKey` y ausencia de `metaKey`, botón primario, pista Audio editable, acción Play y duración positiva. El doble clic simple deja de generar puntos. Reutiliza la función de creación anterior, Snap y commit/Undo-Redo.
- Fixture existente G002: `Ctrl + doble clic` sustituye al gesto anterior sin cambiar su total de **36** verificaciones.
- Fixture nueva de CORR-001: comprueba cursor computado sobre todas las clases de claves y sobre clip temporal, retorno al estado previo y edición únicamente de Audio. Exige exactamente **32** checks y registra etapas, resultados parciales y excepciones del renderer.
- Nueva regresión Node del CORR-001: evalúa handlers reales de la SFC de Timeline y el modelo existente, sin modificar el motor para complacer expectativas.

## Límites contractuales

Sin cambios en `AudioEngine`, Preview, Player, modelo de automatización, buses, FX, waveforms, Cinematics, escenas, Assets, formatos serializados ni en el runner compartido de Electron. No se cambia el gesto de drag normal. El resto de atajos Ctrl permanece tal como ya estaba implementado.

La suite Node no demuestra el cursor computado de Electron ni la interacción física del ratón. **Electron, compilación y QA visual permanecen NO VERIFICADOS en el entorno de preparación**, por ausencia de Vite instalado; el usuario debe comprobarlos localmente.
