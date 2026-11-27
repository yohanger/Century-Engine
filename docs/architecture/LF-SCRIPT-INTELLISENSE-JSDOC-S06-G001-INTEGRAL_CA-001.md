# Contract Amendment CA-001 · S06 CORR-002 · Integridad de entrada

Gate autorizado: `LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-002`.
Autorización literal: «Listo. LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-002 autoriza comenzar».

## Contradicción identificada

CORR-001 introdujo el autocierre personalizado de `/**` mediante `EditorView.inputHandler` y la omisión de una `/` introducida por el usuario cuando seguía a un `/**/` generado. El usuario informó que al escribir secuencias de `/` y `*` desaparecían caracteres y se recuperaban al borrar. La regla de autocierre anterior es incompatible con la prioridad contractual de conservar **cada carácter introducido**.

## Sustitución vinculante

1. **SUPERSEDIDO**: autocierre `/**` y consumo de `/` mediante `jsdocInputEdit` y `EditorView.inputHandler`.
2. **VIGENTE**: la escritura de texto corresponde a CodeMirror, sin interceptores propios que cancelen entradas de `/` o `*`. Escribir `/**/`, `///////`, `*******` o cualquier secuencia no puede eliminar ni sustituir caracteres automáticamente a nombre de JSDoc.
3. **VIGENTE**: `/**` sin cierre `*/` constituye un comentario de bloque abierto según JavaScript. El resaltado puede cambiar legítimamente mientras esté incompleto, pero ni el documento ni el store deben perder texto. No se simula sintaxis diferente para disimular un comentario sin cerrar.
4. El análisis `@type`, `@typedef`, `@param`, `@returns`, hover y diagnósticos permanece; no cambia código de ejecución, formato ni otros editores.
5. CORR-001 continúa aprobado parcialmente para identidad de Script Editor, navegación de documentos y geometría. El nuevo contrato reemplaza solo su autocierre personalizado defectuoso.

## Pruebas obligatorias

Secuencias repetidas por entrada real Chromium/CodeMirror; igualdad después de **cada pulsación** del texto y cursor; store, líneas visibles, plegado, Undo/Redo, cambio de script, guardado y reapertura mediante QA local. Electron embebido obligatorio para verificar interacción. El fixture no es evidencia PASS hasta su ejecución real.

Estado: enmienda incluida por autorización de CORR-002. No modifica contratos de Player, UI Designer o S03/S04.
