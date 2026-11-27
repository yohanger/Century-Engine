# S06 CORR-003 — Matriz de QA de navegación y comentarios

**Gate:** `LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003`.
**Estado:** IMPLEMENTADO · Node PASS · Electron usuario FAIL C3-E15 por selector incorrecto del fixture · QA-001 preparado · revalidación Electron pendiente · build no verificado · QA local pendiente.

| ID | Caso | Criterio de aceptación | Estado |
|---|---|---|---|
| C3-N01..14 | Casos de análisis puro | Índice previo, rangos, comentario parcial/cerrado, strings, `//`, aislamientos, store y contrato CA-001 | 14/14 Node PASS |
| C3-CROSS | S04 Script Editor, S03 docking, S05 UI Designer, S06 JSDoc y Multiscript | Ninguna regresión en pruebas disponibles | 230/230 Node PASS (incluye 5 pruebas QA-001) |
| C3-E01..14 | Editor Vue/CodeMirror real | Escritura `/*`, contador provisional, navegación, restauración y posicionamiento | PASS en ejecución local del usuario hasta E14b; suite completa FAIL |
| C3-E15 | Aislamiento de dos scripts | Cambiar efectivamente a Dos.js y comprobar que solo muestra `segundo` | FAIL anterior: fixture pulsaba el archivo actual por índice visual; corregido en QA-001, REVALIDACIÓN PENDIENTE |
| C3-E16..23 | Continuidad de instancia y documento | Geometría, cambio de regreso y caracteres consecutivos | NO EJECUTADOS en salida del usuario, PENDIENTES |
| C3-QA01..05 | Regresión del fixture | Selección estable por ruta+ID, comprobación de documento CodeMirror | 5/5 Node PASS |
| C3-BUILD | Editor y Player Vite | Compilación sin errores nuevos | NO VERIFICADO: Vite ausente |
| C3-VISUAL | Repetición del video del 03-11-2026 | Métodos no desaparecen del panel; se distinguen de código activo; comentarios cierran y recuperan índice real | PENDIENTE USUARIO |

## Comandos desde raíz del proyecto

```bash
node --test scripts/test-script-intellisense-jsdoc-s06-corr003-qa001.mjs scripts/test-script-intellisense-jsdoc-s06-corr003.mjs scripts/test-script-intellisense-jsdoc-s06-corr002-qa-corr001.mjs scripts/test-script-intellisense-jsdoc-s06-corr002.mjs scripts/test-script-intellisense-jsdoc-s06-corr001.mjs scripts/test-script-intellisense-jsdoc-s06-g001-integral.mjs scripts/test-script-editor-godot-ux-s04-g001-integral.mjs scripts/test-script-editor-window-corr002.mjs scripts/test-script-editor-window-corr003.mjs scripts/test-script-editor-window-corr004.mjs scripts/test-editor-docking-s03-g001-integral.mjs scripts/test-ui-designer-pro-ux-s05-g001-integral.mjs scripts/test-node-multiscript-s01-g001.mjs scripts/test-node-multiscript-s01-g002.mjs scripts/test-node-multiscript-s01-g003.mjs
node --test scripts/test-script-intellisense-jsdoc-s06-corr003-electron.mjs
npm run build
npm run electron
```

**Esperado Node:** 230 tests PASS, 0 FAIL. **Objetivo Electron:** 1 test PASS y al menos 60 checks; su resultado está pendiente, no se declara PASS.

## Prueba visual del usuario

1. En un script que ya tenga tres funciones reconocidas, colocar cursor arriba y escribir `/` seguido de `*`. El código posterior puede colorearse como comentario, **pero las tres funciones deben permanecer listadas y atenuadas como referencias provisionales**, con aviso visible. Ninguna línea se pierde.
2. Insertar `*/` inmediatamente después de la apertura para formar `/**/`; la navegación se vuelve real, contador sin aproximación y las funciones regresan a su presentación normal. El código debe ser idéntico a lo escrito.
3. Abrir `/*` entre las funciones: las anteriores siguen confirmadas; las posteriores permanecen como referencias provisionales. Seleccionar una debe llevar al lugar correcto (posiciones desplazadas por inserción).
4. Con comentario abierto cambiar de script Global/Nodo y volver. Ninguna función del otro script debe filtrarse; CodeMirror y geometría conservados.
5. Escribir `///////` y `*******` de forma independiente y `/**/` completo, probar Undo/Redo, guardado/reapertura, minimapa, IntelliSense y JSDoc. Sin pérdidas ni consumos de caracteres.
6. Comentar **deliberadamente** todas las funciones con un bloque completo `/*...*/`: no deben figurar como funciones ejecutables. Si el documento ya estaba abierto con un comentario incompleto y sin índice previo, debe avisar sin inventar un índice.

**Evidencia a devolver:** resultado Electron, build y aprobación QA visual o captura del paso fallido. S06 no puede cerrarse sin esa evidencia y aprobación.

## QA-001 — Hallazgo y corrección del fixture, 03-11-2026

El usuario ejecutó CORR-003: 14/14 Node PASS. En Electron, C3-E01 hasta C3-E14b y los checks de teclado previos PASS; `C3-E15 segundo script no hereda índice` FAIL. La causa está **en el fixture**: el navegador ordena `Dos.js` antes de `Uno.js`, pero `querySelectorAll('.se-file')[1]` elegía de nuevo `Uno.js` y nunca cambiaba de script. No hay prueba de filtración de índices entre documentos.

QA-001 selecciona el recurso por su ruta completa, valida `store.scriptEditId` y que `EditorView.state.doc` corresponde al script solicitado ANTES de probar el índice. Se mantiene la comprobación de retorno al primer script, instancia única de CodeMirror y geometría. No se modifica código de producción.

Evidencia Node posterior: `230/230 PASS`; Electron QA-001 y compilación **NO VERIFICADOS** por el asistente. El Gate sigue ABIERTO a la espera de la nueva ejecución Electron y QA local visual.
