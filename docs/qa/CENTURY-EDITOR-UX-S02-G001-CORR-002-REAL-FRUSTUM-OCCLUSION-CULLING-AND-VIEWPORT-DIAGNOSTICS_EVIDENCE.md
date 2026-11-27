# Evidencia QA — CORR-002 Frustum y Occlusion Culling

**Fecha:** 2026-11-22. **Fuente:** SOURCE_BASELINE CORR-001, The Room como fixture de inspección estática.

| Verificación | Resultado | Evidencia |
|---|---|---|
| Test focalizado nuevo + regresión de Edit/Play y Docking | **35/35 PASS** (7 pruebas nuevas; mocks de Three) | `docs/qa/evidence/CENTURY-EDITOR-UX-S02-G001-CORR-002-REAL-FRUSTUM-OCCLUSION-CULLING-AND-VIEWPORT-DIAGNOSTICS/focused-node.log` |
| Regresión docking, selección y bake | **75/77 PASS**, 2 fallos documentados previamente `DOCK-30`, `DOCK-C09` | `docs/qa/evidence/CENTURY-EDITOR-UX-S02-G001-CORR-002-REAL-FRUSTUM-OCCLUSION-CULLING-AND-VIEWPORT-DIAGNOSTICS/regression-node.log` |
| Multi-Inspector, culling geométrico y gizmos de físicas (sin la prueba que importa Three real) | **43/43 PASS** | `docs/qa/evidence/CENTURY-EDITOR-UX-S02-G001-CORR-002-REAL-FRUSTUM-OCCLUSION-CULLING-AND-VIEWPORT-DIAGNOSTICS/domain-node.log` |
| Sintaxis módulos JS y `<script setup>` | **PASS** (`node --check`); no certifica compilación Vue | `docs/qa/evidence/CENTURY-EDITOR-UX-S02-G001-CORR-002-REAL-FRUSTUM-OCCLUSION-CULLING-AND-VIEWPORT-DIAGNOSTICS/syntax.log` |
| `npm run build` | **BLOQUEADO**: `vite: not found` | `docs/qa/evidence/CENTURY-EDITOR-UX-S02-G001-CORR-002-REAL-FRUSTUM-OCCLUSION-CULLING-AND-VIEWPORT-DIAGNOSTICS/build.log` |
| `test-camera-occlusion-s17-g002.mjs` con Three real | **BLOQUEADO**: `ERR_MODULE_NOT_FOUND` (Three no instalado) | `docs/qa/evidence/CENTURY-EDITOR-UX-S02-G001-CORR-002-REAL-FRUSTUM-OCCLUSION-CULLING-AND-VIEWPORT-DIAGNOSTICS/occlusion-three-node.log` |
| Integración Three.js real, Electron, WebGL2, sombreado, Jolt, Play Mode | **NO VERIFICADO** | Dependencias de runtime ausentes en este entorno |
| The Room real en ejecución | **NO VERIFICADO** | Inspección estática del ZIP interno; no se ejecutó el juego |
| Rendimiento y GPU dual viewport | **NO VERIFICADO** | Sin Electron ni mediciones GPU |

### Pruebas manuales para aprobación

1. Abrir `The Room` y comenzar Play con Edit/Play divididos. Sin activar checks, ambos deben mantener su escena previa, selección, gizmos y cámara editorial.
2. Activar solo **Frustum**: desde Edit Mode deben desaparecer los drawables fuera de la cámara de Play; al mover, rotar o cambiar Camera3D, el resultado debe actualizarse. Desactivar y comprobar restauración sin mutar el proyecto.
3. Activar solo **Occlusion Culling** y luego ambos: detrás de paredes con horneado válido deben desaparecer únicamente los candidatos acreditados por `CameraOcclusion`; verificar que Play Mode no cambia. El culling no detecta arbitrariamente cualquier pared sin geometría estática elegible.
4. Probar celdas del bake con y sin pares, cámara fuera de la cuadrícula, oclusión desactivada, bake inexistente e invalidado por edición geométrica. En los estados sin datos no debe mostrarse un `Ocluidos: 0` ambiguo.
5. Probar sombras visibles cuando un objeto fuera del frustum del jugador proyecta sombra hacia dentro; comprobar selección, gizmos, Inspector, Stop/Restart, flotación y cambio de foco.
6. Medir FPS y memoria con ambas vistas, comparando checks apagados/encendidos, sin degradar el Player.

**Estado de aprobación:** PENDIENTE. No se declaran compilación, GPU ni QA visual PASS sin ejecución y evidencia.
