# QA — Selección jerárquica

| Verificación | Resultado |
|---|---|
| Sintaxis pointer.js | PASS |
| Runner específico Node con dobles DOM/Three | 18/18 PASS |
| Ocho suites históricas | 79/92 PASS, 13 FAIL |
| Comparación con baseline exacto | Mismos 13 casos FAIL; ninguna regresión adicional detectada |
| npm run build | FAIL de entorno: vite no encontrado (127); compilación NO VERIFICADA |
| QA visual Electron / Player | NO VERIFICADO |
| Aprobación / cierre | PENDIENTES |

Los fallos históricos son tres de gizmos/multiselección y diez del antiguo selector global de instancias; los nombres coinciden exactamente con el baseline. No se atribuye causa raíz ni se reparan en este alcance. La copia de trabajo anterior se comparó con el ZIP acumulativo: 0 diferencias de contenido, 0 archivos ausentes y 0 adicionales. No hay acceso a cambios locales no incluidos en el archivo. El Modo Local anterior continúa pendiente de aprobación.

Logs: `docs/qa/evidence/hierarchical-viewport-selection/`. Runner: `node --test scripts/test-hierarchical-viewport-selection.mjs`. Regresión: `node --experimental-vm-modules --test scripts/test-subtract-picking-priority.mjs scripts/test-selection-highlight-multi-visibility.mjs scripts/test-editor-ux-s01-g001.mjs scripts/test-editor-ux-s01-g002-ext-001.mjs scripts/test-mesh-local-view.mjs scripts/test-scene-instancing-g001.mjs scripts/test-scene-instancing-g001-corr001-ux.mjs scripts/test-scene-instancing-g001-corr002-shortcut.mjs`.

## QA local exigido

1. Crear Node3D con dos mallas hijas y otro nivel anidado. Hacer clic sobre cada malla: debe seleccionar el padre inmediato y mostrar su Inspector y gizmos. Trasladar y rotar el padre; comprobar que sus descendientes se mueven con él. Escalar Node3D conforme al contrato espacial existente.
2. Hacer doble clic sobre la superficie de un hijo, fuera de las asas del gizmo; seleccionar directamente el hijo. Confirmar que Jerarquía permite seleccionar cualquier hijo editable con un clic. Entrar en Edit Mesh y usar `/` para aislarlo, y Tab para salir.
3. Shift+clic sobre varios hijos del mismo padre no duplica la selección. Ctrl/Cmd+clic alterna el padre. Probar múltiples padres, selección de padre e hijo y Undo/Redo de transformaciones.
4. Probar padres bloqueados/ocultos, Substract, terreno frontal, escena vinculada, navegación, arrastre, cambio de escena y Play. La selección vinculada permanece atómica. No se modifica la geometría ni la escena al seleccionar.
5. Ejecutar `npm run build` y `npm run electron`; adjuntar evidencia local. No considerar aprobado/cerrado hasta aprobación explícita.
