# Evidencia — Escape libera foco de propiedades

**Gate:** `CENTURY-EDITOR-UX-S01-G001-ESCAPE-PROPERTY-FOCUS-RELEASE`

## Resultados de pruebas automatizadas

- Pruebas nuevas `node --test scripts/test-editor-escape-property-focus.mjs`: **17/17 PASS**.
- Runner `node scripts/qa-suite.mjs escape-property-focus`: **79 tests, 78 PASS, 0 FAIL, 1 SKIP** (compilación opcional Vue no disponible).
- Suite legacy `node --test scripts/test-editor-ux-s01-g005.mjs`: **14 PASS / 2 FAIL**. Los mismos fallos `G005-08` (aserción obsoleta de `@blur="confirm"`) y `G005-13` (aserción de snapping) se reprodujeron sin cambios sobre SOURCE_BASELINE anterior.
- `node scripts/qa-suite.mjs smoke`: **29 PASS / 1 FAIL** (`TOOL-08`, aserción de cantidad fija de grupos); mismo fallo en SOURCE_BASELINE anterior, que tenía 50 grupos frente a los 31 esperados por el test. El nuevo grupo no introduce una categoría de fallo distinta.
- Sintaxis JS y JSON: PASS.
- `npm run build`: **EXIT 127 — `vite: not found`**. No hay evidencia de compilación ni QA visual de Electron.
- `scripts/check-layers.mjs`: EXIT 0, pero reporta diagnósticos de capas heredados. No se atribuyen a esta corrección sin contraste detallado.

## Cobertura funcional

- Entrada de teclado Escape sobre `input`, `textarea`, `select`, `contenteditable` y tipos de campo de propiedad.
- Liberación de foco del elemento realmente activo, sin desplazar otro foco establecido por otro controlador.
- Borrador cancelado previamente no vuelve a confirmar ni genera doble `blur`.
- CodeMirror conserva Escape aun cuando la búsqueda elimina nodos del DOM durante el evento.
- La ruta real `onEsc` de `AppWindow` mantiene la ventana abierta al liberar una propiedad y conserva su cierre fuera de campos.
- Captura de teclas y operaciones modales mantienen prioridad por propagación.

Los tests se ejecutaron en Node con elementos/eventos simulados y ejecución de la función real de la ventana; **el estado de `document.activeElement` no se verificó todavía en Electron**.

## QA pendiente del usuario

Abrir Inspector, Edit Mesh y formularios de propiedades. Enfocar y modificar campos numéricos, texto, selectores y cajas de búsqueda; pulsar Escape. Confirmar que el foco se retira sin modificar la selección ni cerrar la ventana. En ventanas flotantes, comprobar que Escape con un campo activo solo libera foco y Escape fuera del campo conserva el cierre de ventana. Repetir con una extrusión modal, selector de color, captura de teclas y CodeMirror; verificar que sus acciones de Escape no cambian.

**Estado:** IMPLEMENTADO · TEST PASS · NO COMPILADO · QA ELECTRON NO VERIFICADO · NO APROBADO · NO CERRADO.

Registros en `docs/qa/evidence/CENTURY-EDITOR-UX-S01-G001-ESCAPE-PROPERTY-FOCUS-RELEASE/`.
