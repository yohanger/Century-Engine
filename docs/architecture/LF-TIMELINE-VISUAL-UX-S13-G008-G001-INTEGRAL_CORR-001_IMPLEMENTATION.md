# LevelForge · S13-G008-G001 CORR-001 — Fixture con tema real

**Autorización literal:** `Listo. LF-TIMELINE-VISUAL-UX-S13-G008-G001-INTEGRAL_CORR-001 autoriza comenzar` (2026-11-08).

**SOURCE_BASELINE válido:** `LF_TIMELINE_VISUAL_UX_S13_G008_G001_INTEGRAL_SOURCE_BASELINE.zip` (2.771 archivos; integridad comprobada). La ruta/nombre local de trabajo del usuario no prueba el origen de la instalación; el inventario se compara contra el ZIP acumulado de G008-G001, no contra el nombre de la carpeta en su consola.

## Evidencia y diagnóstico

**OBSERVADO — QA del usuario:** Node VIS-01..17 = 17 PASS, 0 FAIL. En Electron se ejecutan las 54 comprobaciones: 53 PASS y 1 FAIL, «Encabezado conserva una línea divisora». El resultado posterior «Selector no sobrepasa su celda CSS» = PASS. `gl:true`. No hay evidencia de fallos en puntos, eliminación, scroll o selección dentro de esa batería.

**OBSERVADO — Código:** `TemporalResourceInspector.vue` contiene `.volume-title { ... border-bottom:1px solid var(--hair); ... }`. `--hair` está definido en `:root` de `src/styles.css`, importado por `src/main.js` en el Editor. La fixture aislada importaba el componente de Inspector pero no `src/styles.css`.

**CAUSA RAÍZ:** falta la hoja global del tema en el entorno de QA, por lo que la variable de borde no está disponible cuando se calcula el estilo. No se atribuye el defecto al CSS productivo.

## Implementación autorizada

1. `scripts/fixtures/editor/timeline-visual-ux-s13-g008-g001.html`: importar `await import('/src/styles.css')` **antes de montar el Inspector real**.
2. Conservar **exactamente 54 comprobaciones**; la del borde ahora exige además que `--hair` esté definido e incluye en su evidencia el valor calculado. No se debilitan ni eliminan aserciones.
3. Crear `scripts/test-timeline-visual-ux-s13-g008-g001-corr001.mjs` con seis pruebas focalizadas: import del mismo tema que `main.js`, estilo original no modificado, regresión negativa si se omite el import, número de aserciones, sintaxis de ambos bloques JavaScript y conservación de controles/runner.
4. Anexar evidencias Node, log de usuario, limitación de entorno Electron/build y actualizar ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY.

## Alcance no modificado

No cambian `src/`, `TemporalResourceInspector.vue`, `ParamForm.vue`, `TimelinePanel.vue`, `Icon.vue`, estilos CSS de producción, modelo Timeline, audio, Player, Jolt, persistencia ni recursos. El runner Electron existente es idéntico. No se altera la geometría temporal ni el límite de 54 verificaciones.

## Resultados y estado

- **Node focal:** 23 PASS / 0 FAIL / 0 SKIP.
- **Node compatible:** 122 PASS / 1 SKIP / 0 FAIL.
- **Electron de esta corrección:** NO VERIFICADO en preparación; `qa-electron-webgl-runner.mjs` abortó antes de abrir el renderer porque falta Vite.
- **Build Editor + Player:** NO VERIFICADO; `vite: not found`.
- **QA local del usuario:** PENDIENTE de los 54 checks, build y validación visual.

**Estado:** IMPLEMENTADO / NODE PASS / NO APROBADO / NO CERRADO. La entrega no equivale a QA Electron o visual.
