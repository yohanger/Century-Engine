# S17 Occlusion G002 — implementación conservadora por cámara

**Gate:** `LF-PERFORMANCE-S17-OCCLUSION-G002-CAMERA-OCCLUSION-IMPLEMENTATION`  
**Autorización:** `Listo. LF-PERFORMANCE-S17-OCCLUSION-G002-CAMERA-OCCLUSION-IMPLEMENTATION autoriza comenzar` (2026-11-15).  
**Estado:** IMPLEMENTADO; TEST FOCAL 15/15 PASS; NO COMPILADO EN ESTE ENTORNO; QA GPU/Electron/UHD605 NO VERIFICADO; **NO APROBADO / NO CERRADO**.  
**Baseline:** `LF_PERFORMANCE_S17_OCCLUSION_G001_CAMERA_VISIBILITY_CONTRACT_SOURCE_BASELINE.zip` (3412 archivos).  
**Contrato vigente de referencia:** `docs/architecture/LF-PERFORMANCE-S17-OCCLUSION-G001-CAMERA-VISIBILITY-CONTRACT.md` (estado documental previo pendiente de aprobación explícita; no se pretende convertirlo en Amendment ni ratificar S17 PA-001).

## Objetivo / mecanismo

Se implementa una **capacidad CPU screen-space de occlusion culling conservador** perteneciente al renderizado de la **cámara efectiva**, no una copia de Unity/Perfect Culling ni un sistema de bake/PVS. En cada pasada principal, una cuadrícula de 24×14 celdas puede registrar únicamente regiones cubiertas **por completo** por triángulos de mallas opacas admitidas. Para dos triángulos coplanarios que forman exactamente una cara convexa cuadrilateral, el algoritmo permite la cobertura de la cara completa tras verificar coplanaridad, orientación y área. Un candidato se omite solo si toda su caja proyectada cae en celdas cubiertas y la **profundidad máxima** de cada oclusor es anterior a la **profundidad mínima** de la caja. Esto evita falsas certezas producidas por muestrear algunos puntos visibles, y no confunde el resultado con frustum/distance/AO.

En los casos no probados se **dibuja**: bounds inválidos, near/far, geometría deformable, materiales especiales, transparencia/alpha-test, sombras o cámaras auxiliares, o sobrecarga CPU. Limitaciones intencionales: resolución baja y células no cubiertas completas implican **falsos negativos de optimización**; mallas de cientos de triángulos no se utilizan como oclusores, aunque pueden ser ocluidas. El mecanismo NO es equivalente al prebake de visibilidad de Unity ni proporciona culling por instancia de BatchedMesh.

## Arquitectura / integraciones

- `src/engine/runtime/render/camera-occlusion.js`: una clase `CameraOcclusion`; no requiere Three.js como dependencia adicional (consume matrices/geometrías Three a través del contrato del viewport). Sin caché de visibilidad entre cámaras: recalcula con cámara/transform/material del fotograma para evitar máscaras obsoletas en cortes, blends, Edit, Play y NGM Runtime.
- `render/viewport.js`: una instancia en el viewport, compartida por Edit/Play/Runtime. El render de sombras original pasa por `occlusion.withShadows`: las mallas temporalmente omitidas reaparecen durante la pasada desde la luz. `dispose()` restaura cualquier máscara.
- `render/look.js`: `RenderPass` principal instrumentado, así como las rutas directas Clásico y PSX sin compositor. La máscara se restaura por `finally` antes de SSR, Outline, overlays, view-model, volumétricos y PSX display. No se reescribe `Object3D.visible` fuera del ámbito síncrono de la pasada ni `active/visible` persistidos del nodo.
- `PerfMonitor` / `PerfPanel.vue`: contadores independientes `occlusionHidden`, `occlusionOccluders`, `occlusionCells`, `occlusionCpuMs` y motivo de fallback, solo con Stats abierto. Botón diagnóstico Activo/Inactivo para A/B, **no serializado**.
- No modifica `LodManager`, `StaticBatcher`, Three r186.1, `project.render`, `package.json`, Vite, node graph, Jolt ni formatos de exportación.

## Política de elegibilidad precisa

**Oclusores admitidos:** `Mesh` único visible en `world` (no Skinned/Instanced/Batched/Morph), con buffer de posiciones válido y matriz finita, 1–256 triángulos; opacidad 1, depthWrite/test activos, material sin transparencia/alpha-test/alphaHash/alphaMap, displacement, recortes, stencil/polygon offset/blending no normal, renderOrder personalizado ni shaders arbitrarios. Solo efectos incorporados de `builtin:blockout`/`builtin:realista` o material estándar sin parche geométrico; si PSX desplaza vértices, bypass. Se respetan front/back/double side; el triángulo se descarta si cruza near/far. Se permiten grupos de un único material.

**Ocluibles:** Mesh único, visible y con bounds de geometría fiables; excluir deformaciones/instancing/batching, materiales no estándar/vertex displacement, frustumCulled=false (terrenos/effects protegidos), renderOrder especial. Los cuerpos dinámicos pueden ser ocluidos porque se reevalúan por fotograma; no se suspenden sus scripts, física, audio ni animación.

**Pasadas excluidas:** sombras de luces, volumétricos, SSR auxiliar, Outline, overlays, rejilla, UI, mapas/capturas offscreen y view-model. No se ocultan padres de los objetos ni se modifica la jerarquía.

**Presupuestos/fallback:** 24×14 celdas, máximo 1600 Mesh evaluados, máximo 24 oclusores, máximo 320 triángulos proyectables globales, 256 por Mesh; límite 4 ms CPU del proceso (si excede, se dibuja todo y se suspende 120 fotogramas de dibujo). No hay consultas GPU, readback ni recursos GPU persistentes. Estos límites son iniciales para protección, **no benchmark ratificado** en UHD605.

## Prerrequisitos, evidencia, contradicciones y alcance

**Prerrequisitos auditados:** `Viewport`, `LookPipeline`, `RenderPass`, `PerfMonitor`, `StaticBatcher`, `LodManager` y S15 cámara efectiva; estudio conceptual del UnityPackage sin copia de código. **Conflictos:** S17 `OPT-PA-001` no ratificado (no se adopta O-04/prebake); G001 no formalmente aprobado; se restringe el Gate a un mecanismo no destructivo transitorio y reversible. Si posteriormente se pretende un PVS/export o un sistema automático de optimización, requiere autoridad específica. **Medios:** Node 22 del entorno, scripts de proyecto, auditoría estática del baseline. **QA:** ver documento G002-QA. **Siguiente acción:** usuario ejecutar `npm ci`, `npm run build`, `npm run electron`; comparar Stats A/B en habitación opaca, escena abierta, perspectiva/ortho, Play/Runtime y captura/sombras. No afirmar 60 FPS ni mejora hasta medir en el equipo destino.
