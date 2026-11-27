# QA — Modo Local Edit Mesh

Node v22.16.0. Resultados de ejecución en el entorno de entrega:

| Comando | Resultado |
|---|---|
| `node scripts/qa-suite.mjs mesh-local-view` | 8/8 PASS (modelo de árbol/renderer simulado, shortcuts, restauración en excepción, integración estática) |
| `node --test scripts/test-mesh-loopcut-selection-integrity.mjs scripts/test-mesh-parametric-topology.mjs scripts/test-mesh-merge-selected-faces.mjs` | 44/44 PASS |
| `node --test scripts/test-viewport-docking-and-camera-loopcut-s02-g001.mjs` | 18/20 PASS, mismos fallos 15 y 16 que la copia de trabajo del baseline anterior |
| `node --check` sobre los módulos JS/MJS modificados | PASS |
| `npm run build` | BLOQUEADO: vite no encontrado (127) |
| QA Electron / Player exportado | NO VERIFICADO |

Logs: `docs/qa/evidence/mesh-local-view/`. Los fallos de docking corresponden a las expectativas de foco/Play de la suite histórica; no se atribuye causa raíz. La evidencia Node no equivale a WebGL o Electron reales.

## QA local requerido

1. Abrir una escena con malla hija de un grupo transformado, otras mallas, terreno, agua, vegetación y clima; entrar en Edit Mesh con Tab.
2. Pulsar `/` y comprobar que solo se dibuja la malla con sus elementos de edición. Probar también Numpad `/` y teclado con Mayús. Mantener pulsado para verificar que no oscila.
3. Orbitar, cambiar a ortográfica, navegar y editar vértices, aristas y caras. Probar H, Shift+H y Alt+H, Loop Cut y Undo/Redo. Comprobar que los hijos lógicos no se muestran y que la selección de malla sigue operativa.
4. Volver a pulsar `/`: recuperar cámara, proyección y visibilidad previas. Repetir y salir con Tab, cambiar de escena y volver, iniciar y detener Play. Verificar que no queda máscara ni se altera la cámara del Player.
5. Guardar durante aislamiento: no guardar estado de vista local ni reemplazar miniatura. Verificar visibilidad original al reabrir.
6. Ejecutar `npm run build` y `npm run electron` en instalación operativa; probar Player exportado si procede. Adjuntar evidencia de ejecución y aprobar explícitamente.
