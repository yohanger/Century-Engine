# QA del Inspector de nodos

Baseline: 3958 archivos cotejados byte a byte con la copia original disponible. No se verificó el árbol local del usuario.

| Verificación | Resultado |
|---|---|
| Focal Node (contratos de fuentes) | 11/11 PASS |
| Regresiones, baseline | 134 PASS / 13 FAIL de 147 |
| Regresiones, entrega | 134 PASS / 13 FAIL de 147 |
| Identidad de fallos | Misma lista de 13 casos; sin fallos adicionales en estas suites |
| Sintaxis JavaScript | PASS (bloques extraídos y scripts; no compilación Vue) |
| Build Vite | BLOQUEADO: vite no encontrado |
| Runner Electron | BLOQUEADO antes del arranque: falta Vite |
| Apariencia, comportamiento DOM y responsividad | NO VERIFICADOS |
| Aprobación y cierre | PENDIENTES |

El runner `node-inspector-professional-ux-electron` programa 15 comprobaciones con constructor nativo del proyecto y diagnóstico previo a imports. No se ejecutaron las 15 comprobaciones en Electron. No se afirma QA visual ni runtime PASS. Los logs se incluyen con el CHANGE.

QA local: `npm run test:suite -- node-inspector-professional-ux` y `npm run test:suite -- node-inspector-professional-ux-electron`. Comprobar primitivas, mallas, nodos estructurales y selección múltiple; colores XYZ, scripts y materiales, plegado, edición, Undo/Redo y ancho estrecho. Probar visualmente los nodos especializados existentes.

Los 13 fallos históricos constan en los logs de antes/después. Se cambió una assertion estática del material para reflejar el reemplazo autorizado de su botonera por el menú. No se modificaron los casos fallidos. La ausencia de nuevas regresiones se limita a las suites ejecutadas.

El crash, NaN y la captura del puntero corresponden al Gate de estabilidad separado y no están resueltos por esta entrega. La corrección diagnóstica anterior de Escena permanece pendiente de QA local.
