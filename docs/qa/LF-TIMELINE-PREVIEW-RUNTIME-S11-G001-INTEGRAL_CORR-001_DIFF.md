# Inventario de entrega — S11-G001 CORR-001

Baseline: `LF_TIMELINE_PREVIEW_RUNTIME_S11_G001_INTEGRAL_SOURCE_BASELINE.zip`.

- **Producción:** `src/core/timeline/playback-session.js` nuevo; `src/App.vue`, `src/components/TimelinePanel.vue`, `src/components/TimelineCurveEditor.vue` modificados.
- **Pruebas:** nuevo harness `scripts/test-timeline-preview-runtime-s11-g001-corr001.mjs`; aserciones históricas S04–S11 adaptadas a la reubicación autorizada del transporte. Se conserva el comportamiento ensayado; las aserciones antiguas que exigían que `TimelinePanel.vue` fuese dueño del Runner ya no representan el contrato.
- **QA/documentación:** Implementation, QA, DIFF y logs de Node, npm offline y tres fallos de Cinematics preexistentes.
- **Ledger:** modificación de `docs/qa/LevelForge_DB_Ledger.xlsx`, con seis hojas sincronizadas.
- **Excluidos:** Player runtime, FilmMaker, escenas, proyectos, `node_modules`, builds y cachés.
- **Eliminados:** ninguno. La comparación final de ZIP genera lista exacta de nuevos/modificados e inesperados.

No se entrega un SHA separado ni scripts `.sh`. Estado de implementación: QA local no verificado.

## Inventario diferencial verificado contra SOURCE_BASELINE de S11-G001

- Nuevos: **9** archivos (módulo de transporte, suite específica, informe, QA, Diff y cuatro logs de evidencia).
- Modificados: **16** archivos (tres componentes/capa App de producción, 11 pruebas/regresiones heredadas, implementación histórica anotada y ledger).
- Eliminados: **0**. Cambios inesperados: **0**.
- Regresión final: **427 pruebas**, 411 PASS / 16 SKIP / 0 FAIL (27 suites). Suite Cinematics viewer omitida del total limpio por **3 fallos preexistentes en el baseline de entrada**, registrados por separado.
