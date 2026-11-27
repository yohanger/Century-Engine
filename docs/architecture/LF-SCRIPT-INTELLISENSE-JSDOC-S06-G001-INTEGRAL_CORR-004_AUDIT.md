# S06 CORR-004 — Auditoría del núcleo del Script Editor

**Gate autorizado:** `LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-004`.
**Autorización literal:** «Listo. LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-004 autoriza comenzar».
**Base vinculante:** SOURCE_BASELINE S06 CORR-003 QA-001. Se mantienen CA-001 y CA-002.

## Evidencias y resultados

**OBSERVADO POR EL USUARIO:** los dos videos muestran secuencias repetidas `/` y `*`, coloración de comentarios, errores sintácticos para asteriscos sueltos y desaparición temporal de símbolos mientras `/*` permanece abierto. Las correcciones S06 CORR-001/002/003 no obtuvieron aprobación visual del problema principal. En las grabaciones examinadas no se acreditó una eliminación permanente de bytes de texto. El resultado Electron de CORR-003 anterior falló C3-E15 por un selector del fixture que no cambió de documento; QA-001 corrigió la selección, sin evidencia Electron posterior.

**OBSERVADO EN CÓDIGO:** `ScriptEditor.vue` utiliza un `EditorView` con `basicSetup`, `javascript()` y `EditorView.updateListener`. Guarda cambios mediante `setScriptCode`. Ya no existe el `inputHandler` de CORR-001 ni un `transactionFilter` propio. El índice provisional de navegación de CA-002 se mantiene separado del código ejecutable.

**CAUSA RAÍZ DEMOSTRADA:** `mask(text, pos)` de `types-text.js` enmascaraba el documento completo, pero devolvía `comment: inLine || inBlock` calculado en **EOF**, aunque `pos` estuviese antes de un comentario posterior. `analysis.describeAt()`, `signatureAt()` y `jsintel.typedComplete()` consultan ese estado posicional. Por ello podían suprimir ayudas donde el cursor no estaba comentado.

**NO DEMOSTRADO:** que CodeMirror pierda pulsaciones en producción en el baseline CORR-003 QA-001. La coloración verde a partir de un bloque `/*` sin cierre y el diagnóstico de `*******` como JavaScript inválido son semántica legítima del lenguaje, no prueba de pérdida de texto. No se modifica la gramática para ocultarlo.

## Decisión de arquitectura

1. **EXTEND BEFORE DUPLICATE:** corregir la captura de estado en `types-text.js`, en el mismo recorrido de enmascarado. La cadena enmascarada y `unclosedBlockStart` siguen representando el documento completo; `string` y `comment` representan exclusivamente la posición consultada.
2. No tocar `ScriptEditor.vue`, Vue/store, minimapa, tema ni Core CodeMirror sin evidencia de corrupción. No introducir autocierres ni gestores paralelos.
3. Crear una **prueba diferencial Electron** que monta CodeMirror aislado con `basicSetup + javascript()` y el `ScriptEditor` real, escribe la misma secuencia mediante CDP nativo y verifica cada pulsación: documento, cursor, DOM visible y store.
4. Extender mínimamente `qa-electron-webgl.cjs` para pasar el carácter `text` en las teclas que lo declaren. Sin cambiar las fixtures antiguas ni el contrato de Electron embebido.
5. Si Electron aislado también falla, investigar biblioteca/entrada de Chromium; si falla solo el integrado, investigar extensiones y sincronización. **No declarar ninguna de esas causas antes de reproducirla.**

## Preservación y alcance

Ningún cambio en runtime, Player, formato de scripts, CodeMirror como biblioteca, dependencias de producción, UI Designer, docking ni formato de proyecto. CA-001 prohíbe consumir caracteres y CA-002 exige referencias provisionales durante comentarios incompletos; ambos permanecen vigentes.

**Estado:** implementación Node verificada; Electron, build y QA visual NO VERIFICADOS; S06 ABIERTO.
