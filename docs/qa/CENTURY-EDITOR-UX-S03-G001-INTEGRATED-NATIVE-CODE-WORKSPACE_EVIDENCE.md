# Evidencia de CENTURY-EDITOR-UX-S03-G001-INTEGRATED-NATIVE-CODE-WORKSPACE

**Estado:** implementado en fuente; QA local pendiente; no aprobado ni cerrado.

## Baseline

SOURCE_BASELINE de CORR-005, 3315 archivos comprobados contra el ZIP sin diferencias. Sin `.git` ni `node_modules` en el baseline. No se alteró el proyecto del usuario ni se realizó operación Git.

## Pruebas y resultados

- Integración de Code: **10/10 PASS** (`scripts/test-code-workspace-integration.mjs`).
- Regresión focal de docking, Script Editor y VS Code: **97/99 PASS**; dos fallos heredados `DOCK-30` y `DOCK-C09`.
- Regresión ampliada: **146/153 PASS**. Los siete fallos son `DOCK-30`, `DOCK-C09` y cinco pruebas/ejecuciones del puente VS Code que fallan igualmente en el SOURCE_BASELINE CORR-005; comprobación diferencial documentada en `BASELINE_COMPARISON.log`.
- `npm run build`: **BLOQUEADA** por `vite: not found`; no hay dependencias instaladas.
- Electron, CodeMirror real, WebGL2, vista flotante, guardado real en proyecto y QA visual: **NO VERIFICADOS**.

## Interpretación

El resultado positivo de los tests acredita en código la tercera vista, las reglas de docking y la preservación de rutas de scripts. **No acredita** la compilación de Vue/Vite, que CodeMirror se visualice sin defectos en Electron, ni la experiencia de cambio de foco con el juego en ejecución. Los fallos preexistentes no se atribuyen a este Gate ni se silencian.

## Registros

- `CODE_TESTS.log`: pruebas nuevas.
- `REGRESSION.log`: suite ampliada.
- `BASELINE_COMPARISON.log`: mismos siete fallos sobre CORR-005, antes de aplicar cambios.
- `BUILD.log`: compilación bloqueada.

**Autorizado ≠ aprobado.** Cierre sujeto a evidencia de QA local y aceptación del usuario.
