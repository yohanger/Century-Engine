# Century Engine — Cobertura de Corte bucle sobre selección de caras

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-003-SELECTED-FACE-REGION-LOOP-COVERAGE`.

**Autorización literal:** `Listo. CENTURY-EDITOR-MESH-S01-G001-CORR-003-SELECTED-FACE-REGION-LOOP-COVERAGE autoriza comenzar`.

**SOURCE_BASELINE:** `CENTURY-EDITOR-MESH-S01-G001-CORR-002-SELECTION-AWARE-LOOP-CUT_SOURCE_BASELINE.zip`.

## Defecto confirmado

CORR-002 filtraba los cuadriláteros del recorrido por la selección pero solo avanzaba a través de un único anillo de aristas opuestas desde la arista inicial. Si la selección conectaba caras por lados paralelos a ese recorrido, el anillo no llegaba a todas las caras seleccionadas compatibles. La vista previa y la geometría real coincidían, pero ambas cubrían una región incompleta.

Una reproducción controlada con tres caras conectadas y una arista inicial transversal produce en la fuente anterior: selección `[0,1,2]`, recorrido `[0]`, una línea de preview. La implementación corregida obtiene: recorrido `[0,1,2]`, tres líneas de preview.

## Implementación

- `ringOf()` conserva exactamente su recorrido histórico para Loop Cut global sin filtro de caras.
- Con un conjunto de caras elegido, utiliza el grafo de adyacencias por aristas de sus cuadriláteros conectados a la arista inicial. Se propagan dos orientaciones: el par de aristas opuestas elegido para cortar cada cara y la dirección del desplazamiento de los cortes.
- La selección por caras no modifica el comportamiento de otras herramientas. Se mantiene el mismo conjunto congelado en `session-modal.js` para picking, preview, slide, confirmación y operación real.
- Un recorrido no salta a caras seleccionadas que solo comparten vértice o que pertenecen a otra componente desconectada. Si una cara conectada seleccionada no admite topología cuadrangular coherente, se rechaza el corte regional en vez de aplicar un subconjunto silencioso.
- Las aristas compartidas entre caras recortadas comparten los mismos vértices de intersección. Las caras limítrofes que no participan reciben los vértices de borde, sin introducir un segundo algoritmo de corte.
- Si están seleccionadas todas las caras y el recorrido regional no admite una orientación coherente, se mantiene la semántica global acreditada en CORR-002 para mallas como el cubo; este caso no equivale a prometer un corte local sobre todas las caras de un sólido arbitrario.
- `loopCutLines()` y `loopCut()` consumen exactamente el mismo resultado de `validLoopCutRing()`, evitando disparidad entre previsualización y geometría.
- Se corrige una prueba anterior que confundía «fuera del anillo antiguo» con «geométricamente desconectado»; ahora usa dos caras realmente separadas.

## Fuera del alcance

No se modificaron `setPointerCapture`, Cuchillo, gizmos, scripts, políticas CSP, generadores paramétricos, reducción de polígonos, shaders ni controles de navegación. Se reutilizó el código existente (`cuts.js`) sin introducir herramientas duplicadas. No se realizaron operaciones Git.

## Criterios de aceptación

1. Una selección contigua de tres caras se corta completa aunque una arista inicial recorra una sola cara en el algoritmo antiguo.
2. Selecciones conectadas de forma rectangular, de una sola cara, con dirección y orden de índices distintos producen cortes coherentes.
3. La previsualización y los vértices generados coinciden también para cortes múltiples y deslizamiento.
4. Se conserva la conectividad de aristas, las caras válidas, el volumen en sólidos compatibles y las UV/colores/pesos al reconciliar atributos.
5. Las caras desconectadas no se cortan sin selección explícita de una nueva región; aristas ajenas son rechazadas sin mutación.
6. El modo global sin selección y la compatibilidad anterior de selección completa de cubo no cambian.
7. Confirmar el modal aplica una única transacción de edición; Escape cancela sin afectar la malla.
8. QA visual Electron, Undo/Redo real, Play y compilación requerirán evidencia adicional.

**Estado:** IMPLEMENTADO · TEST DIRIGIDO PASS · NO COMPILADO · QA ELECTRON NO VERIFICADO · NO APROBADO · NO CERRADO.
