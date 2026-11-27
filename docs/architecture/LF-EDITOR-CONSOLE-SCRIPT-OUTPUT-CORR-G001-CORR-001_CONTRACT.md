# LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001-CORR-001 — Contrato

## Autoridad y base

Autorización: «Listo. LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001-CORR-001 autoriza comenzar».
Base vinculante: `LevelForge_EDITOR_CONSOLE_SCRIPT_OUTPUT_CORR_G001_SOURCE_BASELINE.zip`, íntegro, 1.665 archivos. La entrega G001 recibe aprobación funcional del usuario con la salvedad explícita de pruebas fallidas. La evidencia local muestra Node 30/30 PASS, builds Editor y Player PASS, Electron CON-E01 FAIL después de 13 comprobaciones satisfactorias. No se convierte esa aprobación funcional en cierre técnico ni PASS del runner.

## Objetivo y mecanismo

Corregir la fixture Electron de Consola usando la identidad canónica del objeto en el proyecto reactivo. Añadir regresión que reproduce la identidad original incorrecta y verifica la correcta con el runtime existente. Conservar las comprobaciones de mensajes, niveles, Signals, UI, contador, limpieza, sesiones y Player. No reducir mínimos ni eliminar aserciones para obtener PASS.

Causa demostrada: la fixture asignaba el objeto raw a `_lfNodeOwner`, mientras `store.project.objects` entregaba el proxy reactivo. El guard de identidad del runtime rechaza esa diferencia. En la reproducción previa, el propietario raw produce dos errores de script inactivo y cero mensajes; el propietario canónico produce las dos salidas previstas y cero errores. El guard de producción se conserva intacto.

## Alcance y medios autorizados

- `scripts/fixtures/editor/console-script-output-corr-g001.html`: identidad de montaje y comprobaciones/diagnóstico de fixture.
- `scripts/test-editor-console-script-output-corr-g001.mjs`: ampliar el helper existente y regresión de proyecto reactivo.
- `scripts/test-editor-console-script-output-electron-corr-g001.mjs`: únicamente diagnóstico y mínimos coherentes; no reducir cobertura.
- Documentación de implementación/QA, instrucciones de entrega, evidencia local recibida y nuevas ejecuciones; seis hojas de `docs/qa/LevelForge_DB_Ledger.xlsx`.
- Reutilizar Node, compilador Vue y runner Electron embebido existentes. Sin navegadores externos, gestores ni nuevos runners paralelos.

Código de producción (`src/`), Electron de aplicación y dependencias fuera del alcance. Si las comprobaciones posteriores revelan una causa de producción, se registra y bloquea esa corrección para declarar su alcance. No modificar Signals, Terreno, Jolt, render, escenas del usuario ni Edit Mesh.

## Evidencia y cierre

Suite Node completa, regresión focal, sintaxis de fixture, documentación y comparación íntegra de producción contra base. Reintentar Electron sin modificar su mecanismo por restricciones de este entorno. Separar reproducción Node de PASS Electron. La prueba Electron debe terminar con todas las comprobaciones, no solamente superar el punto previamente fallido.

Cierre pendiente de ejecución Electron satisfactoria y aceptación de la corrección. Registrar aprobación funcional G001 y fallo local con sus límites reales. Exactamente dos ZIP: CHANGE y SOURCE_BASELINE acumulado; no borrar historia, archivos fuente ni entregar hashes separados o scripts .sh de verificación.
