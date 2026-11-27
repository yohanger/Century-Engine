# S06 CORR-004 — Matriz de aceptación

Estado del Gate: **IMPLEMENTADO, QA LOCAL PENDIENTE, NO CERRADO**.

| ID | Procedimiento | Aceptación | Estado en entrega |
| --- | --- | --- | --- |
| C4-N01 | Ejecutar `node --test scripts/test-script-editor-core-s06-corr004.mjs` | 23/23 PASS | PASS |
| C4-N02 | Ejecutar regresiones S03/S04/S05/S06/Multiscript en `scripts/` | 253/253 PASS | PASS |
| C4-E01 | Ejecutar `node --test scripts/test-script-editor-core-s06-corr004-electron.mjs` | 1 PASS; al menos 200 controles diferenciales de entrada nativa | **NO VERIFICADO** |
| C4-E02 | Comparar `///////` en CodeMirror aislado y Script Editor integrado | Cada `/` visible; documento, cursor y store íntegros | **NO VERIFICADO** |
| C4-E03 | Comparar `*******` en ambos editores | Cada `*` visible; sintaxis JS puede mostrar error | **NO VERIFICADO** |
| C4-E04 | Comparar `/**/` y `/*****/` | Cierres correctos sin añadir, descartar ni sustituir teclas | **NO VERIFICADO** |
| C4-E05 | Escribir `/*` seguido de funciones, cerrar con `*/` | Texto intacto; coloración JS correcta; outline provisional conforme CA-002 | **NO VERIFICADO** |
| C4-E06 | Cambiar entre dos scripts, restaurar y guardar | Identidad, documento e índice aislados; no se altera ventana/viewport | **NO VERIFICADO** |
| C4-E07 | Selección, Undo/Redo, pegado, borrado y reapertura | Correspondencia exacta texto visible/documento/store | **NO VERIFICADO** |
| C4-B01 | `npm run build` | Editor + Player compilados sin error | **NO VERIFICADO** |
| C4-V01 | `npm run electron` en equipo del usuario | QA visual aprobado explícitamente | **PENDIENTE** |

Comandos desde la raíz del SOURCE_BASELINE actualizado:

```bash
node --test scripts/test-script-editor-core-s06-corr004.mjs
node --test scripts/test-script-editor-core-s06-corr004-electron.mjs
npm run build
npm run electron
```

La suite Electron usa la instalación de Electron de LevelForge, Vite y CDP nativo; no abre Brave ni Chromium externo. La prueba de 50 teclas inserta `text` por `Input.dispatchKeyEvent` y controla CodeMirror **aislado e integrado**. La preparación no es evidencia de ejecución. Se requiere `npm ci` solo si la extracción no tiene dependencias.

### Interpretación de fallos

- **Fallo en ambos editores:** investigar entrada CDP/CodeMirror/Chromium y los caracteres enviados antes de culpar al store.
- **Fallo solo integrado:** investigar extensiones, updateListener, watchers, render y sincronización entre `EditorState.doc` y store.
- **Texto correcto con color verde tras `/*`:** comportamiento de JavaScript, no desaparición de caracteres.
- **Diagnósticos o hover inhabilitados antes de un comentario posterior:** regresión del bug posicional de `mask` y bloqueo del Gate.

**Evidencia a devolver:** salida completa de la prueba Electron y del build; confirmación o video del QA manual. No repetir QA de geometría previamente aprobada salvo regresión detectada.
