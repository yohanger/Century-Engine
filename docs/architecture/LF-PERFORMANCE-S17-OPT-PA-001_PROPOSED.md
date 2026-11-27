# LevelForge S17 — Native Optimization Architecture & Authority Contract

**ID:** `LF-PERFORMANCE-S17-OPT-PA-001`  
**Estado:** **PROPUESTO PARA RATIFICACIÓN; NO ES TODAVÍA CONTRATO PADRE VINCULANTE.**  
**Redacción documental autorizada por:** `Listo. LF-PERFORMANCE-S17-ARCH-G001-INTEGRAL-OPTIMIZATION-AUTHORITY-AND-DIAGRAMS autoriza comenzar`.  
**Fecha de corte:** 2026-11-13. **Base examinada:** `LF_PERFORMANCE_S17_G003_AO_G004_INTEGRAL_COMPOSITE_OPTIMIZATION_SOURCE_BASELINE.zip` (3.345 rutas).  
**Autoría funcional:** el usuario define las capacidades, prioridades y restricciones; el presente texto sistematiza la propuesta técnica. La autoría existente del código y los derechos de terceros NO se transfieren por este documento.

> Esta propuesta no autoriza implementar el orquestador, añadir módulos, cambiar defaults, almacenar nuevos campos ni redistribuir código de los UnityPackage. Si el usuario la ratifica, gobernará únicamente los futuros Gates de esta área sin anular los contratos superiores ya aprobados. Las decisiones señaladas como ABIERTAS requieren resolución explícita antes de codificar.

## A. Visión y límites

El autor crea/importa un **Mesh nativo normal**. LevelForge debe preparar, seleccionar y representar derivaciones de menor coste **sin requerir nodos Mesh alternativos ni cambiar los datos editables originales**. El control adaptativo considera tamaño/error proyectado, cámara, visibilidad, detalle de superficie, coste de GPU/CPU y recursos disponibles. La calidad perceptual prima sobre la mera reducción de polígonos; no se promete equivalencia con Nanite, DLSS o 60 FPS en cualquier hardware.

Se adoptará la regla **EXTEND BEFORE DUPLICATE**. `LodManager`, `StaticBatcher`, `LookPipeline`, `PerfMonitor`, `SceneGraph`, `shared-mesh.js` y sus dependencias conservan sus autoridades actuales. El orquestador propuesto no será un nuevo renderer, un service locator, un sistema global de estado ni un segundo motor de físicas. Mantener Editor Play y NGM Runtime funcionalmente equivalentes, con fallback medible.

## B. Nombres, estado y autoridad de cada rol

| Nombre contractual propuesto | Estado al corte | Propietario real / futuro | Responsabilidad única | Prohibido |
|---|---|---|---|---|
| **OptimizationOrchestrator** (coordinador) | PROPUESTO; no existe la clase | Punto de unión a decidir tras Gate técnico; `Play` ya crea `LodManager` | Coordinar prioridades y presupuesto, enviar solicitudes declarativas a propietarios; no gestionar GPU directamente | Simplificar Mesh, subir texturas o renderizar por sí mismo |
| **GeometryDetail** (capacidad, NO clase nueva obligatoria) | PARCIALMENTE IMPLEMENTADA | `render/lod.js`, `lodgeo.js`, `lodmgr.js`, `mesh/generators.js` | Calcular detalle proyectado, generar/seleccionar LOD compatible, variar anillos/segmentos cuando se apruebe mecanismo | Cambiar geometría editable/colisión/UV inválidamente |
| **Visibility** (capacidad) | PARCIAL | Frustum Three.js, `LodManager`, `geometry/foliage.js` | Visibilidad/culling de terreno, chunks e instancias; oclusión bake POR INVESTIGAR | Afirmar que existe Perfect Culling nativo |
| **BatchingAndInstancing** (capacidad) | PARCIAL / opt-in | `render/static-batch.js`, `geometry/foliage.js` | Empaquetar solo Mesh compatibles y preservar referencias y física | Agrupar deformables, transparencias o materiales incompatibles |
| **TextureResidency** (capacidad) | **NO IMPLEMENTADA** como gestor unificado | Propietarios actuales: `scene/textures.js`, `scene/environment.js`, `geometry/terrain.js`, `package/host.js` | A futuro: prioridad de mips, cargas/descargas, invalidación y presupuesto aproximado | Confundir texturas con caché/mipmaps/VRAM real |
| **ResourcePreparation** (flujo, no servicio nuevo aprobado) | PROPUESTO | Editor/Build actuales, propietarios de Assets y paquete | Crear derivaciones con versión e invalidación, antes de Play cuando sea seguro | Reemplazar Mesh originales; regenerar masivamente en cada frame |
| **RenderQuality** (capacidad) | IMPLEMENTADA con experimentos | `render/look.js`, `config.js`, `upscale.js`, `viewport.js` | Resolver AO, MSAA, HDR y reconstrucción; aplicar exclusivamente políticas autorizadas | Reactivar TAA/DynRes retirados sin nueva evidencia y contrato |
| **Telemetry** | IMPLEMENTADA | `render/perf.js` (`PerfMonitor`), `PerfPanel.vue` | Producir medidas y diagnósticos (no actuar) | Cambiar calidad según FPS por su cuenta |
| **AssetAuthority** | IMPLEMENTADA parcialmente | `mesh/shared-mesh.js`, proyecto/Assets, `SceneGraph` | Autoridad de los datos editables y sus referencias | Sobrescribir `meshRef` o datos originales con derivados |

**Nombres de roles, no archivos previstos:** `GeometryDetail`, `Visibility`, `TextureResidency`, `ResourcePreparation`, `RenderQuality`, `Telemetry`. No se aprueba crear `geometry-detail.js`, `texture-manager.js`, `core/helpers` ni clases paralelas por esta nomenclatura.

**Decisión ABIERTA O-01:** confirmar mediante Gate técnico si un coordinador mínimo merece una clase nueva `OptimizationOrchestrator` o si una extensión puntual de la composición `Play`/`LodManager` basta. `LodManager` ya posee coordinación geométrica, pero NO debe absorber iluminación, cargas de assets y telemetría formando un monolito. Una clase nueva solo se justificará con contratos explícitos y un único punto de activación.

## C. Matriz de autoridad (única fuente de verdad por recurso)

| Recurso o decisión | Autoridad de datos | Solicitante posible | Ejecutor real | Reversión / fallos |
|---|---|---|---|---|
| Mesh original y geometría compartida | Proyecto/`shared-mesh.js` | Editor | `writeMesh` y flujo Mesh Edit existente | Nunca reemplazar en proyecto por LOD |
| Niveles derivados de Mesh | Género de derivación aún por diseñar | ResourcePreparation / orquestador | `simplifyGeometry` y `LodManager` | Fallback a BufferGeometry base; `detach` ya restaura |
| Anillos/segmentos de malla procedural | Parámetros del Mesh original | ResourcePreparation, tras validar generador | `mesh/generators.js` | Reproducir versión original; no tocar colisión |
| Selección de LOD del terreno | Terrain/`LodManager` | Coordinador | `terrainIndex`, `_setTerrainIndex` | `detach` restaura índices |
| Chunks de foliage | `Foliage` | `LodManager` | `enterPlay`/`updatePlay`/`exitPlay` | Restablecer instancias |
| Batching de decoración | `StaticBatcher` | `LodManager` | `BatchedMesh` bajo `WEBGL_multi_draw` | Restaurar visibilidad, dispose batch |
| Visibilidad por oclusión precalculada | **NO EXISTE contrato persistente** | ResourcePreparation | Por diseñar, futuro Gate | Fallback frustum/distance; invalidación de bake |
| Texturas y mips residentes | Cache/cargadores específicos; ownership incompleto | Futuro coordinador | Futuro propietario por localizar/validar | No reclamar control de VRAM sin medición |
| Calidad de render y framebuffer | `LookPipeline`/`config.js` | Política futura, si aprobada | `LookPipeline` | Preservar ajustes guardados y modo original |
| Estadísticas | `PerfMonitor` | Editor/diagnóstico autorizado | GpuTimer y contadores existentes | Estadísticas indicativas, no políticas automáticas |
| DevTools/Stats en exportación | CA-002 | Opción explícita de Build | AppImage `config.json`, Electron | Por defecto ambas desactivadas |

## D. Flujo de autoría y preparación (futuro contrato, NO implementado)

1. **Autoría:** Mesh y materiales de origen permanecen en el proyecto (`meshRef` o Mesh local). Identidad/colisión, animación y UV siguen siendo autoridad del nodo/recurso original.
2. **Elegibilidad:** comprobar triángulos, atributos, deformaciones, materiales, lightmaps, instancing, cambios dinámicos, escala y valor perceptual. `simplifiable` actual rechaza skinIndex/skinWeight, morphs y uv1; la prueba futura debe cubrir más invariantes antes de producir cache persistente.
3. **Preparación:** generar variantes derivadas (geometría, segmentos/anillos, datos de visibilidad y, si procede, mip/chunks) con una firma de entradas y versión de algoritmo. **No se aprueba un formato de cache concreto** por este contrato propuesto.
4. **Empaquetado:** únicamente los recursos requeridos y validados; manifest explícito de dependencias, invalidez y fallback. El formato `game.rtpkg` no se modificará sin Gate y posible Amendment.
5. **Runtime:** estimar tamaño/error proyectado, visibilidad y restricciones; solicitar selección al propietario, amortizar cambios e introducir histéresis. Nunca reconstruir masivamente todo en un frame.
6. **Invalidación:** si cambia el Mesh base, sus atributos, parámetros de generador o materiales relevantes, invalidar derivados dependientes. Si cambia solo transform sin afectar a la derivación geométrica, recalcular visibilidad/bounds sin rehacer Mesh. Verificar semántica caso por caso.
7. **Restauración:** al salir de Play y ante error, volver a geometría/visibilidad originales, liberar temporales y conservar escenas, scripts y Jolt.

## E. Políticas de decisión (contractuales propuestas)

- **Geometría:** preferir error en pantalla/tamaño proyectado y presupuestos sobre distancia pura. Garantizar histeresis y atención a escala de objeto/cámara. Los niveles no podrán perder siluetas críticas, seams, UV, morph, rigging, vértices de colisión o lightmaps sin alternativa autorizada.
- **Textura:** distinguir mipmapping (selección de detalle de una textura presente) de *streaming/residencia real* (cargar/descartar representaciones); no afirmar que `renderer.info.memory` es la VRAM real. Presupuestos son estimaciones conservadoras, no lecturas fiables de memoria total GPU.
- **Visibilidad:** frustum/distance son mecanismos vigentes; oclusión prebake requiere ciclo de invalidación y gestión de escenas dinámicas. No copiar código/compute de Perfect Culling.
- **Batching/instancing:** elegibilidad opt-in actual y extensión automática futura son decisiones diferentes. **No cambiar silenciosamente `batchStatic` ni sus restricciones contractuales**; se exige Gate específico y CA si contradice comportamiento aprobado.
- **Render:** conservar CA-001 (fidelidad visual primero). TAA y resolución dinámica retirados en 0.26.9 siguen sin reactivarse. Las variantes AO de S17 continúan experimentales y deben validarse en GPU física.
- **Compatibilidad:** Editor y Player comparten Runtime pero deben probarse por separado; en AppImage Stats/DevTools obedecen estrictamente CA-002.
- **Costo:** no ejecutar todas las optimizaciones siempre. PerfMonitor aporta evidencia; una futura política de respuesta automática requiere límites, métricas confiables, amortización y Gate aparte.

## F. Diagramas vinculados a la propuesta

- `docs/architecture/diagrams/LF-S17-OPT-01-authority.mmd`: responsabilidades y frontera autoría/runtime.
- `docs/architecture/diagrams/LF-S17-OPT-02-lifecycle.mmd`: preparación y selección; marcas `FUTURO`.
- `docs/architecture/diagrams/LF-S17-OPT-03-dependencies.mmd`: dependencias permitidas y dependencias prohibidas.

**Regla para diagramas:** flecha punteada = interfaz futura/no implementada; flecha continua = integración real comprobada, salvo que el diagrama lo especifique. Los diagramas son especificación propositiva, no evidencia de implementación.

## G. Puntos abiertos y bloqueos para futuros Gates

| ID | Cuestión | Estado | Resolución necesaria |
|---|---|---|---|
| O-01 | ¿Nuevo coordinador mínimo o extender composición existente? | PENDIENTE | Auditar responsabilidades cruzadas y costo de integración, autorizar Gate técnico |
| O-02 | Cache derivados, firma, invalidación, persistencia/export | PENDIENTE | Contrato de datos/QA y aprobación; sin cambiar formato prematuramente |
| O-03 | Texture Residency y memoria | PENDIENTE | Auditoría assets/loader, estimaciones, referencias y límites WebGL2 |
| O-04 | Culling por oclusión bake | PENDIENTE | Contrato estático/dinámico, invalidación, fallback y QA |
| O-05 | Batching automático sin marcas manuales | PENDIENTE | Contrastar con `batchStatic` opt-in y CA si hace falta |
| O-06 | LOD procedural, parámetros y mallas con UV/rig | PENDIENTE | Matriz de elegibilidad y comparaciones de silueta/calidad |
| O-07 | Qué explica 45–53 ms de `Escena · dibujo` | **CAUSA RAÍZ NO VERIFICADA** | Gate de aislamiento de framebuffer/HDR/MSAA/shaders/píxeles |
| O-08 | AO fusionado y AO a 50/75 % | QA LOCAL PARCIAL | Benchmark fijo y equivalencia visual antes de modificar defaults |

## H. Secuencia recomendada de implementación, NO autorizada por este documento

1. **S17-ARCH-G001** (este Gate): inventario, matriz de autoridad, diagramas, documento de continuidad y ledger; solo documental.
2. **ARCH Contract Ratification**: el usuario revisa esta propuesta; se resuelven contradicciones antes de declararla contrato padre.
3. **SCENE-G001**: medir con precisión el cuello `Escena · dibujo` y verificar impacto de resolución/MSAA/HDR/cielo/materiales; sin presuponer que LOD lo corrige.
4. **OPT-G001**: evaluar contratos de coordinación y elegir la vía mínima (extensión o coordinador ligero), sin mezclar todas las funciones en un Gate.
5. **OPT-G002**: análisis y preparación de variantes geométricas, invalidación, fallback y LOD procedural; integración de escena.
6. **OPT-G003**: visibilidad / batching automáticos SOLO tras evidencia y elegibilidad.
7. **OPT-G004**: auditoría específica de texturas y futuro streaming; no instalar nuevo propietario sin pruebas.
8. **S17 INTEGRATION QA**: Editor, Player, export AppImage, reversión, métricas y rendimiento visual con hardware real.

Los IDs `OPT-G00x` de esta secuencia son **etiquetas planificadas, no Gates declarados ni autorizados**; se refinan a través de Sprint, contrato y Gate literal.

## I. Jerarquía y autoría

**Autoridad (sin cambios):** último Gate autorizado para ejecución > Contract Amendments ratificados y padres vinculantes > documentación GDD/TDD/SRS/URS y QA > histórico. Documentación define comportamiento; código demuestra implementación; ledger registra evidencia. **Este PA-001 permanece PROPUESTO**, de modo que no suplanta CA-001/CA-002 ni un contrato de sistema vigente. Si dos fuentes aprobadas discrepan: BLOQUEAR, Contract Amendment y ratificación.

No se redistribuye ninguno de los `.unitypackage`. Inspiraciones GPU Instancer Pro, Perfect Culling, DLSS y Nanite son referencias conceptuales sin reclamación de equivalencia, licencia o compatibilidad de su código con WebGL2.
