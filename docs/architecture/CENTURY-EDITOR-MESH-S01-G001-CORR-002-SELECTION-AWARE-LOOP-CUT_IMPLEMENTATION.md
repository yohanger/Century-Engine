# Century Engine — Corte bucle condicionado a la selección

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-002-SELECTION-AWARE-LOOP-CUT`  
**Autorización:** «Listo. CENTURY-EDITOR-MESH-S01-G001-CORR-002-SELECTION-AWARE-LOOP-CUT autoriza comenzar».  
**Fuente de entrada:** `CENTURY-EDITOR-MESH-S01-G001-CORR-001-INTEGRAL-MESH-EDIT-AND-CONSOLE-STABILITY_SOURCE_BASELINE(1).zip`.  
**Estado:** implementado en fuentes · pruebas dirigidas PASS · no compilado · QA Electron no verificado · pendiente de aprobación y cierre.

## Diagnóstico comprobado

- `ringOf()` recorría la continuidad de cuadriláteros sin consultar la selección activa.
- `validLoopCutRing()`, `loopCutLines()` y `loopCut()` heredaban ese recorrido, por lo que la previsualización y la geometría cortaban el anillo completo aunque la herramienta comenzara sobre una cara seleccionada.
- `modalMethods.startModal()` guardaba una copia de `baseSel`, pero no la empleaba para limitar los anillos. Las dos fases del modal y `loopCutOp()` no pasaban ninguna selección de caras.
- `normalize()` conserva `sel.f` como selección principal solo en modo Cara. En modo Arista o Vértice, `sel.f` puede ser una selección derivada de otros elementos, por lo que no debe restringir automáticamente el corte.

## Mecanismo y contrato de comportamiento

- La selección se congela al iniciar el modal: en modo Cara, con al menos una cara seleccionada, se crea un conjunto de índices permitidos. En otro modo, o sin caras seleccionadas, permanece el recorrido global.
- Se extiende el mecanismo existente con un parámetro opcional para limitar `ringOf()`, `validLoopCutRing()`, `loopCutLines()` y `loopCut()`. La búsqueda no atraviesa caras ajenas a ese conjunto.
- El corte está anclado a la arista bajo el cursor: si ninguna cara permitida es incidente, no existe preview ni confirmación válida. Las caras seleccionadas desconectadas no se cortan por propagación independiente.
- El modal utiliza el mismo conjunto congelado al elegir la arista, deslizar, dibujar el preview, verificar y confirmar. `loopCutOp()` lo entrega al generador topológico sin crear herramientas duplicadas.
- Las caras vecinas a los extremos reciben los vértices insertados en aristas compartidas para preservar conectividad; no se les aplica una división interior del corte fuera de la selección.
- Permanecen los límites originales de 1–32 cortes, desplazamiento controlado, escape/cancelación, selección de componentes, atributos de malla, serialización y transacción única Undo/Redo.
- `setPointerCapture` y el resto de los controles de navegación, Cuchillo, generadores paramétricos, CSP y sombreado quedan fuera de alcance.

## Archivos y pruebas

- `src/core/mesh/cuts.js`: recorrido, validación, preview y modificación limitados mediante argumento opcional.
- `src/core/mesh/ops.js`: el wrapper pasa el conjunto de caras a la operación existente.
- `src/core/mesh/session-modal.js`: congelación de selección y uso de los mismos límites en ambas fases.
- `scripts/test-mesh-loopcut-selection-integrity.mjs`: 15 pruebas sobre geometría, selección, límites, modal, preview, 32 cortes, UV y persistencia.
- `scripts/qa-suites.json`: grupo `mesh-loopcut-selection` con tests de geometría, Edit Mesh, parámetros y TriMesh.

## Límites y madurez

El corte local está disponible cuando se seleccionan caras en modo Cara; en modo Arista o Vértice se conserva el Loop Cut global. No sustituye Cuchillo ni promete cortes independientes sobre geometría no cuadrangular. El QA visual de Electron/Player y la compilación siguen pendientes. No se ha cerrado el Gate por ausencia de esa evidencia y de aprobación posterior del usuario.
