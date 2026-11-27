# Contract Amendment CA-002 — S06 CORR-003: índice de métodos durante escritura incompleta

**Gate autorizado:** `LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003`.

**Autorización:** «Listo. LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-003 autoriza comenzar».

**Baseline vinculante:** SOURCE_BASELINE S06 CORR-002 QA-001. Complementa CA-001 sin invalidar la protección de la entrada.

## Evidencia y contradicción de UX

En el video local del 03-11-2026 se observa que, al quedar abierto `/*`, las funciones posteriores pasan a color de comentario y «Métodos y regiones» cae de 3 a 0; al cerrar `*/` reaparecen. La sintaxis es legítima y el texto no aparece borrado. Sin embargo, la navegación pierde toda referencia a símbolos previamente reconocidos. La antigua dependencia directa de `outlineOf(code.value)` era inapropiada para una interfaz de navegación mientras se edita una construcción temporalmente incompleta.

CA-001 impide introducir un `EditorView.inputHandler` que consuma `/`/`*`, y mantiene el resaltado JS real. La corrección **no vuelve a autorizar autocierre que sustituya caracteres**. La gestión transaccional permitida es el mapeo de posiciones mediante `update.changes.mapPos(...)`, no la modificación silenciosa del código.

## Contrato vinculante

1. **Lenguaje autoritativo:** JavaScript sigue reconociendo `/*` sin cierre como comentario de bloque hasta el final del archivo. CodeMirror, el motor de tipos, los diagnósticos y la ejecución mantienen ese significado; no se simula código activo.
2. **Documento autoritativo:** CodeMirror conserva la entrada carácter por carácter y sincroniza con `setScriptCode`. No se añadirá un segundo documento ni se interceptarán pulsaciones.
3. **Índice separado:** «Métodos y regiones» muestra los símbolos sintácticamente confirmados y, cuando se abre un comentario incompleto, conserva los símbolos previamente indexados que quedan ocultos **solo como referencias provisionales**. Quedan atenuados e identificados; no se confunden con símbolos ejecutables ni aparecen como símbolo activo en la ruta superior.
4. **Mapeo de posición:** los símbolos provisionales siguen los cambios de posición mediante el `ChangeDesc` real de CodeMirror. Al cerrar `*/`, vuelve a calcularse el índice genuino sin arrastrar referencias obsoletas. Si el documento contiene funciones comentadas deliberadamente mediante un bloque completo, no se muestran como código.
5. **Aislamiento:** el índice se deriva por ID de script, no se comparte entre scripts Global/Nodo. El cambio de script no desmonta CodeMirror ni reinicia el estado de docking ya aprobado.
6. **Sin invenciones:** si el documento empieza con un comentario abierto sin ningún índice válido anterior, el editor no inventa funciones. Debe informar del comentario incompleto.
7. **Medios indispensables:** pruebas Node y fixture Electron embebido con interacción real, documentación y ledger de seis hojas; build Editor/Player y QA visual por el usuario antes de cierre.

## Exclusiones

No cambia el runtime, Player, UI Designer, gramática de JavaScript, persistencia de scripts, formato `.ui`, motor de compilación ni `game-api.d.ts`. No se crea un gestor adicional, segundo lexer o editor alternativo.

## Autoridad

CA-001 **SIGUE VIGENTE** para integridad del texto. CA-002 precisa el comportamiento de navegación y la gestión del estado transitorio. No existe una restricción de CA-001 que sea necesario superseder para esta solución, por lo que la prohibición de autocierre personalizado permanece intacta.

**Estado:** IMPLEMENTADO; Electron y build NO VERIFICADOS; QA local del usuario PENDIENTE; Gate ABIERTO.
