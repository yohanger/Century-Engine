# LevelForge — S12-G004 · Inventario comparado

Gate: `LF-TIMELINE-COMMAND-MENU-ICONS-S12-G004-INTEGRAL`.
Fuente: `LF_TIMELINE_ZOOM_WAVEFORM_S12_G003_INTEGRAL_SOURCE_BASELINE.zip` (2518 archivos).

- **Modificados:** 3.
- **Nuevos:** 14.
- **Eliminados:** 0.
- **Idénticos al SOURCE_BASELINE anterior:** 2515.
- **CHANGE incremental:** 17 archivos.
- **SOURCE_BASELINE completo:** 2532 archivos.
- **Cambios inesperados:** ninguno.
- Excluidos `node_modules`, builds, cachés, `.git` y temporales. No se crea `.sh` ni archivo separado SHA-256.

## Modificados

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `src/components/Icon.vue`
- `src/components/TimelinePanel.vue`

## Nuevos

- `docs/architecture/LF-TIMELINE-COMMAND-MENU-ICONS-S12-G004-INTEGRAL_IMPLEMENTATION.md`
- `docs/licenses/BOOTSTRAP_ICONS_1.13.2_MIT.txt`
- `docs/qa/LF-TIMELINE-COMMAND-MENU-ICONS-S12-G004_DIFF.md`
- `docs/qa/LF-TIMELINE-COMMAND-MENU-ICONS-S12-G004_INVENTORY.md`
- `docs/qa/LF-TIMELINE-COMMAND-MENU-ICONS-S12-G004_QA.md`
- `docs/qa/evidence/LF_S12_G004_BUILD_ENV.log`
- `docs/qa/evidence/LF_S12_G004_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S12_G004_G003_USER_QA_DECLARATION.md`
- `docs/qa/evidence/LF_S12_G004_NODE_FOCAL.log`
- `docs/qa/evidence/LF_S12_G004_NODE_REGRESSION_COMPATIBLE.log`
- `docs/qa/evidence/LF_S12_G004_NODE_REGRESSION_EXTENDED.log`
- `scripts/fixtures/editor/timeline-command-menu-icons-s12-g004.html`
- `scripts/test-timeline-command-menu-icons-s12-g004-electron.mjs`
- `scripts/test-timeline-command-menu-icons-s12-g004.mjs`

## Eliminados

Ninguno.

## QA

- Node focal: 11 PASS, 0 FAIL, 0 SKIP.
- Node compatible: 109 PASS, 2 SKIP, 0 FAIL.
- Node ampliado: 109 PASS, 2 SKIP, 2 FAIL de dependencia/aislamiento históricos, no reportar PASS.
- Electron G004: NO VERIFICADO (falta Vite antes de fixture).
- Compilación Editor/Player: NO VERIFICADA (`vite: not found`).
- Usuario: QA local G004 PENDIENTE; no APROBADO/CERRADO.
- G003: APROBADO por declaración del usuario (QA local), sin inventar Electron/build PASS.
- Ledger: seis hojas sincronizadas; valores históricos preservados; doce tablas conservadas.

La modificación no cambia el modelo de Timeline, archivos guardados, catálogo meteorológico, Player, escenas, FX, Mixer ni AudioEngine.
