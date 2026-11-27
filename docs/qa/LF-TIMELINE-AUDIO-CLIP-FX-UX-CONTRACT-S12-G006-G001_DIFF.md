# DIFF — S12-G006-G001 · Gate estrictamente documental

**Baseline:** `LF_TIMELINE_AUDIO_VOLUME_AUTOMATION_S11_G007_G002_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.

## Única modificación de archivo anterior

- `docs/qa/LevelForge_DB_Ledger.xlsx`: filas añadidas en ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY. Se preservan celdas históricas, tablas y fórmulas.

## Archivos nuevos permitidos

- `docs/architecture/LF-TIMELINE-AUDIO-CLIP-FX-UX-CONTRACT-S12-G006-G001_AMENDMENT.md` — propuesta CA-001 y supersesión condicionada a aprobación.
- `docs/qa/LF-TIMELINE-AUDIO-CLIP-FX-UX-CONTRACT-S12-G006-G001_QA.md` — auditoría, aceptación y separación de evidencias.
- `docs/qa/LF-TIMELINE-AUDIO-CLIP-FX-UX-CONTRACT-S12-G006-G001_DIFF.md` — este diff.
- `docs/qa/LF-TIMELINE-AUDIO-CLIP-FX-UX-CONTRACT-S12-G006-G001_INVENTORY.md` — inventario de CHANGE y SOURCE_BASELINE.
- `docs/qa/evidence/LF_S12_G006_G001_READONLY_AUDIT.md` — recorrido de datos y contratos con conclusiones.
- `docs/qa/evidence/LF_S12_G006_G001_READONLY_NODE.log` — salida Node sin modificación de código.

## Expresamente intactos

- Todo `src/`, `scripts/`, `package.json` y los assets/escenas; AudioEngine, Player/Preview, Inspector, Mixer, FilmMaker, Timeline, FX y guardado/exportación. Ningún archivo eliminado.
- No se crea test o fixture Electron para un cambio **solo documental**. El futuro Gate de implementación especificará y entregará los medios QA necesarios.

**El Amendment aún no está aprobado**; los contratos S11-G005/G006 siguen vigentes hasta decisión del usuario.
