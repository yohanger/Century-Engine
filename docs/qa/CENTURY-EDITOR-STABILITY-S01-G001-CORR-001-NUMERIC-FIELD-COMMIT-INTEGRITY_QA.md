# QA y evidencia

## Evidencia aportada por el usuario (2026-11-24)
- Gate padre: Node 10/10 PASS en el equipo local.
- Electron/Vite iniciaron: 3 comprobaciones PASS y 1 FAIL (Campo numérico acepta negativo válido); 6 sin ejecutar. No es aprobación de la estabilidad.

## Ejecución actual
- Baseline: 3988 archivos del SOURCE_BASELINE, CRC válido; sin acceso al árbol local del usuario. La copia de trabajo fue extraída del ZIP para esta corrección.
- Harness de handlers sobre el código anterior: 4/10 PASS; seis fallos reproducibles. Sobre código corregido: 10/10 PASS. Se modela la desreferenciación de ref del template anterior y se ejecutan los handlers; no se ejecuta Vue. No se ha reproducido el fallo exacto del Electron local.
- Suite editor-numeric-pointer-integrity: 20/20 PASS (10 originales + 10 nuevas).
- Regresión comparada: 44/60 PASS antes y después; los 16 fallos mantienen los mismos nombres. Sin alteración de assertions históricas.
- Sintaxis: 6/6 bloques o módulos PASS; no equivale a compilación de Vue.
- Build y QA Electron bloqueados por ausencia de Vite. Fixture actualizado: 15 comprobaciones previstas (10 originales y 5 nuevas), 0 ejecutadas en esta sesión. El teclado nativo y la responsividad del control no se acreditan por las pruebas Node.
- Ledger: seis hojas, valores y fórmulas históricos conservados y 12 tablas con mismos nombres y rangos. Sin aprobación ni cierre.

## QA local
Aplicar únicamente CHANGE ZIP sobre el baseline de estabilidad. Ejecutar `npm run test:suite -- editor-numeric-pointer-integrity`, `npm run test:suite -- editor-numeric-pointer-integrity-electron` y `npm run build`. Si falla Electron, conservar la etapa y los datos de eventos, foco y commits. Validar manualmente negativos, coma decimal, Enter/Tab, Escape y Undo/Redo en Inspector y Edit Mesh. El crash original continúa sin causa raíz acreditada.
