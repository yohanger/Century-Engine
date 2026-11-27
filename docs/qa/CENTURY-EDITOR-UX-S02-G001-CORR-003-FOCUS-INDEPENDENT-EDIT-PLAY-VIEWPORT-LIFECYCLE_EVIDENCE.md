# QA — CORR-003 Foco y ciclo de vida Edit/Play

**Fuente:** SOURCE_BASELINE CORR-002, integridad comprobada antes de modificar (3287 archivos idénticos, sin extras dentro del proyecto). No se operó Git.

| Verificación | Resultado | Registro |
|---|---|---|
| Pruebas nuevas + focales Edit/Play, Docking y Frustum | **43/43 PASS** | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-003-FOCUS-INDEPENDENT-EDIT-PLAY-VIEWPORT-LIFECYCLE/focused-node.log` |
| Regresión ampliada | **93/95 PASS**, 2 fallos heredados `DOCK-30`, `DOCK-C09` | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-003-FOCUS-INDEPENDENT-EDIT-PLAY-VIEWPORT-LIFECYCLE/regression-node.log` |
| Pruebas de dominio independientes | **61/61 PASS** | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-003-FOCUS-INDEPENDENT-EDIT-PLAY-VIEWPORT-LIFECYCLE/domain-node.log` |
| `node --check` JS y SFC `<script setup>` extraído | **PASS**, solo sintaxis | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-003-FOCUS-INDEPENDENT-EDIT-PLAY-VIEWPORT-LIFECYCLE/syntax.log` |
| `npm run build` | **BLOQUEADO:** `vite: not found` | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-003-FOCUS-INDEPENDENT-EDIT-PLAY-VIEWPORT-LIFECYCLE/build.log` |
| `test-camera-occlusion-s17-g002.mjs` | **BLOQUEADO:** `three` sin instalación válida | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-003-FOCUS-INDEPENDENT-EDIT-PLAY-VIEWPORT-LIFECYCLE/three-node.log` |
| Editor Electron, WebGL/GPU, Player y The Room en vivo | **NO VERIFICADO** | Requiere ejecución local con dependencias |

## Lista de comprobaciones manuales pendientes

1. Abrir The Room con Edit/Play en paralelo sin iniciar Play: Edit Mode permanece editable; Play Mode presenta la cámara configurada o muestra «No hay cámara para la vista previa» sin pantalla negra ambigua.
2. Con ambas ventanas visibles, alternar foco y cambiar de pestaña antes y durante Play: ningún foco activa o detiene la simulación. Si un panel está oculto, no consumir un render secundario innecesario.
3. Verificar F5, Pause, Step, Stop, Restart, puntero y teclado; la entrada del jugador debe volver al interactuar con Play Mode y retirarse al volver a Edit Mode.
4. Mover y cambiar la Camera3D nativa; observar actualización de vista previa, orientación y encuadre. Comprobar cambio de cámara por Timeline durante Play.
5. Dividir, acoplar, flotar, minimizar y restaurar ambas vistas; comprobar ResizeObserver, cambio de foco, escala y relación de aspecto.
6. Validar selección y gizmos en Edit durante Play, los checks Frustum/Occlusion de CORR-002 y la ausencia de contaminación de la visibilidad persistida.
7. Medir FPS/VRAM en hardware objetivo con las dos vistas y con una pestaña de observación oculta.

**Resultado global:** implementación y Node PASS acotados; compilación y QA local NO VERIFICADOS. No equivale a cierre del Gate.
