# S06 CORR-002 · Integridad de escritura de barras y asteriscos

Gate: `LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-002`.
Base: `LevelForge_SCRIPT_INTELLISENSE_JSDOC_S06_G001_INTEGRAL_CORR-001_SOURCE_BASELINE.zip`.
Estado: **IMPLEMENTADO; Node PASS; Electron, build y QA visual NO VERIFICADOS; S06 NO CERRADO**.

## Auditoría y causa

- **OBSERVADO en QA usuario:** tras `/**/`, reportó que escribir `///////` o `*******` ocultaba otros caracteres y se recuperaban al borrar. Confirmó aprobación parcial del resto de CORR-001, incluida estabilidad al cambiar script.
- **CAUSA CONFIRMADA parcial:** `jsdocInputEdit()` en el baseline CORR-001 devuelve `{insert:'',anchor:from+1}` cuando recibe una barra delante del cierre autogenerado `/**/`. `EditorView.inputHandler` devolvía `true`, anulando la inserción normal. Se reprodujo con el módulo real: al introducir `/`, el documento no aumentaba longitud mientras sí avanzaba el cursor.
- **NO DEMOSTRADO:** que este caso explique por sí solo la desaparición visual reportada de secuencias aisladas `///////` y `*******`. No se recreó en Electron en el entorno de entrega, por dependencias ausentes. El fixture nuevo realiza entrada DOM real, no usa un mock de `inputHandler`.
- **CONTRATO:** CA-001 sustituye la clausura JSDoc custom de CORR-001 por escritura nativa CodeMirror sin consumo de caracteres. La semántica de comentarios incompletos de JavaScript permanece.

## Cambios de producción

- `src/components/ScriptEditor.vue`: elimina import y `EditorView.inputHandler` de autocierre. Conserva única instancia CodeMirror, `updateListener`, sincronización con store, IntelliSense y navegación de scripts Global/Nodo.
- `src/core/editor/types-jsdoc.js`: retira `jsdocInputEdit` obsoleto. `comments`, JSDoc context y diagnósticos no se modifican.

No hay cambios en `App.vue`, layout, docking, otros CodeMirror, runtime, Player, `.ui`, dependencias ni exportación.

## Pruebas y evidencia

- Node focal S06 (S06 original + regresión CORR-001 reconciliada por CA-001 + CORR-002): **47/47 PASS**.
- Node cruzado S06/S04/S05/docking/ventanas/Multiscript: **242/242 PASS** (archivo `node-cross-242-pass.log`).
- Sintaxis JS (`node --check`): PASS en módulos directos y runner.
- Electron S06 CORR-002: **NO VERIFICADO**. Intento detenido con `Falta Vite; ejecutar npm ci antes del QA`.
- Build: **NO VERIFICADO**. `npm run build` devuelve `vite: not found` por dependencias no instaladas.
- `npm ci --offline`: **NO COMPLETADO** (`ENOTCACHED`, `zip-stream-4.1.1.tgz`).
- QA local: **PENDIENTE**. No declarar error visual corregido hasta que el usuario lo pruebe.

## Integridad de la entrega

CHANGE es diferencial respecto a CORR-001. SOURCE_BASELINE es acumulativo; conservar permisos Unix originales, en particular `0755` en tres ejecutables Git. Excluir builds, node_modules y cachés. Inventario exacto y CRC verificados por empaquetado final.
