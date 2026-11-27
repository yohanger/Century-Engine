# S17-G001 — Manifiesto de entrega LevelForge

**Base de comparación:** `LF_S13_S15_S16_INTEGRAL_CLOSURE_G001_SOURCE_BASELINE.zip` (3.280 archivos, CRC PASS). **Gate:** `LF-PERFORMANCE-S17-G001-INTEGRAL-BASELINE-AUDIT`. Fecha: 2026-11-12.

**Diferencias finales:** **10 NUEVOS, 1 MODIFICADO (Excel), 0 ELIMINADOS, 3.279 ARCHIVOS EXISTENTES INTACTOS**. El SOURCE_BASELINE resultante contiene **3.290 archivos**; CHANGE contiene **11 rutas**. No se ha modificado código de producción, fuentes de Editor/Player, escenas, recursos, material de proyectos ni dependencias.

## Archivos nuevos (10)

1. `docs/architecture/LF-PERFORMANCE-S17-G001-OWNERSHIP-AND-HOTPATH-AUDIT.md`
2. `docs/qa/LF-PERFORMANCE-S17-G001-INTEGRAL-BASELINE-AUDIT.md`
3. `docs/qa/LF-PERFORMANCE-S17-G001_QA-LOCAL.md`
4. `docs/qa/LF-PERFORMANCE-S17-G001_CHANGE-MANIFEST.md`
5. `docs/qa/evidence/LF-PERFORMANCE-S17-G001/01-profiler-node.log`
6. `docs/qa/evidence/LF-PERFORMANCE-S17-G001/02-render-node.log`
7. `docs/qa/evidence/LF-PERFORMANCE-S17-G001/03-s16-regression.log`
8. `docs/qa/evidence/LF-PERFORMANCE-S17-G001/04-vfx-cpu-isolated.log`
9. `docs/qa/evidence/LF-PERFORMANCE-S17-G001/05-build-unavailable.log`
10. `scripts/test-performance-s17-g001-profiler-contract.mjs`

## Archivo modificado (1)

- `docs/qa/LevelForge_DB_Ledger.xlsx`: las seis hojas **ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY**; sólo filas añadidas, sin borrar historial. No implica QA local PASS.

## Archivos eliminados e inesperados

- Eliminados: **0**.
- Cambios inesperados: **0**, conforme a comparación binaria con el ZIP de entrada.
- No incluir `node_modules`, compilados, cachés, temporales, scripts `.sh` ni SHA separado.

## Aplicación

**Recomendado:** descomprimir `SOURCE_BASELINE` en una carpeta nueva y conservar la carpeta anterior y los proyectos del usuario. No extraer `CHANGE` sobre esa misma carpeta ya actualizada.

**Alternativa:** extraer `CHANGE` encima de una **copia intacta y comparada** del SOURCE_BASELINE de cierre S13/S15/S16: incorporar las 10 rutas nuevas y reemplazar exclusivamente el Excel. No eliminar nada. Si el Excel o las fuentes locales han cambiado respecto al baseline, **BLOQUEAR la sustitución** hasta comparar y reconciliar.

## Comandos de QA desde la raíz con package.json

```bash
npm ci
node --test scripts/test-performance-s17-g001-profiler-contract.mjs
node --test scripts/test-render-pipe-s01.mjs scripts/test-three-s01.mjs
node scripts/bench-vfx-renderer-consolidation-s00-g001.mjs
npm run build
npm run electron
```

Esperado del test nuevo: 9 PASS / 0 FAIL. El bench VFX no produce FPS; reporta CPU aislada por 600 pasos. El build requiere Vite local. Abrir F3 en Editor (Ver ▸ Rendimiento), realizar y documentar escenarios E0/P0/P1/P2 en la copia QA, tomar muestras y capturas indicadas en QA-LOCAL. Devolver salidas literales, capturas, condiciones técnicas y resultado en NGM Runtime. Conservar ambos ZIP y los proyectos existentes; eliminar únicamente la carpeta temporal de QA si se desea, después de guardar evidencias.
