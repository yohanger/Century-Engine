# Change manifest — S17-G003-AO-G001

**SOURCE_BASELINE verificado:** `LF_PERFORMANCE_S17_G003_INTEGRAL_AO_AND_DIAGNOSTICS_SOURCE_BASELINE.zip` (3.312 entradas, CRC PASS). **Gate autorizado:** `LF-PERFORMANCE-S17-G003-AO-G001-INTEGRAL-COST-DIAGNOSIS`.

## Cambios sobre la base

**Modificados (4):**
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `src/components/PerfPanel.vue`
- `src/engine/runtime/render/look.js`
- `src/engine/runtime/render/perf.js`

**Nuevos (9):**
- `docs/architecture/LF-PERFORMANCE-S17-G003-AO-G001-INTEGRAL-COST-DIAGNOSIS.md`
- `docs/qa/LF-PERFORMANCE-S17-G003-AO-G001_CHANGE-MANIFEST.md`
- `docs/qa/LF-PERFORMANCE-S17-G003-AO-G001_QA-LOCAL.md`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G001/01-new-tests.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G001/02-regression-current.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G001/03-baseline-camera-fail.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G001/04-build-environment.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G001/05-focal-final.log`
- `scripts/test-performance-s17-g003-ao-g001-cost-diagnosis.mjs`

**Eliminados (0):** ninguno. No hay cambios inesperados. 

**Comprobaciones:** 12/12 nuevas Node PASS; focal 42/42 PASS; regresión ampliada 85 PASS/1 FAIL previo/3 SKIP. La prueba histórica de cámara que falla busca `src/engine/runtime/player/fps/api.js`, retirada en S16-G008, y también falla en SOURCE_BASELINE anterior. `npm run build` no pudo ejecutar Vite (dependencia no instalada en este entorno). QA real de GPU/Electron/NGM Runtime pendiente. No hay cambios de los shaders GTAO ni sus muestras.

**Instalación:** el SOURCE_BASELINE completo se extrae en carpeta nueva; no aplicarle CHANGE también. Para CHANGE, utilizar una copia intacta de G003, comparar cambios locales antes de reemplazar los 4 modificados y añadir los nuevos. Conservar originales y proyectos de usuario. Ejecución y evidencia: `docs/qa/LF-PERFORMANCE-S17-G003-AO-G001_QA-LOCAL.md`.

**Excluidos:** node_modules, distribuciones, temporales y cachés. Sin scripts `.sh` ni SHA-256 separado.
