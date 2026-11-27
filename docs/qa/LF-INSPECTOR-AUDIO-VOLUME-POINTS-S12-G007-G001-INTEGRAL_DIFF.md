# Inventario funcional S12-G007-G001 — alcance y trazabilidad

Último SOURCE_BASELINE autorizado de origen: `LF_TIMELINE_AUDIO_CLIP_FX_UX_S12_G006_G002_INTEGRAL_SOURCE_BASELINE.zip`.

**Producción modificada (solo 3 archivos):**

- `src/components/TemporalResourceInspector.vue`: sección y puntos colapsables, contador, scroll limitado, nombre persistente, limpieza de texto instructivo.
- `src/core/timeline/model.js`: renombrado, nombres al crear y preservación al mover.
- `src/engine/runtime/audio/automation.js`: campo opcional `name` sin migración de puntos existentes.

**QA heredado ajustado:** `scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs` espera ahora `Punto-1` al dar de alta; fixture Electron de G002 usa el índice de Factor posterior al campo Nombre. Ninguna comprobación histórica fue omitida ni rebajada.

**Medios añadidos:** Node S12-G007-G001, fixture y runner Electron S12-G007-G001, documentos, evidencias, ledger.

**Sin cambios:** AudioEngine, buses, Mixer, Preview, Player, TimelinePanel, Cinematics, FX, Assets, escenas, export y sistema global de tooltips. Limpieza global del Inspector sigue PENDIENTE PLANIFICADO.

El inventario exacto y la comparación automática SHA-256 interna se incluyen en `_INVENTORY.md`.
