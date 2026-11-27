# LF-INSPECTOR-AUDIO-VOLUME-POINTS-S12-G007-G001-INTEGRAL — Contrato implementado

Autorización literal recibida 2026-11-08. Baseline de entrada: `LF_TIMELINE_AUDIO_CLIP_FX_UX_S12_G006_G002_INTEGRAL_SOURCE_BASELINE.zip`.

## Resultado autorizado

- Apartado **Automatización de volumen** con encabezado colapsable, contador y acción Añadir; el estado de expansión es exclusivamente local al Inspector.
- Cada punto tiene un encabezado propio expandible/contraíble, etiqueta derivada de `point.name` o `Punto-N` y campos Nombre, Tiempo (s), Factor, Eliminar al expandir.
- Alta de puntos: nombre persistente nuevo `Punto-N`, sin colisiones con nombres usados o etiquetas de puntos antiguos; el punto creado desde Inspector queda expandido.
- Renombrar usa `editTimelineAudioVolumePoint(..., 'rename', { id, name })`, valida nombres y colisiones, respeta bloqueo y genera un solo commit de historial. Límite 48 caracteres, sin controles; no migra datos legados por lectura.
- Las operaciones existentes `move`, `add`, `remove`, normalización y serialización conservan nombres personalizados, sin modificar `id`, `t` ni `value`. Duplicar una clave mantiene puntos y nombres por copia profunda; Undo/Redo usa `changed()` y `commit()` existentes.
- Con **5 puntos o más** se activa una lista con altura máxima de 144 px y scroll interno `overflow-y:auto`; no se modifica el máximo de 64 puntos por clip.
- Se retira el párrafo instructivo del apartado; se conserva solo la advertencia de validación por duración obligatoria.

## Continuidad de datos

Formato histórico `{id,t,value}` continúa válido: `normalizeVolumeAutomation` no asigna `name` si el dato no existe. Abrir o contraer no cambia un proyecto. Un punto sin nombre recibe solo el rótulo visual `Punto-N` según su posición visible; para fijarlo explícitamente el usuario puede renombrarlo. Los nombres **personalizados** permanecen asociados al ID aun después de mover/reordenar.

El modelo conserva volumen base, interpolación lineal, Snap, duración cero, rechazo de operaciones en pista bloqueada, límites y máximos anteriores.

## Archivos bajo contrato

- `src/components/TemporalResourceInspector.vue` — apartado de volumen, estados locales, edición persistente, accesibilidad y CSS.
- `src/core/timeline/model.js` — `editTimelineAudioVolumePoint` con `rename`, nombres nuevos y preservación durante `move`.
- `src/engine/runtime/audio/automation.js` — normalización opcional del campo `name`.
- Test heredado G002 y fixture heredada G002 ajustados para el nuevo nombre/orden de campos, sin relajar ni retirar aserciones previas.
- Suite Node G001 + fixture/runner Electron G001, QA, evidencia y ledger.

**Fuera de alcance:** no se toca AudioEngine, mixer, FX, `event-preview.js`, Player, runtime, FilmMaker, Assets, TimelinePanel ni tooltips globales. La limpieza global del Inspector será un Gate posterior distinto.

**Estado:** IMPLEMENTADO, tests Node PASS, Electron y compilación NO VERIFICADOS, QA local PENDIENTE, no APROBADO/CERRADO.
