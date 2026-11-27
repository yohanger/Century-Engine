# QA — Mover a grupo

## Evidencia ejecutada
- Cotejo SOURCE_BASELINE: 3862 archivos, cero diferencias locales respecto de la copia materials_work. Sin inspección de cambios externos al ZIP.
- `npm run test:suite -- move-to-collection-group`: 18/18 PASS (Node v22.16.0). Planificación real, validación jerárquica real y dobles de cálculo espacial/historial; comprobaciones del código Vue. No acredita ejecución Vue ni matrices Three.js reales.
- Regresiones: `test-editor-hierarchy-reorder-g001`, `test-editor-hierarchy-reorder-corr001`, `test-editor-menus-ux-s01-g001-integral`, `test-editor-menubar-ux-g001`, `test-editor-menubar-ux-g001-corr-001`, `test-node-core-s01-g001`, `test-node-physics-s02-g001`, `test-trimesh-reference-integrity`: 136 PASS, 8 FAIL, 1 SKIP (145 pruebas). Mismos nombres de los ocho fallos y mismo total en el baseline; se preservan sin atribuir causa nueva. Logs completos adjuntos.
- `node --check`: módulos JS/MJS modificados y bloques script extraídos de Vue/fixture, PASS. No es compilación Vue.
- `npm run build`: exit 127 (`vite: not found`). Editor/Player NO VERIFICADOS.
- `node --test scripts/test-move-to-collection-group-electron.mjs`: runner bloqueado por `Falta Vite; ejecutar npm ci antes del QA`. No se ejecutó el fixture ni se acredita QA Electron.

## QA local requerido
1. `npm run test:suite -- move-to-collection-group-electron` con dependencias instaladas; `npm run build`.
2. En Century, clic derecho sobre un nodo; pasar por Mover a grupo; probar búsqueda por nombre, ruta, acentos, borrar consulta y desplazamiento con más de 10 destinos. Verificar buscador fijo y apertura lateral en los bordes.
3. Mover selección múltiple entre estructuras con transformaciones representables; probar Undo/Redo y persistencia al guardar/reabrir. Confirmar que el movimiento no duplica raíces ni altera sus posiciones mundiales.
4. Probar bloqueos heredados, descendientes, escenas vinculadas, nodos físicos, transformaciones incompatibles y destino actual. Verificar que no hay movimientos parciales. Verificar apertura, selección y teclado de otros menús.
5. Evaluar tiempos de apertura en escenas grandes; no hay benchmark acreditado.

Estado: implementado en fuentes; QA Node específico PASS; compilación y QA Electron NO VERIFICADOS; pendiente de aprobación/cierre.
