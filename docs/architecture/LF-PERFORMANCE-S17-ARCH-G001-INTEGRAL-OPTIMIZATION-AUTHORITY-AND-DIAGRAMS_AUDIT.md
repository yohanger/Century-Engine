# S17-ARCH-G001 — Auditoría de propietarios, integraciones y límites

**Gate:** `LF-PERFORMANCE-S17-ARCH-G001-INTEGRAL-OPTIMIZATION-AUTHORITY-AND-DIAGRAMS`  
**Autorización recibida:** `Listo. LF-PERFORMANCE-S17-ARCH-G001-INTEGRAL-OPTIMIZATION-AUTHORITY-AND-DIAGRAMS autoriza comenzar`  
**Tipo:** documental: auditar, nombrar, diagramar, proponer contrato padre y sincronizar ledger. **No implementación del orquestador.**  
**SOURCE_BASELINE de entrada:** `LF_PERFORMANCE_S17_G003_AO_G004_INTEGRAL_COMPOSITE_OPTIMIZATION_SOURCE_BASELINE.zip`, 3.345 entradas. **Código de producción: 0 modificaciones.**

## 1. Resultado ejecutivo

No procede construir de cero un «GPU optimization manager» ni incorporar como código los UnityPackage. En la base examinada `LodManager` ya coordina LOD de Mesh, terreno y foliage, y su `StaticBatcher` opcional; `LookPipeline` gobierna render y AO; `PerfMonitor` observa costos. La arquitectura correcta es añadir **solo coordinación transversal que falte**, con propietarios actuales intactos. Los componentes *TextureResidency*, oclusión precalculada y preparación persistente de derivados **no están implementados como servicios unificados verificables**. `OptimizationOrchestrator` es rol propuesto, no clase existente.

## 2. Tabla de evidencia con archivo y puntos de integración

| ID | OBSERVADO en código | Evidencia verificable | Limitación demostrada |
|---|---|---|---|
| A-01 | Play crea una instancia `LodManager` si `rc.lod || rc.batchStatic` y la monta; el update se ejecuta desde controles de Play | `src/engine/runtime/events/play.js:536-539`; `events/play-controls.js:166`; `play-level.js:67` | No hay coordinador transversal de texturas/render en este punto |
| A-02 | `LodManager` registra Mesh pesados elegibles, calcula nivel por tamaño proyectado y puede crear 1 nivel nuevo por update | `render/lodmgr.js:59-111`; `render/lod.js:145-179` | Puede producir nuevas geometrías durante Play; no muestra caché persistente preparada en Editor |
| A-03 | `simplifiable` veta skin, morph y uv1; se rechazan lightmaps/instancing/SkinnedMesh en `addMesh` | `render/lodgeo.js:15-30`; `render/lodmgr.js:60-68` | Compatibilidad avanzada de UV y material no puede presumirse; hay que ampliar pruebas |
| A-04 | Terrain LOD genera/selecciona índices con borde de resolución completa | `render/lod.js:1-63`; `render/lodmgr.js:48-57,88-94,114-120` | Sigue siendo una autoridad distinta de los Mesh importados |
| A-05 | Foliage crea chunks InstancedMesh en Play, utiliza distancia/culling/adelgazamiento y restaura al salir | `geometry/foliage.js:208-253,311-340`; `render/lodmgr.js:107-109` | No demuestra culling de oclusión horneada global |
| A-06 | `StaticBatcher` exige `batchStatic:true`, material/geometry elegibles y extensión `WEBGL_multi_draw`; rollback al fallar | `render/static-batch.js:6-52,62-121`; `render/lodmgr.js:17-35` | No hay batching automático general ni garantía en hardware sin extensión |
| A-07 | Mesh original y compartido se resuelve por `meshRef`; `writeMesh` actualiza un único origen | `mesh/shared-mesh.js:1-46` | La invalidación de derivados no está contratada ni persistida |
| A-08 | `sphere` recibe `seg` y `rings`; `torus`, segmentos mayores/menores; `cylinder` y `cone` reciben `n` | `mesh/generators.js` funciones `sphere`, `torus`, `cylinder`, `cone` | No hay política automática de variantes procedurales LOD integrada con sus parámetros |
| A-09 | Caches y carga de texturas por carretera/sprite incluyen invalidación; terrain usa DataArrayTexture y mipmaps | `scene/textures.js:5-91`; `geometry/terrain.js:157-177`; `package/host.js:52-66` | Un caché no demuestra priorización de mips ni liberación de VRAM bajo presupuesto |
| A-10 | Player exportado `createPackageHost` carga modelos necesarios al cambiar escena; usa host/SceneGraph común | `package/host.js:66-109`; `render/viewport.js` | «Streaming de escenas» no equivale a streaming de texturas por mips |
| A-11 | Look y render config deciden HDR, MSAA, AO y reconstrucción, con experimentos S17 opt-in | `render/look.js:377-440,536-620`; `render/config.js:1-90`; `render/upscale.js` | No trasladar autoridad de render a LodManager/orquestador sin CA/Gate |
| A-12 | `PerfMonitor` mide frames/pases; `Viewport` crea el profiler y tiene pixel ratio hasta 1.75 | `render/perf.js`; `render/viewport.js:23-43`; `look.js` | `renderer.info.memory` no certifica VRAM real; overhead/latencia de GPU requieren QA |
| A-13 | Export AppImage incluye solo Player y juego, con permisos diagnóstico por exportación | `electron/appimage.cjs:42-82`; `electron/player/main.cjs:22-95` | Preparación persistente de Mesh derivado en `game.rtpkg` aún no contratada |
| A-14 | Config default `lod:true`, `batchStatic:false`, `resScale:1`, `taa:false`, `dynRes:false` | `render/config.js` claves por defecto | Automatizar batching o reactivar TAA/DynRes sería un cambio funcional adicional |

## 3. Inventario de referencias de los UnityPackage (solo metadata, sin extracción/reutilización de implementación)

- `GPU Instancer Pro v.0.9.10.unitypackage`: manifiesto inspeccionado, 365 assets; contiene módulos de `GPUICameraVisibilityCS.compute`, Culling, LOD y billboards. **No es compatible directamente con WebGL2/Three.js** por depender de Unity y shaders compute.
- `Perfect Culling - Occlusion Culling System v.1.3.0.4.unitypackage`: 198 assets; incluye herramientas `Editor/Scripts/Baker`, capas de visibilidad, datos bake y compute. Aprendizaje: diferenciar preparación cara y consulta de visibilidad runtime.
- `DLSS 3 - Upscaling for Unity v.1.5.3.unitypackage`: 366 assets; integra `com.tnd.upscaling` y `nvngx_dlss.dll` NVIDIA. Aprendizaje: separar reconstrucción de imagen de LOD/culling y del detalle/residencia de texturas.

Estas cifras describen archivos listados dentro de cada paquete, no licencias verificadas. **No copiar código, binarios, shaders, materiales ni ejemplos propietarios al motor o entregables.** Inspiraciones de arquitectura no conceden derechos de redistribución.

## 4. Separación de responsabilidades propuesta

**Coordinación:** `OptimizationOrchestrator` (nombre de rol reservado; no implementación ni ubicación decidida) recibe evidencia y prioridades y solicita tareas a propietarios explícitos. La alternativa de limitarse a extender el montaje `Play` deberá comprobarse para evitar sobreingeniería.

**Geometría:** `LodManager` conserva terreno, Mesh y foliage; `lodgeo.js` conserva simplificación; `mesh/generators.js` conserva parámetros procedurales. **Texturas:** no crear un supuesto propietario global hasta auditar cargadores y referencias. **Render:** `LookPipeline` mantiene AO/HDR/upscale y sus experimentos. **Telemetría:** `PerfMonitor` solo observa. **Preparación:** no afirmar que ya existe un «bake de LOD persistente»; se propone un flujo Editor/Build sin tocar formatos en este Gate.

**Contradicción potencial C-01 (no conflicto actual entre contratos aprobados):** batching automático permanente sería contrario al actual `batchStatic` explícito y apagado por defecto. Mantener PENDIENTE y exigir Contract Amendment antes de cambiar esa política. **C-02:** TAA/DynRes están retirados: cualquier automatismo que los active queda BLOQUEADO salvo nueva CA y QA. **C-03:** modificar `game.rtpkg` o persistencia por caches derivados exige Gate y contrato de formato; no se autoriza aquí.

## 5. Cuello de botella «Escena · dibujo» y QA heredado

La grabación de usuario `Screencast from 2026-11-13 08-24-55.webm` indicó aproximadamente 45–53 ms GPU en `Escena · dibujo` y reducción puntual de composición AO original ~9,2 ms a fusionada ~4,1 ms. **Son muestras de capturas en condiciones no idénticas**; no son benchmark estadístico ni prueban que LOD/instancing/culling reducirán «Escena · dibujo». Requiere aislamiento propio de framebuffer HDR HalfFloat, MSAA ×4, pixel ratio, cielo, iluminación, shaders y coste por fragmento. No se ha intervenido dicho código en este Gate.

## 6. Hallazgos clasificados

- **OBSERVADO:** módulos, métodos, parámetros y extensiones listados en tabla A-01 a A-14.
- **INFERIDO:** preparar LOD antes del Player podría evitar picos; agrupar puede ayudar en escenas pobladas; los 50 ms de la escena posiblemente dependen de píxeles/shaders. No atribuir mejoras por inferencia.
- **NO VERIFICADO:** coste de cada material/cielo, VRAM real, streaming automático de texturas, bake de oclusión global, mejora FPS del supuesto orquestador, equivalencia con Nanite, licencias de redistribución de packs Unity.
- **CAUSA RAÍZ DEL COSTE DE ESCENA:** PENDIENTE.

## 7. Conclusión y siguiente decisión real

Se formalizó el inventario y la propuesta `LF-PERFORMANCE-S17-OPT-PA-001_PROPOSED.md`, con tres diagramas editables. **No se solicitó ni ejecutó una implementación**. El usuario debe revisar y **ratificar explícitamente** ese PA-001 antes de elevarlo a autoridad padre. Solo después se declaran los siguientes Gates técnicos, priorizando un aislamiento real del costo `Escena · dibujo` y la integración mínima de coordinación.
