# S06 CORR-003 — QA-001 · Manifiesto de corrección del fixture

**Gate vigente:** `LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003`.
**SOURCE_BASELINE de comparación:** `LevelForge_SCRIPT_INTELLISENSE_JSDOC_S06_G001_INTEGRAL_CORR-003_SOURCE_BASELINE.zip`.
**Estado:** corrección de QA implementada; Node 230/230 PASS; Electron de QA-001 NO VERIFICADO; build NO VERIFICADO; QA visual PENDIENTE; S06 ABIERTO.

## Modificados (4)

1. `scripts/fixtures/editor/script-intellisense-jsdoc-s06-corr003.html` — localizar script por ruta completa, verificar ID activo y texto real de CodeMirror en ambos cambios.
2. `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003_QA.md` — actualizar matriz con fallo `C3-E15`, causa demostrada y revalidación.
3. `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003_IMPLEMENTATION.md` — diferenciar error del fixture de fuga real de índices.
4. `docs/qa/LevelForge_DB_Ledger.xlsx` — mantener sincronizadas seis hojas y conservar historial anterior.

## Nuevos (7)

1. `scripts/test-script-intellisense-jsdoc-s06-corr003-qa001.mjs` — cinco pruebas Node del selector de recursos.
2. `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003/user-electron-c3-e15-2026-11-03.md` — resultado aportado por usuario.
3. `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003/qa001-fixture-change.md` — análisis correctivo.
4. `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003/qa001-node-cross.log` — Node 230/230 PASS.
5. `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003/qa001-electron-not-verified.log` — Vite ausente en entorno del asistente.
6. `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003/qa001-build-not-verified.log` — build bloqueado por Vite ausente.
7. `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003_QA-001_MANIFEST.md` — este inventario.

## Exclusiones y verificación

**Producción modificada:** ninguno. Se conservan `ScriptEditor.vue`, `analysis.js`, `types-text.js`, `store`, CodeMirror, Player, runtime, UI Designer, escena y Assets sin alteraciones respecto a CORR-003.

**Eliminados:** 0. **Cambios inesperados:** 0. CHANGE contiene solo estos once archivos; el SOURCE_BASELINE acumula el contenido anterior sin reemplazar el proyecto por otro motor.

**Evidencia:** usuario 14/14 Node PASS; Electron llegó a C3-E15 después de superar los controles anteriores y falló porque el fixture pulsó el script actual de nuevo. QA-001 5/5 Node específico y 230/230 Node cruzado PASS. El nuevo Electron no fue ejecutado con Vite en este entorno, por lo que NO es PASS, y no permite cerrar el Gate.

**Próxima acción:** ejecutar el fixture Electron actualizado en el PC del usuario, comprobar `C3-E15` y el regreso a `Uno.js`, después probar el caso visual y build. Conservar el baseline anterior hasta QA local aprobado.
