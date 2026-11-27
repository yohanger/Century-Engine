# QA de colocación cardinal

Baseline: 4.238 archivos; CRC PASS; SHA-256 888ee9782f342d888d66f23a157ad584da77d023725c98a85babe47a06117ba3. Frente al baseline anterior: 34 añadidos, 5 modificados, 0 eliminados. No se dispone del árbol de trabajo local del usuario ni de su diff.

## Resultados

- Suite focal: 40/40 PASS (15 nuevas pruebas de colocación y 25 de portapapeles). Ejecución de los métodos productivos mediante VM; cámara, rayo y matrices simulados; registro de malla y validación de árbol reales. No acredita ejecución de Three.js ni de Electron.
- Regresión ampliada de las suites de portapapeles, mallas vinculadas, workflow de mallas, TriMesh y Signals: baseline 57/85 PASS; candidato 92/101 PASS incluyendo focal. Nueve fallos con el mismo título que en baseline. Se actualizaron expectativas de distancia y se suministraron dependencias omitidas a fixtures históricas; no se cambiaron los resultados históricos ni la lógica de historial. Los fallos restantes corresponden a fixtures desactualizadas (p. ej. authoredSceneTree, strictJson, finiteFloat32) y otros casos de integración de Signals/formatos; revisar los logs completos. No se acredita regresión global limpia.
- Electron: bloqueado por falta de Vite; nuevo runner con Editor y WebGL reales preparado, no ejecutó ninguna comprobación. Compilación: bloqueada por falta de Vite. Evidencia visual: pendiente, no hay captura del viewport real.
- Decisiones: alcance de raycast 2 m, anclaje al centro de las raíces (no a la base de la malla), desempate X, vista vertical por eje derecho. `Node` lógico no tiene Transform y conserva su jerarquía; no se cambia su contrato. El pegado bajo padre externo que cambió conserva la conversión TRS y puede rechazar shear.

## QA local

```
npm run test:suite -- camera-aligned-placement
LF_QA_CAPTURE_DIR="$PWD/docs/qa/evidence/camera-aligned-placement" npm run test:suite -- camera-aligned-placement-electron
npm run docs:build
npm run docs:check
npm run build
```

Repetir Ctrl+D/Alt+D con cámara en diagonal y vista vertical, Snap activo/inactivo, selección múltiple y padre rotado/escalado. Copiar, navegar a otra habitación y pegar cerca de una pared y en espacio libre. Confirmar Undo/Redo, que no cambia geometría ni scripts, y que el centro pegado cumple el límite. Aprobar solo tras comprobar el uso habitual.

- Portal regenerado: 358 páginas; docs:check 14/14 PASS con Marked 4.0.19 disponible (12.0.2 fijado pendiente). El capítulo y los inventarios de la Biblia HTML están actualizados. La reexportación PDF agotó el tiempo del entorno; se conserva la edición PDF anterior sin cambios.
