# Inventario comparado — LF-FILMMAKER-EDIT-WORKSPACE-S01-G001

**BASELINE DE COMPARACIÓN:** `LevelForge_FILMMAKER_CAMERA_NAV_DEVICE_G001_SOURCE_BASELINE.zip` — 2.197 archivos.
**Fecha:** 2026-11-05.
**Contrato de entrega:** exactamente dos ZIP, CHANGE y SOURCE_BASELINE acumulado. No generar SHA-256 separado ni scripts `.sh`.

## Creados (6)

1. `docs/architecture/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001_IMPLEMENTATION.md` — auditoría y mecanismo.
2. `docs/qa/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001_QA.md` — instrucciones de QA local.
3. `docs/qa/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001_FILES.md` — inventario de cambios.
4. `docs/qa/evidence/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001/node-20261105.log` — salida automatizada exacta.
5. `docs/qa/evidence/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001/source-audit-20261105.md` — auditoría de fuente y prerrequisito visual.
6. `scripts/test-filmmaker-edit-workspace-s01-g001.mjs` — nueve regresiones del Gate y CSS previo.

## Modificados (4)

1. `src/filmmaker/FilmApp.vue` — altura inicial, modo reversible Ampliar/Restaurar, ancho de docks, visibilidad de icono del Gate previo autorizado.
2. `src/components/Splitter.vue` — flechas arriba/abajo en separadores verticales en píxeles, sin afectar otros usos.
3. `scripts/test-filmmaker-ux-s01-g002-corr001.mjs` — el test viejo de 205 px pasa de coincidencia literal de fórmula a la fórmula equivalante nueva, preservando el invariante de viewport sin eliminar otras aserciones.
4. `docs/qa/LevelForge_DB_Ledger.xlsx` — ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY actualizados, 12 tablas conservadas.

## Eliminados (0)

Ninguno. **Cambios inesperados: cero.** Archivos excluidos: `node_modules`, `dist*`, `build*`, cachés, temporales. SOURCE_BASELINE final contiene **2.203 archivos** y es la base acumulada del siguiente Gate, sin declarar QA ni cierre del presente.

## Evidencia y límites

- Regresiones 110 Node: **108 PASS / 2 SKIP / 0 FAIL**; SKIP por `esbuild` y Electron/Vite faltantes aquí.
- Test visual WebGL anterior que requiere Vite no se ejecutó con éxito en este contenedor; requiere dependencias locales y Electron real.
- **Vite BUILD y QA local Electron del Gate: NO VERIFICADOS.** Icono Laptop/PC corregido en fuentes bajo el Gate previo, QA visual PENDIENTE.
- No se modifica `.nfm`, `NleTimeline.vue`, sesión de película, cámara, Android, Player, Cinematics ni otros Sprints.

## Cierre post-QA (2026-11-05)

Tras la entrega original del G001, la aprobación del usuario autoriza cierre documental. Archivos **nuevos en el CHANGE de cierre**: `docs/qa/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001_CLOSE.md`, `docs/qa/evidence/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001/user-local-node-vite-20261105.txt` y `docs/qa/evidence/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001/approval-and-close-20261105.md`. Archivos **modificados por cierre**: este inventario, `docs/architecture/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001_IMPLEMENTATION.md`, `docs/qa/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001_QA.md` y `docs/qa/LevelForge_DB_Ledger.xlsx`. Archivos **eliminados: 0**; código de runtime **modificado por cierre: 0**. Referencia de comparación: SOURCE_BASELINE completo del G001 entregado, 2.203 archivos. El SOURCE_BASELINE de cierre contiene 2.206 archivos. La aprobación de G001 no cierra el Gate independiente NAV-DEVICE G001 ni el Sprint completo.
