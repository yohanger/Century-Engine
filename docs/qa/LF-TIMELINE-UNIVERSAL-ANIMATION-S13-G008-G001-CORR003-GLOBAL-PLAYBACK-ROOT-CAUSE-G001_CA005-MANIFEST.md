# CA-005 · Manifiesto de diferencias y extracción

**Base comparada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_GLOBAL_PLAYBACK_ROOT_CAUSE_G001_SOURCE_BASELINE.zip`.

## Archivos nuevos

- `docs/architecture/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-005-PLAYBACK-INDEPENDENCE.md`
- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-GLOBAL-PLAYBACK-ROOT-CAUSE-G001_CA005-MANIFEST.md`
- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-GLOBAL-PLAYBACK-ROOT-CAUSE-G001_CA005-QA.md`
- `docs/qa/evidence/LF-TIMELINE-GLOBAL-PLAYBACK-ROOT-CAUSE-G001/build-ca005-vite-absent.log`
- `docs/qa/evidence/LF-TIMELINE-GLOBAL-PLAYBACK-ROOT-CAUSE-G001/node-ca005-regression-309-pass.log`
- `scripts/test-timeline-global-playback-ca005-g001.mjs`

## Archivos modificados

- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-GLOBAL-PLAYBACK-ROOT-CAUSE-G001_AUDIT.md`
- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-GLOBAL-PLAYBACK-ROOT-CAUSE-G001_FILES.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-camera-orchestration-s15-g005-corr001.mjs`
- `scripts/test-camera-orchestration-s15-g007.mjs`
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs`
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-owners.mjs`
- `scripts/timeline-global-playback-root-cause-g001-red.mjs`
- `src/App.vue`
- `src/components/TimelinePanel.vue`
- `src/core/editor/selection.js`
- `src/core/timeline/playback-session.js`
- `src/core/timeline/preview.js`
- `src/engine/runtime/events/play-camera.js`

## Archivo sustituido por cambio de nombre

- `docs/architecture/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-005-PLAYBACK-INDEPENDENCE_PROPOSED.md`

## Instalación segura

1. Conservar intacto el SOURCE_BASELINE anterior como respaldo. No sobrescribir una copia con cambios locales sin comparar.
2. Opción recomendada: extraer el nuevo SOURCE_BASELINE completo en carpeta separada y abrirlo desde su `package.json`. No aplicar CHANGE sobre esa copia.
3. Opción incremental: extraer CHANGE en una copia de la raíz del baseline anterior; conservar estructura y reemplazar solo las rutas indicadas.
4. En la opción incremental, eliminar únicamente `docs/architecture/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-005-PLAYBACK-INDEPENDENCE_PROPOSED.md` (ahora sustituido por el contrato ratificado sin `_PROPOSED`), después de comprobar que el nuevo archivo existe.
5. No tocar proyectos de usuario, `Assets/` ajenos al baseline, `node_modules` locales, configuraciones personales ni exportaciones; no incorporar el proyecto de prueba al repositorio.
6. Ejecutar las pruebas y devolver evidencia de Electron y Player conforme al informe CA005-QA. No cerrar CORR-003 antes del QA local.

**Exclusiones:** `node_modules`, `dist`, `build`, `release`, caches y temporales; sin SHA-256 separado ni scripts `.sh`.
