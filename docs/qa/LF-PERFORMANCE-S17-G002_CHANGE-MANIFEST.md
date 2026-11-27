# LevelForge S17-G002 — Manifiesto de entrega

**Gate autorizado:** `LF-PERFORMANCE-S17-G002-INTEGRAL-ADAPTIVE-HIGH-FIDELITY-RD`.

**Contrato:** `LF-PERFORMANCE-S17-CA-001-VISUAL-FIDELITY-FIRST` **RATIFICADO**.

**Comparación:** SOURCE_BASELINE S17-G001 `LF_PERFORMANCE_S17_G001_INTEGRAL_BASELINE_AUDIT_SOURCE_BASELINE.zip`, 3.290 archivos, CRC PASS.

**Diferencias finales esperadas:** 11 NUEVOS (incluido este manifiesto), 5 MODIFICADOS, 0 ELIMINADOS, 3.285 archivos del baseline intactos. SOURCE_BASELINE completo **3.301 archivos**, CHANGE **16 rutas**. Si la comparación binaria cambia, suspender la entrega hasta revisar el resultado. No copiar librerías de Unity, ni node_modules/builds/caches, ni generar scripts `.sh` o SHA separado.

## Nuevos (11)

1. `docs/architecture/LF-PERFORMANCE-S17-CA-001-VISUAL-FIDELITY-FIRST.md`
2. `docs/architecture/LF-PERFORMANCE-S17-G002-ADAPTIVE-SPATIAL-RECONSTRUCTION.md`
3. `docs/qa/LF-PERFORMANCE-S17-G002_EXPERIMENTAL-REPORT.md`
4. `docs/qa/LF-PERFORMANCE-S17-G002_QA-LOCAL.md`
5. `docs/qa/LF-PERFORMANCE-S17-G002_CHANGE-MANIFEST.md`
6. `docs/qa/evidence/LF-PERFORMANCE-S17-G002/01-experimental-contract-node.log`
7. `docs/qa/evidence/LF-PERFORMANCE-S17-G002/02-selected-regression-node.log`
8. `docs/qa/evidence/LF-PERFORMANCE-S17-G002/03-baseline-historical-failure.log`
9. `docs/qa/evidence/LF-PERFORMANCE-S17-G002/04-build-unavailable.log`
10. `docs/qa/evidence/LF-PERFORMANCE-S17-G002/05-confirm-new-and-render-contract.log`
11. `scripts/test-performance-s17-g002-spatial-reconstruction.mjs`

## Modificados (5)

1. `src/engine/runtime/render/upscale.js` — rama experimental espacial sobre el shader existente, sin TAA ni buffers nuevos.
2. `src/engine/runtime/render/look.js` — pasar opción al mismo upscaler y métrica F3 existente.
3. `src/engine/runtime/render/config.js` — normalización opcional, default anterior; descripciones obsoletas TAA corregidas.
4. `src/core/templates/renderParams.js` — selector opt-in en formulario existente.
5. `docs/qa/LevelForge_DB_Ledger.xlsx` — se anexan filas en las seis hojas preservando historial.

## Eliminados, inesperados y datos de usuario

**Eliminados: 0; inesperados: 0.** No cambia Database, SceneGraph, scripts del Player, ViewModel, física, recursos de proyecto ni paquetes. El método por defecto no cambia.

## Aplicación segura

**Recomendado:** conservar el SOURCE_BASELINE S17-G001 y todos los proyectos existentes; descomprimir el SOURCE_BASELINE G002 en una **carpeta nueva** con `package.json` en su raíz. **No** volver a aplicar CHANGE encima de él.

**Alternativa:** copiar el SOURCE_BASELINE S17-G001 intacto a otra carpeta, comparar los cinco archivos locales que se van a sustituir y descomprimir CHANGE sobre esa copia. Si hay cambios locales en cualquiera de ellos, **BLOQUEAR** hasta reconciliar; no sobreescribir a ciegas. Agregar los once archivos nuevos. **No eliminar nada.** Conservar ambas ZIP hasta QA local; se puede descartar únicamente carpeta temporal tras preservar evidencia.

## Comandos y salidas esperadas

Desde la carpeta raíz de LevelForge:

```bash
npm ci
node --test scripts/test-performance-s17-g002-spatial-reconstruction.mjs
node --test scripts/test-performance-s17-g001-profiler-contract.mjs scripts/test-render-pipe-s01.mjs scripts/test-three-s05.mjs
npm run build
npm run electron
```

Primera prueba: **10 PASS, 0 FAIL**. Los tests de otros sistemas pueden tener SKIP por dependencias; la selección ampliada documentada presenta **1 FAIL previo**, no debe llamarse PASS. Build y QA visual: **NO VERIFICADO aquí**, ejecutarlos en el PC del usuario.

## Evidencia de vuelta y criterio de cierre

Retornar salida Node, build, capturas A/B/C nativo/Catmull/Edge a igual escala (tres corridas, 60s cada una), F3 `Reconstrucción` (GPU cuando esté disponible), p50/p95 y RSS, calidad de bordes/texturas/ViewModel, resultado NGM Runtime y `game.log` ante errores. Registrar el modo si hay pérdida de nitidez o halos. Ningún resultado de Node autoriza afirmar mejora de FPS ni cierre del Gate. **IMPLEMENTADO EXPERIMENTAL / QA PENDIENTE / NO CERRADO.**
