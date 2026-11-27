# LevelForge · QA S06 CORR-002

**Estado:** IMPLEMENTADO · 242/242 Node PASS · Electron/build NO VERIFICADOS · QA LOCAL PENDIENTE.

## Matriz

| ID | Caso | Evidencia |
|---|---|---|
| C2-NODE | Conservación de `///////`, `*******`, `/**/`, `/*****/`, autocierre SUPERSEDIDO | `test-script-intellisense-jsdoc-s06-corr002.mjs` · Node PASS |
| C1-REBASE | CORR-001 actualizado a contrato CA-001; identidad de Script Editor y store preservados | `test-script-intellisense-jsdoc-s06-corr001.mjs` · Node PASS |
| JSDOC | `@type`, `@param`, `@returns`, `@typedef` y tipos de API sin regresión | `test-script-intellisense-jsdoc-s06-g001-integral.mjs` · Node PASS |
| CROSS | S04/S05, docking y Multiscript | 242/242 Node PASS |
| C2-ELECTRON | Teclas realmente insertadas en `contenteditable`, texto/longitud/cursor visibles, store, plegado, Undo/Redo y cambio de script | `test-script-intellisense-jsdoc-s06-corr002-electron.mjs` · **NO VERIFICADO** |
| C1-ELECTRON | Fixture CORR-001 conserva continuidad y geometría, adaptado a entrada nativa | `test-script-intellisense-jsdoc-s06-corr001-electron.mjs` · **NO VERIFICADO** |
| BUILD | Editor + Player | **NO VERIFICADO** |
| USUARIO | Escritura y renderizado reales en Electron, guardar/reabrir | **PENDIENTE** |

## Comandos (raíz de CORR-002)

```bash
node --test scripts/test-script-intellisense-jsdoc-s06-corr002.mjs scripts/test-script-intellisense-jsdoc-s06-corr001.mjs scripts/test-script-intellisense-jsdoc-s06-g001-integral.mjs
node --test scripts/test-script-intellisense-jsdoc-s06-corr002-electron.mjs
node --test scripts/test-script-intellisense-jsdoc-s06-corr001-electron.mjs
npm run build
npm run electron
```

Esperado Node: **47 PASS**. Electron CORR-002: **1 PASS, al menos 100 comprobaciones**, incluyendo una por pulsación. Electron CORR-001: **1 PASS, 18 comprobaciones**. Se requiere `npm ci` si faltan dependencias.

## Prueba visual obligatoria (usuario)

1. Crear un script con varias funciones. Escribir, **pulsación por pulsación**, `///////` y `*******` en líneas separadas y entre funciones. Cada carácter debe aparecer; las funciones posteriores deben seguir visibles y editables.
2. Escribir `/**/` y `/*****/` desde cero, también `/*******/` seguido de más barras o asteriscos. Ya no se autocompleta `/**`; esto es intencional por CA-001. Si un comentario queda abierto, es normal que JavaScript coloree el resto como comentario **hasta** escribir `*/`; no es normal que se pierdan caracteres.
3. Probar Backspace, Delete, Undo y Redo con esas secuencias, selección parcial, pegar texto, guardar y reabrir. Comparar el contenido original byte a byte.
4. Comprobar que se conserva `@type`, `@typedef`, `@param`, `@returns`, autocompletado de `game`, scripts Global/Nodo y cambio entre scripts sin resetear la ventana.
5. Comprobar que Script Editor maximizado, docking y viewport siguen funcionando; no se abre un segundo CodeMirror.

**Evidencia a devolver:** salida del fixture Electron, build, resultado visual (PASS o captura y pasos si falla), y ejemplo exacto del texto si persiste desaparición. Compilación no equivale a QA visual. Cierre solo con aprobación del usuario.

## Addendum QA-001 — timeout Electron aportado por el usuario (2026-11-03)

El usuario confirmó **47/47 PASS Node**, pero `test-script-intellisense-jsdoc-s06-corr002-electron.mjs` falló sin devolver comprobaciones (`No se obtuvo resultado WebGL de la fixture`). Esto **no prueba** alteración del documento. Se corrigió solo el mecanismo de QA: progreso observable, temporización sin depender de fotogramas ocultos, timeout ampliado solo para el fixture de S06 y diagnóstico cuando expira. Los tests nuevos S06-QA01..05 pasan; batería focal **52/52 PASS**. Electron corregido y QA visual siguen **NO VERIFICADOS**. Consultar `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-002/qa-fixture-diagnostic-2026-11-03.md`.

Repetir la misma prueba Electron. Si falla, devolver la salida completa: el nuevo mensaje debe incluir etapa, contador de comprobaciones, estado de carga y presencia de CodeMirror. No interpretar los tiempos de QA como error funcional ni declarar cierre por tests Node.
