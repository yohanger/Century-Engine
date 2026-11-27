# LevelForge · QA S06 CORR-001

**Estado:** IMPLEMENTADO · 230/230 NODE PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE.

## Matriz

| ID | Verificación | Estado |
|---|---|---|
| S06-C01–C09 | Autocierre de `/**/`, texto posterior intacto, rechazo de cierre duplicado y comentarios/cadenas ajenos | Node 9/9 PASS |
| S06-C10–C12 | No remonta Script Editor; estado de documento y marco desacoplados de `scriptEditId` | Node 3/3 PASS |
| JSDOC-01–23 | Tipos, firmas, diagnósticos y sombras JSDoc anteriores | Node 23/23 PASS |
| CROSS | S06, Script Editor S04, docking S03, ventanas, Multiscript S01–03 y UI Designer S05 | Node 230/230 PASS |
| CORR-E01–E18 | **CodeMirror real**, escritura progresiva `/**/`, datos del store, autocompletado, identidad del editor, maximizado y restauración | Electron preparado; NO VERIFICADO |
| BUILD | Vite Editor + Player | NO VERIFICADO por falta de Vite |
| QA LOCAL | Editor interactivo y viewport 3D | PENDIENTE usuario |

## Comandos

Desde la raíz del proyecto, con dependencias instaladas (`npm ci` si corresponde):

```bash
node --test scripts/test-script-intellisense-jsdoc-s06-corr001.mjs scripts/test-script-intellisense-jsdoc-s06-g001-integral.mjs
node --test scripts/test-script-intellisense-jsdoc-s06-corr001-electron.mjs
npm run build
npm run electron
```

Primer comando: **35/35 PASS** esperado. El runner Electron: **1/1 test, 18 checks** esperados, aún sin evidencia. Si se ejecuta la batería cruzada descrita en el documento de implementación, se esperan 230 PASS; no extrapolar a otras suites no ejecutadas.

## QA visual y funcional a devolver

1. En un script con funciones, introducir `/**/` **tecla por tecla** al inicio, entre funciones y en medio del archivo. Comprobar que el texto siguiente no desaparece, no cambia de color indebidamente después de cerrar y se conserva al guardar y reabrir.
2. Probar `/** @type {NodeHandle} */` y un JSDoc multilínea; revisar completado e información contextual antes y después del comentario. Comprobar `Undo/Redo` y copiar/pegar de un comentario completo.
3. Desde el Script Editor maximizado, seleccionar otro script en la navegación. Deben conservarse maximizado, ancho, alto y la misma instancia del editor. Repetir sin maximizar y mientras está acoplado; volver al primero y comprobar ambos documentos y sus modificaciones sin guardar.
4. Antes y después de alternar scripts, medir visualmente la anchura/altura del **viewport 3D de fondo** y comprobar que no cambia el tamaño de los docks. Si sí cambia, aportar captura antes/después: ese comportamiento no está demostrado por la causa de desmontaje del Script Editor.
5. Alternar recursos Global y Nodo. Confirmar sugerencias independientes, guardado y ausencia de regresiones de `@type`, `@param`, `@returns` y APIs de LevelForge.
6. Confirmar que el editor se puede mover y redimensionar; que S04/S05, Player y la disposición de paneles siguen funcionales.

## Criterios de cierre

Solo tras prueba Node/Electron cuando esté disponible, build, QA local del usuario y aprobación expresa. Si Electron o build no se ejecutan, registrar NO VERIFICADO. No declarar FIXED o CERRADO por compilar solamente.
