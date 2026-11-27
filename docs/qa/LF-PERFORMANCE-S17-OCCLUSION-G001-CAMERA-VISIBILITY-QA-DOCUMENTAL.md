# QA DOCUMENTAL — S17 Camera Visibility G001

**Gate autorizado:** `LF-PERFORMANCE-S17-OCCLUSION-G001-CAMERA-VISIBILITY-CONTRACT`  
**Fecha:** 2026-11-15  
**Clasificación:** DOCUMENTACIÓN CREADA; QA DOCUMENTAL DE INTEGRIDAD por verificación de archivos y referencias, **sin ejecución del motor**.  
**Estado de aprobación:** PENDIENTE DEL USUARIO. Gate NO CERRADO.

## Material inspeccionado

- `LF-RUNTIME-S00-G001-LEGACY-PLAYER-INFRASTRUCTURE-RETIREMENT_SOURCE_BASELINE(1).zip`: 3.409 entradas, 49.370.525 bytes descomprimidos; SHA-256 `55f1491424fa88b3fd0b4f77722da661a0b0a08e67dfb59612b57deefb6e10cb`.
- `Perfect Culling - Occlusion Culling System v.1.3.0.4.unitypackage`: 198 `pathname` dentro del tar; SHA-256 `7634d3e3ef914203bf2c0338d2160f701ac3436d40fdab1160382df28f2fe236`. Entre ellos `Scripts/Camera/PerfectCullingCamera.cs`, `Scripts/Volume/PerfectCullingVolume.cs`, herramientas Editor y datos de Bake. Se inspeccionaron **nombres/metadata**, no se portó fuente, binario ni shader. Su procedencia contractual para redistribución no está verificada.
- Contratos ratificados: S17 CA-001/CA-002, S15 Parent y políticas de cámara, Node pre-LTS CA-001. Propuesta S17 `OPT-PA-001` marcada expresamente NO RATIFICADA.
- Código: `render/viewport.js`, `render/look.js`, `render/lodmgr.js`, `render/static-batch.js`, `render/perf.js`, `render/volumetric.js`, `events/play.js`, `events/play-camera.js`, `events/play-nodes.js`, `events/play-controls.js`, `render/config.js`, `components/MapPicker.vue`, `core/editor/vfx-preview.js`.

## Hallazgos y sus límites

| Código | Resultado | Estado |
|---|---|---|
| QA-DOC-01 | Un `Viewport` mantiene la cámara que se renderiza; Play cambia pose y proyección desde `play-camera.js`. | VERIFICADO ESTÁTICAMENTE |
| QA-DOC-02 | Pasadas de escena, PSX, overlays y volumétricos requieren aislamiento de visibilidad por pasada. | VERIFICADO ESTÁTICAMENTE |
| QA-DOC-03 | `BatchedMesh` oculta originales mediante `visible` y la ruta actual de Play gestiona LOD/foliage. | VERIFICADO ESTÁTICAMENTE |
| QA-DOC-04 | Se identificaron dos estrategias WebGL2/PVS, sin prueba ni elección definitiva. | COMPARACIÓN DOCUMENTAL |
| QA-DOC-05 | GPU query latency, FPS, memoria, implementación y regresiones visuales locales. | NO VERIFICADO |
| QA-DOC-06 | BUILD Vite y AppImage de este Gate. | NO EJECUTADO / NO VERIFICADO |
| QA-DOC-07 | Criterios de elegibilidad conservadores y matriz de pruebas. | DOCUMENTADO |

## Contradicciones y reservas

1. El contrato O-04 de oclusión de S17 PA-001 **no tiene ratificación**: documentar no significa aprobar un método de bake.
2. Estado autoral del nodo `active/visible` no puede subordinarse a la decisión de cámara.
3. La instrumentación GPU existente no demuestra que las consultas de oclusión funcionen ni sean rentables.
4. No se supone que todo render desde cámaras offscreen sea parte de la vista principal.
5. La optimización de builds se registra como fase posterior, sin cambios en esta entrega.

## Pruebas requeridas para el futuro Gate técnico

- Focales: nuevos runners exclusivos de oclusión, regresiones cámara S15/S16, S17 `PerfMonitor`, render de Viewport, LOD y batching.
- Integración: Node, compilación Editor/Runtime, Electron embebido, NGM export/AppImage.
- Física y juego: Node `active/visible`, raycasts, Jolt, scripts, animación y selección no afectados.
- Visual: escenas interiores/abiertas, transparencias, terreno/foliage, agua/VFX, ortográfica/perspectiva, saltos de cámara, compositors, sombras, screenshot A/B.
- Rendimiento: elapsed CPU/GPU cuando soporte, memory budget, draws, triángulos, consultas GPU disponibles/pending, latencia, frames y tests a hardware objetivo. Sin estimar un FPS sin medir.

## Cierre documental

Se comprueba que el alcance de este Gate es especificación y auditoría: `src/`, `electron/`, `scripts/`, `package.json`, `vite.config.js`, `vendor/`, `public/` permanecen iguales al baseline. QA de integridad de los ZIP se anotará en el manifest. El consentimiento del usuario para revisión/aprobación de este Gate sigue PENDIENTE.
