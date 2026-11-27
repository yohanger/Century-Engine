# LevelForge · S06 CORR-001 — comentarios JSDoc y estabilidad al abrir scripts

Gate vinculante: `LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001`.

Autorización exacta del usuario: «Listo. LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001 autoriza comenzar».

Base: `LevelForge_SCRIPT_INTELLISENSE_JSDOC_S06_G001_INTEGRAL_SOURCE_BASELINE.zip`.

## Observado, inferido y causa

1. El usuario informó que al escribir `/**/` el código posterior parecía cortarse y se recuperaba al borrar el comentario. La captura conserva visibles las funciones posteriores; **no se ha confirmado pérdida de contenido** ni un defecto de `jsdocContext` sobre un bloque completo. Los analizadores `comments()` y `mask()` reconocen el cierre de `/**/` en pruebas Node. Un bloque `/**` sin `*/` sí convierte legalmente el resto del archivo en comentario, y durante la escritura puede parecer que desaparece la sintaxis. **Corrección preventiva acotada**, pendiente de QA interactivo: un `EditorView.inputHandler` autocierra `/**` cuando el usuario termina de escribir la tercera posición `*`, manteniendo el cursor delante de `/`. Si escribe después `/` de manera manual, avanza sobre el cierre existente. No interviene en strings, comentarios de línea o cuando ya existe un `*/` para el bloque actual.
2. **Causa raíz confirmada de la geometría del Script Editor**: en `App.vue`, `:key="store.scriptEditId"` obligaba a Vue a destruir y reconstruir `ScriptEditor` y su marco flotante en cada cambio de recurso; el estado `maximized` y las dimensiones inicializadas en `FloatingEditorWindow.vue` volvían a entrar en juego. Se elimina exclusivamente esa clave; la identidad del componente permanece fija mientras `store.modal === 'script'`. El watcher ya existente cambia documento sin crear otro CodeMirror.
3. **Riesgo derivado del cambio de identidad**: los `dispatch` internos que reemplazan el documento no deben escribirse en el nuevo recurso como si fueran ediciones del usuario. Se distingue con `syncingProjectDocument`, preservando `setScriptCode`, guardado, modificaciones no guardadas y la configuración `Global/Nodo` de IntelliSense. El formato de scripts y su ejecución no cambian.

La supuesta alteración de **tamaño del viewport 3D** no está confirmada: el origen de reinicialización detectado corresponde a la **ventana de Script Editor**. La matriz de QA incluye verificación independiente de la vista 3D para detectar si subsiste otro defecto.

## Archivos de producción modificados

- `src/App.vue` — identidad estable del Script Editor al navegar scripts.
- `src/components/ScriptEditor.vue` — gestión del cambio de documento sin reescritura cruzada; autocierre JSDoc en CodeMirror.
- `src/core/editor/types-jsdoc.js` — política específica de entrada `/**/`; parser `jsdocContext` original intacto.

No se cambian `FloatingEditorWindow.vue`, CodeMirror, `game-api.d.ts`, el runtime, el Player, el formato `.ui`, el UI Designer ni las dependencias.

## Verificación técnica

- 12/12 nuevas pruebas Node PASS; 23/23 JSDoc original PASS; conjunto focal y regresión cruzada 230/230 PASS.
- Sintaxis JavaScript verificada en módulos directos; fixture Electron CORR-001 incorpora 18 comprobaciones previstas y usa el runner embebido existente, **NO VERIFICADO** en esta copia porque falta `node_modules/vite`.
- Build Editor/Player **NO VERIFICADO**: `npm run build` devuelve `vite: not found` por dependencias no instaladas.
- QA visual **PENDIENTE**. Estado del Gate S06: **IMPLEMENTADO · NO APROBADO · NO CERRADO**.

Este documento no constituye evidencia de comportamiento visual validado ni cierre funcional.
