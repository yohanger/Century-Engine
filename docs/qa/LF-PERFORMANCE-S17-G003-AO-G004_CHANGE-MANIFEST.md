# Manifiesto — LF-PERFORMANCE-S17-G003-AO-G004-INTEGRAL-COMPOSITE-OPTIMIZATION

**Fuente vinculante:** `LF_PERFORMANCE_S17_G003_AO_G003_INTEGRAL_COMPOSITE_SCENE_DIAGNOSIS_SOURCE_BASELINE.zip` (3.338 archivos).

**Gate:** autorizado exactamente por el usuario el 13 de noviembre de 2026. Se mantiene la autoridad de CA-001 y CA-002, las dependencias G001/G002/G003 y el proyecto 0.26.13 existente.

## Archivos modificados (4)

- `src/engine/runtime/render/look.js`: instala de forma local la composición GTAO fusionada bajo opt-in de Stats, con material diferido, restauración y eliminación de recursos.
- `src/engine/runtime/render/perf.js`: selector experimental efímero y métrica `AO · fusión` sin doble contabilización.
- `src/components/PerfPanel.vue`: selector original/fusionada junto a AO 100/75/50 %; cierre devuelve defaults.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: seis hojas sincronizadas con historial preservado, estados de QA separados y evidencias reales.

## Archivos nuevos (7)

- `scripts/test-performance-s17-g003-ao-g004-composite-optimization.mjs`
- `docs/architecture/LF-PERFORMANCE-S17-G003-AO-G004-INTEGRAL-COMPOSITE-OPTIMIZATION.md`
- `docs/qa/LF-PERFORMANCE-S17-G003-AO-G004_QA-LOCAL.md`
- `docs/qa/LF-PERFORMANCE-S17-G003-AO-G004_CHANGE-MANIFEST.md`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G004-INTEGRAL-COMPOSITE-OPTIMIZATION/01-new-tests.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G004-INTEGRAL-COMPOSITE-OPTIMIZATION/02-focal-regression.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G004-INTEGRAL-COMPOSITE-OPTIMIZATION/03-build-unavailable.log`

## Resultado y estados

- Nuevos: **7**; modificados: **4**; eliminados: **0**; cambios inesperados: **0**.
- `node --check` PASS en los dos archivos JS de producción y el test.
- Pruebas nuevas: **14/14 PASS**. Regresión focal: **79/79 PASS**, 0 FAIL.
- `npm run build`: **NO VERIFICADA**, falta Vite en entorno asistido. No se instaló ni se generó `node_modules`.
- WebGL2 y GLSL en GPU real, calidad A/B, FPS/p50/p95, Electron y AppImage: **NO VERIFICADOS**.
- G004: **IMPLEMENTADO EXPERIMENTAL**, NO APROBADO, NO CERRADO. G002/G003 conservan su estado de QA histórico sin cierre anticipado.

## Entrega y despliegue

`CHANGE` incluye únicamente esos once archivos; `SOURCE_BASELINE` contiene 3.345 archivos acumulativos. Nunca extraer CHANGE encima del SOURCE_BASELINE recién descargado. Si se utiliza CHANGE, primero comparar con una copia intacta de G003 y conservar los proyectos/archivos locales.

No se modificaron librerías de Unity, add-ons de Three.js ni contratos de seguridad de exportación. No existen archivos eliminados ni scripts `.sh` de verificación ni SHA-256 separado.
