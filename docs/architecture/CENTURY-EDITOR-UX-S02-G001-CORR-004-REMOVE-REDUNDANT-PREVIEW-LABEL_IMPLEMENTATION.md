# Century Engine — CORR-004: etiqueta redundante de vista previa

**Gate autorizado:** `CENTURY-EDITOR-UX-S02-G001-CORR-004-REMOVE-REDUNDANT-PREVIEW-LABEL`.

## Baseline y alcance

Se tomó el SOURCE_BASELINE entregado para CORR-003. Sus 3297 archivos coinciden con la copia local anterior a este cambio; no se detectaron diferencias previas. El archivo afectado es `src/components/ViewBar.vue`.

La barra de herramientas presentaba el chip `Vista previa` cuando `!store.play.on && tab === 'game'`. Se retiró únicamente el nodo visual de ese chip. Permanecen los indicadores `En pausa` y `Sin jugador`, junto con las propiedades de aspecto, escala y estadísticas.

No se modificó el estado `store.play`, el sistema de foco, la resolución de cámara, el docking, la asignación de canvas ni el observador. No se realizaron operaciones Git.

## Estado

Implementado en fuente. Pruebas Node focalizadas y comprobación sintáctica PASS. Build y QA Electron no verificados. No se presupone aprobación ni cierre.
