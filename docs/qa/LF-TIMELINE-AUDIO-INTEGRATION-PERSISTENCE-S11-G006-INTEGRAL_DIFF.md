# DIFF — LF-TIMELINE-AUDIO-INTEGRATION-PERSISTENCE-S11-G006-INTEGRAL

**Base:** SOURCE_BASELINE G005 CORR-001. Comparación byte a byte; inventario separado en `..._FILES.md`.

## Código existente extendido
- `src/core/buildList.js`: conserva todas las comprobaciones de escenas/modelos/VFX. Añade validación de claves `audio/play` con `resolveAudioClip` y `files.has`, excluye pistas silenciadas, Stop y FilmMaker con procedencia válida. Emite errores contextualizados antes de `writePackage`; no cambia el proyecto persistido.
- `src/core/state/game.js` y `src/engine/runtime/package/{format,host,game}.js`: SIN CAMBIOS. Conservan la serialización y el Player existentes.

## Archivos nuevos
- Suite `scripts/test-timeline-audio-integration-persistence-s11-g006.mjs`.
- Fixture `scripts/fixtures/editor/timeline-audio-integration-persistence-s11-g006.html` y test Electron `scripts/test-timeline-audio-integration-persistence-s11-g006-electron.mjs`. Usa runner existente, no crea otro.
- Documentación de implementación, QA, DIFF, inventario y evidencias específicas del Gate.
- Cierre documental separado del resultado acumulado G005 CORR-001, aprobado por usuario.

## Ledger
Actualizaciones selectivas de las dos filas G005 y G005 CORR-001 en ROADMAP, BACKLOG, DEPENDENCIES, GATES y TRACEABILITY; se agrega nueva evidencia de aprobación a EVIDENCE. Se añaden filas G006 a las seis hojas y cinco evidencias nuevas. No se cambian registros antiguos ajenos a estas decisiones; se conservan seis hojas y doce tablas existentes.

**Sin archivos de producción duplicados ni nuevos gestores, motores, scripts `.sh` o cambios a nodos/Jolt/UI/FilmMaker.**
