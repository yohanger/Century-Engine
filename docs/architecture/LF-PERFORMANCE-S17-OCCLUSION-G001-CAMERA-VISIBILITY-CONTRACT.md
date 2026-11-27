# LF-PERFORMANCE-S17-OCCLUSION-G001 — Camera Visibility Contract

**Gate:** `LF-PERFORMANCE-S17-OCCLUSION-G001-CAMERA-VISIBILITY-CONTRACT`  
**Autorización literal:** `Listo. LF-PERFORMANCE-S17-OCCLUSION-G001-CAMERA-VISIBILITY-CONTRACT autoriza comenzar` (usuario, 2026-11-15).  
**Tipo:** contrato técnico, auditoría de integración y plan QA, **sin implementar oclusión ni editar el código de producción**.  
**Estado:** DOCUMENTADO / QA DOCUMENTAL PENDIENTE DE APROBACIÓN DEL USUARIO; **NO RATIFICADO COMO AMENDMENT NI IMPLEMENTADO**.  
**Fuente:** `LF-RUNTIME-S00-G001-LEGACY-PLAYER-INFRASTRUCTURE-RETIREMENT_SOURCE_BASELINE(1).zip` (3.409 entradas; SHA256 `55f1491424fa88b3fd0b4f77722da661a0b0a08e67dfb59612b57deefb6e10cb`).  
**Referencia externa, solo de estudio:** `Perfect Culling - Occlusion Culling System v.1.3.0.4.unitypackage` (198 assets; SHA256 `7634d3e3ef914203bf2c0338d2160f701ac3436d40fdab1160382df28f2fe236`).

## 1. Objetivo, autoridad y delimitación

**OBJETIVO.** Evitar la emisión al render de geometría totalmente oculta desde **la cámara efectiva de la pasada principal**, en el visor de edición, en Play y en el NGM Runtime cuando compartan el `Viewport`/`LookPipeline` existente. No se crearán tres sistemas independientes. El estado lógico de nodos, scripts, física, selección, audio, animaciones y activos de autoría es ajeno a la decisión de oclusión. **Occlusion culling no equivale a ambient occlusion (AO), a frustum culling ni a supresión por distancia.**

**AUTORIDAD:**
1. `LF-PERFORMANCE-S17-CA-001-VISUAL-FIDELITY-FIRST` y `LF-PERFORMANCE-S17-CA-002-OPTIN-EXPORT-DIAGNOSTICS`: ratificados; gobiernan fidelidad y telemetría exportada.
2. `LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001`: ratificado; `active` significa habilitación funcional, `visible` autoría de visibilidad. La exclusión por cámara no reescribe ninguno.
3. `LF-CAMERA-ORCHESTRATION-S15-PARENT-CONTRACT-001` y `LF-CAMERA-ORCHESTRATION-S15-G006-CA-001`: preservar arbitraje, cortes, blends y salida efectiva de cámara.
4. Código real entregado y sus pruebas: evidencia de implementación, **no autorización para alterarlo**.
5. `LF-PERFORMANCE-S17-OPT-PA-001_PROPOSED.md`: propuesta **SIN RATIFICAR**; O-04 (occlusion prebake) y O-01 (orquestador) siguen pendientes. Este contrato no los ratifica ni introduce un `OptimizationOrchestrator`.

**ALCANCE INCLUIDO en futuro Gate técnico:** cámara perspectiva u ortográfica del visor principal en Edit; cámara de render de Play, incluida `Camera3D`, jugador nativo, Timeline/FilmMaker y transiciones; mismo pipeline usado por NGM Runtime si se confirma la ruta concreta; perfiles Forward+/Mobile/Compatibility como escenarios de QA. No se requiere una función propia de «Runtime occlusion»: es la misma capacidad del renderizador compartido.

**ALCANCE EXCLUIDO:** streaming y migración de activos, edición de formatos `game.rtpkg`, nueva UI de bake, batching automático, actualización de Three.js, WebGPU compute, reactivación de TAA/DynRes, cambios de sombras por defecto, eliminación de nodos, manipulación de colisiones, nueva tecnología de render o supresión de MediaPipe. La optimización de **builds** va en trabajo posterior independiente; este Gate solo registra su dependencia temporal. No incluir código de Perfect Culling ni empaquetar su UnityPackage.

## 2. Evidencia real del baseline y puntos de acoplamiento

| ID | OBSERVADO | Evidencia fuente | Riesgo/consecuencia |
|---|---|---|---|
| CV-01 | `Viewport` crea `THREE.WebGLRenderer` y mantiene `this.persp`, `this.ortho`, `this.camera` y `this.scene`. | `src/engine/runtime/render/viewport.js:23-61` | Punto conceptual de composición; **no prueba** que un hook de WebGLRenderer permita filtrado global seguro. |
| CV-02 | `Viewport._render` llama `look.render`; `resize()` también puede dibujar inmediatamente. | `render/viewport.js:196-254` | Un filtro por fotograma debe contemplar renders fuera del loop ordinario. |
| CV-03 | `setOrtho()` y `restoreEditorView()` sustituyen `this.camera`; otros consumidores la asignan directamente. | `render/viewport.js:287-337`, `events/play.js:272,407`, `play-nodes.js:451`, `core/editor/vfx-preview.js:31` | Invalidar por cambio de cámara **y por pose/proyección**, no depender exclusivamente de `onCamera()`. |
| CV-04 | `PlayMode._cameraFrame(cam)` arbitra Camera3D, jugador, film, Timeline, solicitud y blending aplicando poses al mismo `cam`. | `events/play-camera.js:190-269` | El objeto cámara puede conservar identidad mientras cambia la vista; detectar corte/FOV/movimiento. |
| CV-05 | `LookPipeline` alterna render directo, `RenderPass`, composer, PSX, escena dividida y overlays; oculta temporalmente hijos de escena durante overlays. | `render/look.js:535-616` | La máscara de oclusión de cámara principal NO puede contaminar overlays, `psxScene`, máscaras internas ni estados preexistentes `visible`. |
| CV-06 | Sombras volumétricas usan cámaras propias, `overrideMaterial` y mutaciones temporales de `visible`. | `render/volumetric.js:169-209` | La visibilidad de la cámara principal no constituye visibilidad desde luces; en las pasadas auxiliares el filtro debe ser neutro por defecto. |
| CV-07 | `StaticBatcher` agrupa solo opt-in y oculta originales, crea `BatchedMesh` que desactiva `frustumCulled` global. | `render/static-batch.js:31-123` | La elegibilidad de objetos originales y de sus instancias no es la del `BatchedMesh` completo. No añadir un segundo escritor de `visible`. |
| CV-08 | `LodManager` durante Play administra niveles, terreno, foliage y batching; `lod.stats.culled` se alimenta de chunks foliage. | `render/lodmgr.js:13-45,79-129`; `events/play.js:536-539` | No convertir estadísticas `culled` actuales en conteos de oclusión; no reemplazar el LOD existente. |
| CV-09 | `PerfMonitor` usa `GpuTimer` y contadores `renderer.info`; su ejecución es opt-in. | `render/perf.js:90-156,160-229` | Extender medición existente sin añadir otro profiler ni interpretar memoria de Three.js como VRAM real. |
| CV-10 | `render/config.js` tiene `lod:true`, `batchStatic:false`, TAA/DynRes retirados; Three `0.186.1`. | `render/config.js:1-72`, `package.json` | No activar opciones distintas ni adoptar API renderer de otra versión sin verificación. |
| CV-11 | `MapPicker` usa un render offscreen con cámara ortográfica y `readRenderTargetPixels`; hay previews y workers aislados. | `src/components/MapPicker.vue:33-53`, `render/bake/core.js`, componentes `*Preview.vue` | Los consumidores no principales deben quedar explícitamente inventariados, no heredar una máscara de otro render. |
| CV-12 | Resiliencia ante pérdida del contexto WebGL ya existe. | `render/viewport.js:25-27,196`; `_glRestored()` | Toda consulta GPU de oclusión requerirá disposal/recreación sin residuos. |

**INFERENCIA:** una decisión de visibilidad se podría reutilizar entre Edit/Play/NGM si se acopla a la cámara efectiva del `LookPipeline`; se necesitan pruebas de todas las variantes para acreditar paridad. **NO VERIFICADO:** si el renderer interno admite un filtro sin parche, si consultas GPU son rentables en UHD605/N5030, frecuencia de cambios de geometría actual, rendimiento del framebuffer por material, latencia de consultas, equivalencia visual y capacidad real del equipo.

## 3. Contrato funcional propuesto para una implementación posterior (NO IMPLEMENTADO)

**CV-F-01 — Por vista/pasada.** Para una pasada de escena principal se define un resultado transitorio `VisibilityDecision(camera, pass, object, frame)` (conceptual, **no clase/API aprobada**). El resultado solo autoriza *omitir el draw* cuando existe prueba conservadora de oclusión completa. La decisión se recalcula/invalida para cambios de pose, FOV/proyección, viewport, geometría relevante, material/alpha, lote o estado de escena.

**CV-F-02 — Respeto de la autoría.** Nunca cambiar `active`, visibilidad persistida, selección, estado de scripts, Jolt, colisiones, audio, animación o identidad de Assets para marcar oclusión. Si el renderer requiere cambios temporales a `Object3D.visible`, se hará **solo dentro del render de una pasada específica, bajo snapshot/`finally` y pruebas de reentrancia**; queda prohibido usarlo como estado global persistente o escritura concurrente. Preferir una interfaz de filtrado de listas de dibujo solo **si se demuestra su viabilidad con Three r186.1 sin romper las pasadas**.

**CV-F-03 — Conservadurismo.** Sin datos válidos, consulta no disponible o respuesta pendiente, el objeto se **dibuja**. Los errores admisibles son falso negativo de optimización (dibujar algo oculto); no se aceptan huecos visibles por falso positivo de oclusión. Para saltos de cámara, teletransporte, zoom, cortes, cambios de escena y pérdida/restauración del contexto se restablece `visible` hasta contar con datos pertinentes.

**CV-F-04 — No duplicación.** `LookPipeline`/`Viewport` es el punto de acoplamiento previsto; `LodManager` conserva geometría/LOD, `StaticBatcher` batching, `PerfMonitor` telemetría. No desarrollar `CameraOcclusionEditor`, `CameraOcclusionPlayer`, `RuntimeOcclusion` paralelos. La eventual clase no podrá definirse sin el Gate que valide O-01/autoridad, si procede.

**CV-F-05 — Ámbitos de pasada.** Las sombras de luces (incluidas volumétricas), capturas offscreen, editor gizmos, outlines de selección, rejilla, cielo, UI, vista de arma, efectos volumétricos/partículas y materiales que hacen lectura de profundidad deben conservar su semántica. De inicio, **solo la pasada de geometría opaca de escena principal** es candidata. Cualquier otra pasa de *bypass* conservador hasta verificar su propia política.

**CV-F-06 — Procedencia de evidencias.** Ningún conteo positivo de consultas equivale a mejora de FPS. La optimización debe comparar GPU, CPU, número de draw calls, queries, latencia de visibilidad, estabilidad y memoria. Las métricas de AO no son métricas de occlusion culling.

**CV-F-07 — Opcionalidad y fallback.** La incorporación futura debe permitir comparación A/B sin mutar la autoría de proyecto; el comportamiento por defecto y controles públicos requieren decisión y Gate. No introducir `project.render.occlusion` ni persistencia antes de definir formato y lectura/escritura. Con fallo GPU, sin soporte o escenario adverso el renderer usa su ruta normal (frustum y demás políticas preexistentes).

**CV-F-08 — Presupuesto.** Hardware objetivo de QA: Pentium Silver N5030, 4 GB RAM, iGPU Intel UHD605. No reservar buffers GPU proporcionales a cada triángulo ni generar celdas ilimitadas; límites y política de degradación deben medirse. En escenas sin oclusores el coste neto no debe degradarse injustificadamente; exigir A/B.

**CV-F-09 — Sesiones y seguridad de cambios.** Restauración explícita al salir Play, cambiar de escena, desmontar `Viewport` o perder WebGL; no destruir/alterar mallas originales ni recursos de proyecto. Cualquier caché derivada depende de versión/firma de geometría, material y condiciones de oclusión si se adopta bake. Proyectos pre-LTS actuales se preservan; no imponer migradores retrospectivos.

## 4. Matriz inicial de elegibilidad (política conservadora por validar)

| Clase | Como oclusor | Como objeto ocluible | Política inicial / motivo |
|---|---|---|---|
| Malla opaca grande y estática con límites fiables | CANDIDATO | CANDIDATO | Solo tras confirmar opacidad real, superficies/tamaño y actualización de bounds. |
| Malla opaca dinámica | PENDIENTE | CANDIDATO | Bake estático no puede considerar un oclusor que cambia; consultar alternativa dinámica si es rentable. |
| Malla transparente/translúcida, alphaTest, foliage recortado | NO por defecto | CANDIDATO condicionado | Agujeros/alpha/transparencia rompen la prueba de profundidad conservadora. |
| Skinned/Morph/partículas/trails/VFX | NO por defecto | PENDIENTE | Bounds/deformación/movimiento requieren garantías y pueden afectar otros efectos. |
| Terrain y geometría procedural actualizable | PENDIENTE | CANDIDATO | Terrain dispone de LOD por índices, alteraciones de altura y `frustumCulled` especial; riesgo de false cull. |
| BatchedMesh / InstancedMesh | PENDIENTE | PENDIENTE | Definir culling por instancia/subconjunto o bypass; nunca confundir originales ocultos con oclusión. |
| Sky, gizmos, rejilla, UI, íconos/cámaras, view-model | NO | NO | Elementos auxiliares/editoriales; no sujetos a oclusión principal. |
| Sombra/luz/volumétricos/reflexión/captura MapPicker | NO (desde vista principal) | NO (desde vista principal) | Otra cámara/pasada exige decisión independiente y verificada. |

**Condición de pase:** el futuro Gate de implementación tendrá que convertir cada fila CANDIDATO/PENDIENTE en whitelist precisa sustentada por casos reales y pruebas. Todo elemento no elegible sigue dibujándose conforme al sistema vigente.

## 5. Técnicas posibles — análisis y decisión pendiente

**T-1 — Prebake/PVS (inspiración Unity/Perfect Culling).** Preparar datos de regiones/celdas y listas visibles usando geometría estática. Potencialmente barato al consultar, pero el Editor cambia la escena continuamente: invalidación, proceso de bake, tamaño de datos, memoria, re-bake y cache exportada son una nueva responsabilidad y podrían **aumentar** las builds. No aprobar formato, UI o pipeline de bake en este Gate. No copiar `.unitypackage`.

**T-2 — GPU occlusion queries WebGL2.** La especificación admite `ANY_SAMPLES_PASSED`/`ANY_SAMPLES_PASSED_CONSERVATIVE` y disponibilidad diferida. Cada consulta tiene coste de draws de proxies/volúmenes, sincronización y gestión. **Prohibido** leer resultados de la consulta en el mismo frame como requisito de funcionamiento o crear bucles que esperen resultados. El contrato debe validar qué pasa con compositor, depth buffers, sombras y otros usuarios de WebGL2. El `GpuTimer` actual usa consultas para otro fin: no reapropiarse de él ni asumir que su acumulación es segura.

**T-3 — Híbrido/CPU.** Posible filtrado conservador de espacio con oclusores estáticos, sin acceso directo a resultados GPU; requiere demostrar que no se confunde PVS con frustum/distance y que las pruebas de oclusión son correctas. No asumir que CPU = menor coste.

**DECISIÓN PENDIENTE D-01:** no seleccionar prebake, GPU ni híbrido por afirmación teórica. El **Gate técnico de viabilidad** debe medir en escenas cerradas/abiertas, geometría dinámica, Editor navegando, Play y Player en UHD605 y escoger el mecanismo mínimo que gane tiempo sin degradación visual. Si ninguno lo logra, conservar el renderer actual y documentar que la optimización no procede.

**D-02:** para WebGL2 la inserción exacta en Three.js r186.1 requiere prueba del renderer. No se puede interceptar con seguridad un draw genérico mediante un simple cambio de `Camera3D` sin revisar render lists y profundidad. `onBeforeRender`, `overrideMaterial`, `Object3D.visible`, layers y `renderer.render` deben caracterizarse antes de seleccionar hook.

**D-03:** definir política de objetos agregados/batched, transparente/alphaTest, sombras, múltiples cámaras y coste de rebuild. Bloquear extensión de `StaticBatcher` si cambia su opt-in aprobado. No tratar `AO` como visibilidad de cámara.

## 6. Condiciones de invalidación e integraciones

- Cámara: cambio de objeto, posición, orientación, FOV, near/far, proyección perspectiva↔ortográfica, ViewOffset/jitter, tamaño interno/final, corte/blend, camera shake, switching de escena.
- Mundo: mover/crear/quitar/activar/ocultar geometría oclusora, escala, cambio de Mesh/morfología, Terrain/CSG/procedural, visibilidad de jerarquía, material alfa/doble cara, streaming/LOD derivado, entradas/salidas de Play.
- GPU: resize, reconfigurar compositor/profundidad, pérdida/restauración de contexto, recreación de render targets, renderer disposal.
- Pasada: cada consulta y resultado llevan identidad de **cámara efectiva, pasada, contexto/scene revision**; la consulta de sombras o minimapa **nunca** reutiliza erróneamente una máscara de vista principal.
- Histéresis y latencia: definir después de medir; ante duda o cambio importante priorizar **dibujar** y actualizar visibilidad gradualmente. No aceptar popping de geometría visible.

## 7. QA exigido al futuro Gate de implementación

| Caso | Escenario y expectativa |
|---|---|
| Q-01 | Cuarto cerrado: objeto detrás de pared opaca se omite solo cuando está completamente tapado; reaparece al asomarse. |
| Q-02 | Mundo abierto sin oclusores; A/B demuestra sobrecarga acotada o fallback sin regresión injustificada. |
| Q-03 | Edit Mode: mover cámara, perspectiva/ortográfica, orbitar, pan, zoom, modificar Mesh/Material/Node sin desapariciones ni caché obsoleta. |
| Q-04 | Play: Camera3D activa/inactiva, jugador, cortes, blends, Timeline, FilmMaker, FOV, shake, teletransporte, pause/step; nunca se hereda máscara incorrecta. |
| Q-05 | Runtime: misma escena/Camera3D en host NGM con QA específico de exportación y AppImage, sin crear subsistema paralelo. |
| Q-06 | Shadows/AO/SSR/DOF/volumétricos/PSX/split/view-model/editor overlays; no alteración perceptible injustificada ni shadow omissions. |
| Q-07 | Transparentes, alphaTest, foliage, Terrain, agua, grandes BatchedMesh, InstancedMesh, malla deformable, child hierarchy, skinned. |
| Q-08 | Carga/cambio de escena, desmontaje, pérdida/restauración WebGL y resize; sin fugas, queries huérfanas ni cambios persistentes de `visible`. |
| Q-09 | Tres perfiles render, 720p y 1280×720 como mínimo; escena cerrada + abierta, capturas A/B cámara fija y recorridos controlados. |
| Q-10 | `PerfMonitor`: CPU por etapa, GPU pass timing con extensión cuando disponible, calls/triángulos, consultas emitidas/pendientes, objetos descartados por oclusión (**contador separado**), memoria estimada y FPS de muestra. |
| Q-11 | Ejecutar runners Node focales, regresión S15/S16/S17, `npm run build` Editor+Runtime, `npm run electron` para QA visual y export AppImage donde exista evidencia. |
| Q-12 | Seguridad: proyectos del baseline no alterados, Play restaura objetos/lod/visibilidad, sin cambios en paquetes ni configuraciones por defecto no autorizadas. |

**Criterios de aceptación:** 0 objetos *realmente visibles* omitidos en las escenas de prueba; sin alteración de lógica/física/selección; reversión segura; beneficios A/B sostenibles en al menos la escena objetivo con artefactos y medidas reproducibles; desempeño y memoria bajo límite medido en N5030/4GB. Objetivos numéricos de ms/MB/cuántos queries **se fijarán desde el baseline físico**, no se inventan aquí. Si no existe mejora neta se desactiva o se rechaza en vez de prometer 60 FPS.

**Separación de estatus:** documentado ≠ código IMPLEMENTADO ≠ TEST PASS ≠ COMPILADO ≠ QA LOCAL PASS ≠ APROBADO ≠ CERRADO. Este Gate únicamente entrega contrato/QA documental. 

## 8. Riesgos, contradicciones y resolución

| ID | Riesgo o conflicto | Resolución documental |
|---|---|---|
| R-01 | S17 `OPT-PA-001` sigue propuesto; O-04 contemplaba bake de visibilidad. | Este contrato caracteriza opciones; **no ratifica** PA-001 ni afirma prebake aprobado. Ratificación del padre o Amendment necesario antes de modificar autoridad superior. |
| R-02 | El uso de `visible` puede interferir con overlays/volumétricos/batcher. | Prohibir persistencia; filtrar por pasada o garantizar snapshot/restore y cobertura. Si no existe hook seguro en r186.1: **BLOQUEAR la implementación**. |
| R-03 | Visibilidad desde cámara principal incorrecta para sombras, captures o PSX/SSR. | Bypass conservador de pasadas secundarias, QA antes de ampliar. |
| R-04 | PVS estático no representa geometría dinámica en Editor y añade tamaño de datos a build. | Invalidación con fallo abierto (render normal) y análisis de costes; cualquier cache/export necesita Gate propio. |
| R-05 | El paquete Perfect Culling es un **Extension Asset** de Unity Asset Store; la licencia de uso/redistribución en motor independiente **no está acreditada**. | Solo estudiar estructura/metadata y conceptos públicos; no copiar ni publicar archivos/código del paquete. Confirmar procedencia/licencia con titular antes de cualquier uso directo. |
| R-06 | AO, frustum, foliage `culled` y GPU oclusión comparten vocabulario. | Métricas y responsables diferenciados, no anunciar mejora de AO como occlusion culling. |
| R-07 | Dos Gates con cambio de `batchStatic` / TAA/DynRes / formato actual podría violar contratos. | Fuera de alcance; cambio solo tras Amendment cuando contradiga autoridad vigente. |

## 9. Medios, evidencia y próxima acción

**MEDIOS verificables en este Gate:** SOURCE_BASELINE aportado, fuente Three.js r186.1 referenciada por package, motores existentes, pruebas en `scripts/`, documentación S15/S17, inventario del UnityPackage (solo pathnames), documentación oficial WebGL2/Unity/Three.js y log `npm run build` aportado por usuario.

**EVIDENCIA de este Gate:** hashes de entrada, inspección estática de rutas/contratos, matriz de elegibilidad, tabla de escenarios QA, registros del ledger y paquete documental CHANGE+SOURCE_BASELINE. Ninguna ejecución GPU, compilación nueva, FPS ni AppImage se acredita aquí.

**SIGUIENTE ACCIÓN:** (1) revisión y aprobación documental explícita del usuario; (2) reconciliar/ratificar la autoridad S17 PA-001 si se pretende vincularla; (3) nuevo Gate de *viabilidad técnica experimental* de filtro y consultas en WebGL2/Three.js r186.1 con medidas A/B; (4) **solo tras evidencia**, declarar Gate separado de implementación. Después de completar Occlusion Culling y su QA, examinar builds por CPU/RAM de compilación, módulos iniciales y tamaño/AppImage en un Gate independiente. La autorización actual **no** ejecuta ninguno de esos pasos técnicos.

### Fuentes públicas verificadas el 2026-11-15

- Unity, Occlusion culling: https://docs.unity3d.com/Manual/OcclusionCulling.html
- Unity, dinámicos y oclusores: https://docs.unity3d.com/Manual/occlusion-culling-dynamic-gameobjects.html
- WebGL2 spec, consultas diferidas: https://registry.khronos.org/webgl/specs/latest/2.0/
- MDN, `getQueryParameter`: https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/getQueryParameter
- Three.js, WebGLRenderer: https://threejs.org/docs/pages/WebGLRenderer.html
- Unity Asset Store, Perfect Culling: https://assetstore.unity.com/packages/tools/utilities/perfect-culling-occlusion-culling-system-193611
- Unity Asset Store EULA: https://unity.com/legal/as-terms
