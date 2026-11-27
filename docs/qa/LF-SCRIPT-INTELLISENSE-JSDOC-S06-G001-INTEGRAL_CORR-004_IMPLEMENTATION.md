# Implementación S06 CORR-004

Base: SOURCE_BASELINE S06 CORR-003 QA-001. Gate autorizado literalmente.

## Modificaciones

- `src/core/editor/types-text.js`: `mask(text, pos)` toma `string` y `comment` del cursor, incluso si después aparecen `/*` o `//`. `text` enmascarado y `unclosedBlockStart` siguen cubriendo EOF. Mantiene un único escaneo, sin parser adicional.
- `scripts/qa-electron-webgl.cjs`: pasa `text` a CDP `Input.dispatchKeyEvent` solo cuando un paso declara un único carácter; el resto de fixtures conserva sus argumentos previos.

## Nuevos medios de prueba

- `scripts/test-script-editor-core-s06-corr004.mjs`: 23 controles del estado posicional, firmas/hover, integridad de texto y contratos Vue/CodeMirror.
- `scripts/fixtures/editor/script-editor-core-s06-corr004.html`: dos editores reales, uno aislado y el integrado. Escribe barras, asteriscos, `/**/` y `/*****/` carácter por carácter con teclado nativo. Comprueba documento, cursor, DOM, store, restauración y continuidad.
- `scripts/test-script-editor-core-s06-corr004-electron.mjs`: integra fixture al runner Electron existente.

## Evidencia

- Node específicos: **23/23 PASS**.
- Node regresión de componentes relacionados: **253/253 PASS**.
- Electron: **NO VERIFICADO** (Vite/Electron no disponibles completos en la copia de trabajo).
- Build Editor/Player: **NO VERIFICADO**.
- QA visual del usuario: **PENDIENTE**.

No se afirma que la coloración JS legítima cambie. Si el video sigue mostrando color verde tras `/*` abierto, no constituye por sí solo fallo. La integridad de entrada queda sujeta a la prueba diferencial Electron y al QA local. S06 permanece ABIERTO.
