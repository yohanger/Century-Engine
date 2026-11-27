# Evidencia — Edit/Play y docking

**Fecha:** 2026-11-22. **Fuente:** `source_baseline(5).zip`.

## Qué se verificó

| Ámbito | Verificación | Estado |
|---|---|---|
| Docking y observación | `node --test scripts/test-editor-dual-view-runtime.mjs scripts/test-viewport-docking-and-camera-loopcut-s02-g001.mjs` | **28/28 PASS** |
| Regresión docking/selección/occlusion-bake | `node --test scripts/test-editor-docking-s03-g001-integral.mjs scripts/test-selection-highlight-multi-visibility.mjs scripts/test-occlusion-bake-bounds-integrity.mjs` | **75/77 PASS**, 2 FAIL históricos (`DOCK-30`, `DOCK-C09`) documentados en el ledger de fuente; no atribuibles a esta corrección por las pruebas disponibles |
| Física/Inspector/occlusión | `node --test scripts/test-camera-occlusion-s17-g002.mjs scripts/test-multi-inspector-universal-occlusion.mjs scripts/test-physics-gizmo-s01-g001.mjs` | **43/44 PASS**; 1 FAIL de carga de `three` ausente, sin ejecución del caso |
| Sintaxis | `node --check` sobre JS y extracción de `<script setup>` de SFC modificados | **PASS sintáctico**, no equivale a compilación Vue |
| Build | `npm run build` | **BLOQUEADO:** `vite: not found` |
| Dependencias | `npm ci --ignore-scripts` | **BLOQUEADO:** no pudo resolverse el registro npm en el entorno de ejecución |
| QA Electron/Play/Jolt/GPU/Player | Sin ejecución visual real | **NO VERIFICADO** |
| Autoridad de persistencia Play/Editor | Sin aislamiento de estado implementado y acreditado | **PENDIENTE** |

## Validaciones manuales obligatorias antes de solicitar aprobación

1. Abrir un proyecto nuevo: solo Jerarquía, Proyecto, Inspector, Consola y dos vistas; comprobar ocultar/restaurar auxiliares, dividir/flo­tar ambas vistas sin perderlas y reparar layouts antiguos.
2. Durante Play: seleccionar nodos y terreno desde Edit Mode, transformarlos con gizmos, comprobar Inspector y Undo/Redo, cambiar foco, Pause/Step/Stop, entrada del jugador y conservar cámara editorial.
3. Verificar frustum con movimiento real de cámara, cámara activa distinta y oclusión horneada y no horneada; comprobar las máscaras visibles en relación con el viewport de juego sin falsos positivos.
4. Comprobar explícitamente Edit Mesh, pintura, creación de objetos y operaciones persistentes; son rutas pendientes o no verificadas.
5. Comprobar cambios editoriales y runtime físico/script simultáneos, Stop/Restart y persistencia del proyecto: no aceptar contaminación ni cambios perdidos.
6. Medir FPS, carga y memoria del segundo canvas en hardware objetivo; contrastar con Play único sin observador.

**Resultado:** implementación parcial; QA automatizada acotada disponible. Aprobación del usuario y cierre pendientes.
