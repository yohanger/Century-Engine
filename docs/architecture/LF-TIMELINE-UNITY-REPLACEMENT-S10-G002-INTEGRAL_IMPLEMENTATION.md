# LF-TIMELINE-UNITY-REPLACEMENT-S10-G002-INTEGRAL

**Proyecto:** LevelForge · **Sprint:** S10 Unity Timeline Parity · **Gate:** G002 INTEGRAL

**Autorización exacta:** «Listo. LF-TIMELINE-UNITY-REPLACEMENT-S10-G002-INTEGRAL autoriza comenzar».

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G001_CLOSURE_SOURCE_BASELINE.zip` (G001 y CORR-001 rework aprobados, con evidencia y ledger). G001 permanece CERRADO; S10 sigue abierto.

**Estado actualizado de G002 (2026-11-06):** CERRADO · APROBADO POR EL USUARIO. Se preservan los resultados previos de Node (24 PASS/1 SKIP, regresión 141 PASS/6 SKIP); compilación y pruebas exhaustivas Player **NO VERIFICADAS** por ausencia de logs nuevos. El cierre documental no modifica código.

## 1. Auditoría del código existente

- `src/components/TimelinePanel.vue` ya tenía `sel` para una clave, `keyDown` con arrastre individual, `pickSegment`, rectificado de segmentos, `snapT`, creación de pistas, preview, su recurso por ID y sincronización con el Inspector.
- `src/components/TemporalResourceInspector.vue` compartía el Inspector contextual entre Timelines y animaciones, con una sola clave seleccionada. `selectTemporal` en `src/core/state/state.js` es la ruta ya autorizada al Inspector.
- `src/core/timeline/model.js` define las claves, pistas y normalización, mientras `src/core/state/history.js` ya captura `timelines` y tiene `commit`, `undo` y `redo` del proyecto.
- Las pistas `bake` son físicas y de solo lectura. El Player y el importador FilmMaker consumen el mismo modelo normalizado; duplicar ese modelo sería una regresión.

## 2. Operaciones implementadas

1. **Selección múltiple** por Ctrl/Cmd + clic (alternar claves de cualquier pista), Mayús + clic (rango dentro de una pista) y Mayús + arrastre sobre un carril vacío (región rectangular, incluso entre pistas). La selección se expresa mediante referencias `{tr,k}` editoriales y no se persiste en `.lfproj`.
2. **Arrastre conjunto:** una sola traslación temporal para todas las claves seleccionadas; conserva distancias e IDs, ordena cada pista y limita el movimiento al intervalo `[0, timeline.duration]`. Una operación de drag produce **un `commit` al soltar**; cancelar el gesto restaura las posiciones anteriores, sin `commit`.
3. **Snap contextual** al cabezal, al inicio/fin de la duración, a claves no seleccionadas y a la rejilla definida por el usuario. La tolerancia usa píxeles y la escala de zoom; desactivar Snap permite tiempo libre. Las referencias se buscan eficientemente por clave seleccionada en una lista temporal ordenada.
4. **Duplicar y eliminar conjunto:** `duplicateTimelineSelection` clona datos reales e IDs de claves y comandos; `deleteTimelineSelection` elimina solo los IDs seleccionados. Se registra una operación de historial por acción. `Ctrl+D` y Supr funcionan con foco en Timeline; el menú contextual y los controles de selección reutilizan las mismas funciones.
5. **Segmentos:** el clic selecciona la clave inicial existente; arrastrar el cuerpo mueve el segmento completo usando las dos claves límite y las claves adicionales seleccionadas, sin alterar su longitud. El asa original S09 sigue ajustando duración. No se crea un recurso clip nuevo.
6. **Inspector contextual:** `selectTemporal` acepta referencias adicionales opcionales solo para selección múltiple de claves de Timeline. El Inspector existente informa cantidad de claves, cantidad de pistas y tiempos mínimo/máximo; permite desplazar numéricamente, duplicar y eliminar el conjunto. Para una clave siguen vigentes los campos previos.
7. **Reversibilidad:** el estado de la selección sigue siendo editorial; no duplica la evaluación/preview y el historial continúa siendo el original del Editor. La selección se invalida de forma conservadora al cambiar recursos o deshacer claves eliminadas.

## 3. Restricciones y exclusiones

- **NO** se tocan `src/filmmaker/`, `NleTimeline.vue`, FilmMaker móvil, `src/engine/runtime/timeline/*`, Play/Player, Cinematics, formatos de exportación, ni la identidad de recursos.
- **NO** se incorporan código, recursos visuales ni ejecutables de Unity. La referencia es su experiencia pública de Timeline 1.8.13.
- **NO** se introducen Mix, Ripple, Replace, grupos de pistas, blending nuevo ni edición general de curvas: están pendientes en Gates futuros.
- No se introduce historial temporal paralelo ni capas de gestión global. Se amplía `model.js`, `TimelinePanel.vue`, el Inspector original y la firma opcional de `selectTemporal`.
- Undo/Redo está conectado a `commit` y al historial original, pero **el QA local de Undo/Redo debe comprobarse**: la ejecución Node de pruebas unitarias no reproduce todo el runtime de Electron.

## 4. Evidencia y límites

Prueba nueva: `scripts/test-timeline-unity-replacement-s10-g002-integral.mjs`, **24 PASS / 1 SKIP / 0 FAIL**. Incluye cinco pruebas de manejadores reales en aislamiento y controles puros del modelo. Regresión final S04/S07/S08/S09/S10: **141 PASS / 6 SKIP / 0 FAIL**, ejecutada después de la integración del arrastre de segmentos y de los últimos cambios del Inspector.

`npm ci --offline` falló por `zip-stream@4.1.1` ausente en caché: no se ha podido compilar con Vue/Vite ni ejecutar Electron en este entorno. El usuario deberá realizar esas verificaciones y comprobar el desplazamiento, recorte, Inspector, Undo/Redo, guardado y Player. La ejecución de modelos JavaScript, aunque sea PASS, **no equivale a QA visual**.

**Siguiente acción real:** QA local del usuario → evidencia → corrección si falla → aprobación → cierre → ledger. No comenzar G003 antes de cerrar G002.

## Cierre posterior al QA del usuario

El usuario declaró «Aprobado. SIgamos.», aceptando G002. El SOURCE_BASELINE de cierre solo actualiza documentación/ledger y añade evidencia de la aprobación, preservando byte a byte el código aprobado. Se puede planificar G003, pero no implementar sin la autorización literal de G003.
