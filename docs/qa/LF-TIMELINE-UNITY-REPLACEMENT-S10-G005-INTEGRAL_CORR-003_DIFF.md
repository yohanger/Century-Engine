# Inventario — S10-G005 CORR-003

**Baseline de entrada:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G005_INTEGRAL_CORR002_SOURCE_BASELINE.zip`.

**Producción modificada:** `src/components/TimelinePanel.vue` (único indicador global, overlay de viewport, alineación con scroll, alto de dock, estilos consolidados).

**Pruebas históricas modificadas** (sin cambiar semántica de pruebas): `scripts/test-timeline-unity-replacement-s10-g005-corr002.mjs`, `scripts/test-timeline-advanced-direction-s09-g001-integral.mjs`, `scripts/test-timeline-pro-ux-s07-g001-integral.mjs`, `scripts/test-timeline-unity-replacement-s10-g001-corr001.mjs`, `scripts/test-timeline-ux-integration-s04-g004.mjs`. Se actualizan para la nueva ubicación del único indicador y los dos valores visuales usados por las mismas funciones.

**Prueba nueva:** `scripts/test-timeline-unity-replacement-s10-g005-corr003.mjs` (un solo control, límites, scroll, tamaño, teclado, integración y compilación opcional).

**Documentos/evidencia nuevos:** implementación, plan de QA, inventario y tres logs (focus, regresión, bloqueo npm).

**Ledger modificado:** `docs/qa/LevelForge_DB_Ledger.xlsx`, seis hojas, historial conservado.

**Eliminaciones:** ninguna. **Cambios de Player/modelo/Inspector/FilmMaker:** ninguno.

Los conteos exactos y la integridad de ambos ZIP deben comprobarse contra el baseline durante empaquetado; no usar este documento para inferir estado QA cerrado.

## Comparación verificada con la fuente de entrada

- **Nuevos:** 7 archivos (prueba, documentación y evidencia).
- **Modificados:** 7 archivos (componente original, cinco pruebas históricas y ledger).
- **Eliminados:** 0.
- **Inesperados:** 0.
- **SOURCE_BASELINE de salida:** 2326 archivos acumulativos, sin dependencias, builds ni temporales.

CHANGE incluye exactamente 14 archivos afectados. SOURCE_BASELINE conserva 2319 archivos de la fuente de entrada y agrega los siete nuevos. Estas cifras no constituyen QA visual PASS.
