# Inventario de cambios · GLOBAL-PLAYBACK-ROOT-CAUSE-G001

**Baseline de comparación:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_FINAL_CLOSURE_G001_SOURCE_BASELINE.zip`.

## Archivos nuevos (7)

1. `scripts/timeline-global-playback-root-cause-g001-red.mjs` — reproducción de regresión; ejecutar expresamente, **esperado 2 PASS/3 FAIL** hasta autorizar y aplicar la corrección.
2. `docs/architecture/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-005-PLAYBACK-INDEPENDENCE.md` — Contract Amendment **propuesto, NO ratificado**.
3. `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-GLOBAL-PLAYBACK-ROOT-CAUSE-G001_AUDIT.md` — hallazgos, bloqueos y QA.
4. `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-GLOBAL-PLAYBACK-ROOT-CAUSE-G001_FILES.md` — inventario.
5. `docs/qa/evidence/LF-TIMELINE-GLOBAL-PLAYBACK-ROOT-CAUSE-G001/node-baseline-31-pass.log` — pruebas históricas que continúan PASS.
6. `docs/qa/evidence/LF-TIMELINE-GLOBAL-PLAYBACK-ROOT-CAUSE-G001/node-regression-2-pass-3-fail.log` — reproducción nueva que demuestra la discrepancia.
7. `docs/qa/evidence/LF-TIMELINE-GLOBAL-PLAYBACK-ROOT-CAUSE-G001/build-no-vite.log` — intento de build sin Vite instalado.

## Archivo modificado (1)

- `docs/qa/LevelForge_DB_Ledger.xlsx` — filas agregadas en `ROADMAP`, `BACKLOG`, `DEPENDENCIES`, `GATES`, `EVIDENCE` y `TRACEABILITY`; historial conservado.

**Eliminados: 0. Cambios inesperados: 0.** No hay cambios en `src/`, en los proyectos del usuario ni en el Player. **CORR-003 y GLOBAL-PLAYBACK-ROOT-CAUSE-G001 permanecen ABIERTOS.**

## Verificación manual acotada

Desde la raíz del proyecto (carpeta que contiene `package.json`):

```bash
node --test scripts/test-camera-orchestration-s15-g005-corr001.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs
node --test scripts/timeline-global-playback-root-cause-g001-red.mjs
```

La primera batería reproduce el contrato anterior y debe arrojar 31 PASS. La segunda **debe arrojar 3 FAIL mientras no se corrija el problema**; no se debe interpretar como una regresión introducida por este CHANGE, sino como el testimonio automatizado del fallo comunicado. No requiere npm para ejecutarse. Compilación Electron y Player quedan pendientes de entorno y autorización para corregir el comportamiento contractual.


## Adenda después de ratificación

CA-005 ratificada el 2026-11-11. El archivo contractual se renombró a su nombre definitivo sin `_PROPOSED`, preservando su contenido y autoridad histórica. Los archivos de implementación y los resultados de QA posteriores están inventariados en el informe CA005-QA.
