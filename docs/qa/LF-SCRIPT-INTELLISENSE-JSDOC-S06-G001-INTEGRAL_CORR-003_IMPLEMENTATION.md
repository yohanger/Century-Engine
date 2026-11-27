# S06 CORR-003 — Implementación auditada

**Estado:** IMPLEMENTADO · Node 14/14 específico y 225/225 regresión cruzada PASS · Electron/build NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

## Diagnóstico

**Observado en video:** `/*` incompleto colorea el texto posterior como comentario y desaparecen tres métodos del panel; reaparecen con `*/`. No consta destrucción del texto.

**Causa raíz en código:** `outlineOf(code.value)` se calculaba sin estado intermedio. El lexer de `types-text.js` sustituye por espacios todo texto que pertenece a un bloque `/*...` abierto y `analysis.js` no encuentra funciones en la parte enmascarada. `ScriptEditor.vue` utilizaba ese resultado como única referencia de navegación.

## Cambios de producción

- `src/core/editor/types-text.js`: el `mask` existente informa `unclosedBlockStart` cuando queda un bloque sin cerrar. Mantiene las propiedades previas `text`, `string`, `comment`.
- `src/core/editor/analysis.js`: el índice real se obtiene de `scanOutline` y se conserva `outlineOf`; `outlineForDocument` separa símbolos confirmados y posiciones provisionales. El comentario incompleto nunca se interpreta como código ejecutable.
- `src/components/ScriptEditor.vue`: índice derivado por ID de documento, actualizado en transacciones con `changes.mapPos`. Mensaje de comentario abierto, referencias atenuadas y contador aproximado. Al cerrar el comentario se descarta automáticamente el índice provisional. No se crea otra instancia CodeMirror.

`CA-002` preserva `CA-001`: **ningún `inputHandler` propio, autocierre de JSDoc ni sustitución de caracteres**.

## Evidencia disponible

- `scripts/test-script-intellisense-jsdoc-s06-corr003.mjs`: 14/14 PASS.
- Regresión dirigida: 225/225 Node PASS incluyendo JSDoc, S04, docking S03, UI Designer S05 y Multiscript.
- `scripts/fixtures/editor/script-intellisense-jsdoc-s06-corr003.html`: fixture de Vue/CodeMirror real con entrada DOM, navegación provisional, cierre, sincronización con store, geometría y aislamiento de documentos.
- `scripts/test-script-intellisense-jsdoc-s06-corr003-electron.mjs`: runner embebido en Electron con 60 verificaciones mínimas, **NO EJECUTADO CON ÉXITO**.
- `npm ci --offline`: ENOTCACHED (zip-stream 4.1.1). `npm run build`: `vite: not found`; test Electron: falta Vite. **No equivalen a fallos funcionales de la corrección, pero tampoco acreditan PASS**.

## Pendientes antes de cierre

Ejecutar fixture Electron en instalación con dependencias, build Editor+Player y QA local visual sobre el mismo escenario de video. Conservar S06 ABIERTO si no hay aprobación expresa.

## QA-001 — Asunción incorrecta del orden visual

El usuario confirmó 14/14 Node PASS y Electron FAIL en `C3-E15`, tras superar la edición real y la navegación provisional. La prueba abría `document.querySelectorAll('.se-file')[1]`, pero el navegador de recursos ordena alfabéticamente (`Dos.js`, `Uno.js`). Por tanto, ese índice reabría el script actual (`Uno.js`) y la comprobación de aislamiento era inválida.

Se sustituyó la selección ordinal por un localizador de ruta exacta del recurso y se agregaron aserciones de ID activo y documento CodeMirror tanto al cambiar al segundo script como al regresar. Se añadieron cinco pruebas Node QA-001. Ningún archivo de producción cambió. Resultados: 230/230 Node PASS; Electron y build no verificados en el entorno del asistente. Pendiente repetir Electron y QA visual local.
