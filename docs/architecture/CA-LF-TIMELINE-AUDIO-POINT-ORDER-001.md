# CA-LF-TIMELINE-AUDIO-POINT-ORDER-001

**Tipo:** Contract Amendment de presentación del Inspector de Timeline.
**Vinculación:** `LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-002`.
**Decisión del usuario (2026-11-09):** «Perdón FIFO. First in, first out. Me equivoqué».
**Autorización exacta del Gate (2026-11-09):** `Listo. LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-002 autoriza comenzar`.
**Estado:** incorporado documentalmente al Gate autorizado; QA local y cierre del Gate PENDIENTES. No se atribuye aprobación independiente del CA al usuario.

## Contrato supersedido
La regla **LIFO exclusivamente visual** definida en `LF-TIMELINE-AUDIO-POINT-LIFO-S13-G008-G004-INTEGRAL` y repetida en su documentación/QA queda **SUPERSEDIDA** por la instrucción posterior del usuario y el Gate FIFO autorizado. Se conserva la documentación previa como histórico; no se borra ni reescribe.

## Regla vigente FIFO
1. El Inspector muestra primero el punto creado primero y al final el creado más recientemente: `Punto-1, Punto-2, Punto-3, Punto-4` en el ejemplo nominal de cuatro altas sucesivas.
2. Mover un punto en el tiempo, modificar su volumen, renombrarlo o plegarlo no cambia su lugar visual. Eliminar uno conserva el orden relativo de los demás.
3. El ordinal `createdOrder` previamente introducido sigue siendo opcional y persistente. Los proyectos guardados mientras regía la vista LIFO usan ese mismo ordinal para mostrarse FIFO **sin reescritura de datos al abrirlos**.
4. Para puntos históricos que carecen de ordinal real, se usa su orden cronológico existente como orden inicial determinista; no puede reconstruirse la secuencia histórica de creación que no fue guardada.
5. La reproducción por `volumeAutomationAt` y `scheduleVolumeAutomation`, Preview, Player, el orden temporal del arreglo, Ctrl + doble clic, los fundidos, limitación de 64 puntos y los controles existentes **no cambian**.
6. La vista es derivada: no se crea una nueva lista persistente ni se modifica el modelo al plegar o renderizar.

## Resolución arquitectónica
**EXTEND BEFORE DUPLICATE.** Reutilizar `volumeAutomationVisualOrder` e invertir el criterio visual a ascendente. No cambiar el esquema de persistencia, AudioEngine ni `TimelinePanel.vue` por un requisito exclusivamente visual.

## Pruebas vinculantes
Comprobar altas fuera de orden temporal, lectura de datos guardados con `createdOrder`, persistencia, Undo/Redo, eliminación, renombrado, bloqueo, límites, interposición de Preview/Player y Electron Inspector real. No declarar aprobado ni cerrado sin evidencia local del usuario.
