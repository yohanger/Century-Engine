# Evidencia: paridad Wireframe / Triangles / TriangHor

Gate autorizado: `CENTURY-EDITOR-VIEWMODES-S01-G001-CORR-003-WIREFRAME-TRIANGLES-TRIANGHOR-PARITY`.

## Baseline y alcance

SOURCE_BASELINE: `CENTURY-EDITOR-VIEWPORT-S01-G001-INFINITE-GRID-AND-REMOVE-G-SHORTCUT_SOURCE_BASELINE.zip`. Se verificó que los 3.136 archivos del workspace precedente corresponden byte a byte a ese ZIP antes de modificar código.

Cambios de producción: `src/engine/runtime/render/view-diagnostics.js`. No se ha modificado código de TriangHor, ClusterMeshes, Player, CSG, selección, rejilla ni gizmos.

## Pruebas

| Comprobación | Resultado |
|---|---|
| Test nuevo `scripts/test-viewmodes-wireframe-triangles-parity.mjs` | 15 PASS, 0 FAIL |
| Runner `node scripts/qa-suite.mjs viewmodes-trianghor-parity` | 67 PASS, 0 FAIL |
| Runner de gizmos existente | 39 PASS, 0 FAIL |
| Baseline: nuevas pruebas sobre implementación anterior | 1 PASS, 14 FAIL |
| Regresión histórica de clústeres (`test-editor-native-clusters-corr001.mjs`) | 16 PASS, 1 FAIL; mismo fallo `NC09` en el baseline |
| Smoke: baseline y trabajo | 29 PASS, 1 FAIL en ambos |
| Sintaxis y JSON | comprobación Node/Python PASS |
| `npm run build` | NO COMPILADO: `vite: not found` (EXIT 127) |
| QA visual en Electron/Player | NO VERIFICADO |

Los tests nuevos ejercitan la ruta real de `ViewDiagnostics` con una implementación de renderer simulada: mallas indexadas y no indexadas, cambio de índices y atributos con igual versión, terreno con páginas optimizadas, cambios de páginas y detalle, partición directa, batch LOD, caché compartida, limpieza de recursos y restitución tras excepción.

No hay pruebas de tiempos GPU, imagen real de WebGL2 ni demostración local del mismo terreno de usuario. La prueba `NC09` es una comprobación textual anterior del nombre de variable `partitionTriangles({ index: indices` que ya fallaba en SOURCE_BASELINE; no se modificó el test histórico.

## Criterio para aprobación

En la misma escena y con la misma cámara, comprobar después del horneado TriangHor que Wireframe y Triangles representan las mismas aristas/triángulos efectivos. Verificar que mover la cámara cambia las mismas páginas LOD en ambos, que los gizmos funcionan en los dos modos y que la geometría y el índice real del terreno no se modifican por alternar diagnósticos. Registrar FPS/uso de memoria si el terreno es grande.

**Estado:** IMPLEMENTADO · TEST PASS · NO COMPILADO · QA ELECTRON PENDIENTE · NO APROBADO · NO CERRADO.
