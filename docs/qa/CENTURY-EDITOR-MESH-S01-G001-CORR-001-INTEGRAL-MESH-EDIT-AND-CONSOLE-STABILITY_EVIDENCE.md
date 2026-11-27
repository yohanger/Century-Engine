# Evidencia — CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY

## Línea base

- Archivo: `CENTURY-EDITOR-MESH-S01-G001-PERSISTENT-PRIMITIVE-TOPOLOGY-CONTROLS_SOURCE_BASELINE.zip`.
- El código de salida se extrajo íntegro; no se detectaron archivos ausentes respecto a la base.
- La compilación de la fuente recibida no incluye `node_modules`.

## Comandos y resultados

- `node scripts/qa-suite.mjs mesh-editor-stability`: **77/77 PASS**, 0 FAIL. Incluye 12 pruebas nuevas y regresiones paramétricas, Mesh Edit y TriMesh.
- `node --test scripts/test-mesh*.mjs scripts/test-trimesh-reference-integrity.mjs`: **270/323 PASS; 53 FAIL**.
- Misma selección sobre SOURCE_BASELINE anterior: **258/311 PASS; 53 FAIL**. Los nombres de los 53 tests fallidos coinciden; 12 pruebas nuevas aportan la diferencia entre ambas suites.
- `node scripts/qa-suite.mjs smoke`: **29/30 PASS; 1 FAIL** ya visto en la fuente anterior.
- `npm run build`: **EXIT 127 — `sh: 1: vite: not found`**.
- Comprobaciones `node --check` de módulos JavaScript afectados: PASS.

## Archivos de evidencia

- `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY/directed-runner.log`
- `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY/mesh-regression.log`
- `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY/baseline-mesh-regression.log`
- `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY/smoke.log`
- `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY/baseline-smoke.log`
- `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY/build.log`

## No verificado / pendientes

- Compilación integrada: no disponible por falta de Vite.
- QA visual Electron y QA real de `DataCloneError`, gizmos, Corte/Cuchillo, reducción, sombras y fader: no ejecutados.
- Advertencia Electron CSP: permanece, por dependencia de evaluación dinámica de scripts.
- La eliminación definitiva de todas las advertencias de consola no está acreditada.
- No se ejecutó Git.
