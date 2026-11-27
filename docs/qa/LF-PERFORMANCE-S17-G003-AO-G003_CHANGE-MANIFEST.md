# Manifest de entrega — S17-G003 AO-G003

## Autoridad y comparación

Gate `LF-PERFORMANCE-S17-G003-AO-G003-INTEGRAL-COMPOSITE-SCENE-DIAGNOSIS` autorizado. Comparación byte a byte frente a `LF_PERFORMANCE_S17_G003_AO_G002_INTEGRAL_OPTIMIZATION_SOURCE_BASELINE.zip` (3.330 archivos).

**Nuevos (8):**

1. `docs/architecture/LF-PERFORMANCE-S17-G003-AO-G003-INTEGRAL-COMPOSITE-SCENE-DIAGNOSIS.md`
2. `docs/qa/LF-PERFORMANCE-S17-G003-AO-G003_QA-LOCAL.md`
3. `docs/qa/LF-PERFORMANCE-S17-G003-AO-G003_CHANGE-MANIFEST.md`
4. `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G003/00-preflight-user-evidence.md`
5. `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G003/01-new-tests.log`
6. `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G003/02-focal-regression.log`
7. `docs/qa/evidence/LF-PERFORMANCE-S17-G003-AO-G003/03-build-unavailable.log`
8. `scripts/test-performance-s17-g003-ao-g003-composite-scene-diagnosis.mjs`

**Modificados (4):**

1. `src/engine/runtime/render/perf.js`
2. `src/engine/runtime/render/look.js`
3. `src/components/PerfPanel.vue`
4. `docs/qa/LevelForge_DB_Ledger.xlsx`

**Eliminados:** 0. **Cambios inesperados:** 0. **SOURCE_BASELINE resultante:** 3.338 archivos.

## Estado

IMPLEMENTADO; 11/11 nuevos Node PASS; 65/65 regresión focal PASS; sintaxis `node --check` PASS. Vite ausente en entorno asistido: `npm run build` NO VERIFICADO. QA GPU físico, Electron visual, AppImage NGME-STATS y calidad comparada pendientes. El Gate no está APROBADO ni CERRADO.

## Aplicación de la entrega

- **A. CHANGE:** solo los 12 archivos afectados; extraer exclusivamente sobre una **copia comparada, intacta** del SOURCE_BASELINE AO-G002. No reemplazar cambios locales sin hacer primero diff.
- **B. SOURCE_BASELINE:** proyecto completo y acumulativo, extraer en carpeta NUEVA. Es la base técnica del Gate siguiente una vez superado QA; no mezclar con bases anteriores.
- Conservar el ZIP AO-G002 y las escenas/proyectos del usuario. No hay eliminaciones ni operaciones manuales sobre otros archivos. No incluir `node_modules`, builds, cachés ni temporales.
