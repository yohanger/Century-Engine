# LF-VFX-RENDERER-CONSOLIDATION-AUDIT-S00-G001

**Estado:** AUDITORÍA DE CÓDIGO IMPLEMENTADA · NODE PASS · QA ELECTRON/PLAYER Y COSTES GPU NO VERIFICADOS · PENDIENTE DE APROBACIÓN DEL USUARIO. **No hay migración autorizada.**

**SOURCE_BASELINE:** `LevelForge_VFX_BLACK_ARTIFACT_CORR_G001_CORR_001_SOURCE_BASELINE(1).zip` (1.295 archivos, ZIP íntegro). `package.json`: Three.js 0.186.1, Electron ^44.5.1, LevelForge 0.26.13. El informe se fundamenta en este código y los contratos del propio proyecto, no en suposiciones sobre ejecuciones visuales posteriores.

**Autorización exacta:** `Listo. LF-VFX-RENDERER-CONSOLIDATION-AUDIT-S00-G001 autoriza comenzar`. El Gate permite documentos, runners, fixtures, pruebas y medición diagnóstica; **prohíbe modificar runtime, migrar escenas o sustituir efectos**.

## 1. Autoridad y contratos

- `LF-VFX-S00-G001_CONTRACT.md`: `.vfx` declara definición compartida; `VFX3D` referencia por `vfxId`; cada instancia tiene simulación propia, con límite y semilla. La vista previa reutiliza el viewport existente.
- `LF-VFX-INSPECTOR-CA-001.md`: edición en Inspector y previsualización explícita; no montar otro editor/modal o renderer.
- `LF-VFX-WEATHER-DECOUPLING-CA-001.md`: `.vfx` no persiste estados meteorológicos. **Su cláusula 4 sobre tornado visual temporal está SUPERSEDIDA** por `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md`; no debe reimplantarse.
- `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md`: embudo y nubes comparten shader atmosférico; World conserva viento, fase y física; agua y brasas pueden consumir VFX3D de autor opcional.
- `LF-WATER-LIQUID-CA-001..004.md`: la visualización no debe apropiarse de la masa, escorrentía o volumen de WaterWorld.
- `LF-VFX-BLACK-ARTIFACT-CORR-G001_IMPLEMENTATION.md` y `LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001_AUDIT.md`: el rectángulo VFX fue reportado como desaparecido por el usuario; **Llovizna seguía presentándolo**. La causa de esa segunda manifestación está abierta.

No se detectó una obligación vigente de convertir todos los fenómenos naturales en recursos `.vfx`. **La similitud del quad, ShaderMaterial o código de transparencia no implica identidad de responsabilidades ni justifica automáticamente reemplazar el renderer.**

## 2. Inventario de productores y consumidores

| ID | Efecto / productor real | Consume `.vfx` | Simulación y datos propios | Geometría, material y techo observado | Punto de activación / propietario | Clasificación propuesta |
|---|---|---|---|---|---|---|
| FX-01 | Nodo `VFX3D` | **Sí**, `vfxId` | `VfxSimulation`, pasos 1/60 s, semilla, pool CPU (máx. **1.024** por recurso) | `VfxBillboardRenderer`, un Mesh con quads instanciados y ShaderMaterial; alpha/aditivo, textura opcional | `runtime/nodes/vfx.js:14–32,110–124` | **CONSERVAR** |
| FX-02 | Vista previa `.vfx` | **Sí**, mismo recurso | nueva instancia `VfxSimulation`, no duplicado de definición | **Mismo** `VfxBillboardRenderer` en el Viewport del Editor | `core/editor/vfx-preview.js:64–73` | **CONSERVAR** |
| FX-03 | Gotas de lluvia | No | `PrecipFX` mueve visualmente en GPU, alrededor de cámara; 384 gotas muestreadas, máx. 64 raycasts/frame | Mesh y ShaderMaterial de tira instanciada, **7.000** gotas | `world/fx.js:5–15,120–144,178–235`; `render/viewport.js:82,219` | **CONSERVAR ESPECIALIZADO**, AUDITAR postproceso |
| FX-04 | Bruma de lluvia | No | comparte lógica de `PrecipFX` y viento | Mesh de quads GPU, **1.800** instancias | `world/fx.js:140–145,178–214` | **CONSERVAR ESPECIALIZADO**, AUDITAR postproceso |
| FX-05 | Nieve | No | advecta/flexiona en GPU con bucle espacial y viento | `THREE.Points`, shader propio, **7.000** copos | `world/fx.js:150–152,216–230` | **CONSERVAR ESPECIALIZADO** |
| FX-06 | Salpicadura de lluvia | No | anillos orientados a normales del impacto, edad y pool GPU | Mesh de quads instanciados, **520** | `world/fx.js:153–166,236–267` | **EVALUAR** semántica compartida de impacto; no asumir equivalencia visual con SplashFX |
| FX-07 | Salpicadura de agua al impactar | No | `SplashFX`: gotas físicas visuales CPU con gravedad, vida y pool fijo | `THREE.Points`, **480** partículas; un draw de puntos | `world/splash.js:24–94`; `events/play-water.js:21,53` | **EVALUAR REUTILIZACIÓN**, conservar agua y trayectorias |
| FX-08 | Hojas de vegetación | No | `LeafFX`: selección espacial de árboles; caída/rotación/viento en GPU; presupuesto **96 árboles × 14 = 1.344 hojas**, refresco 1,5 s | Mesh con quads GPU instanciados; ShaderMaterial propio | `world/leaves.js:4–8,61–80,99–144`; `world/nature.js:16,50` | **CONSERVAR ESPECIALIZADO**, AUDITAR postproceso |
| FX-09 | Criaturas/luciérnagas | No | `CritterCluster`/FSM/IA por agente; máx. **2.048** muestras visuales | `THREE.Points`, shader de halo aditivo | `critters/system.js:1–51,65–114`; `world/nature.js:17,51` | **CONSERVAR SIMULACIÓN**; posible reutilización limitada de política de render |
| FX-10 | Rayo físico | No | World/Lightning determina descarga, canal, branching y brillo | `THREE.Mesh` con cintas de `BufferGeometry` regeneradas por descarga; aditivo | `world/lightning-fx.js:9–112`; `render/viewport.js:83,221` | **CONSERVAR ESPECIALIZADO** (ribbons no soportados en VFX v1) |
| FX-11 | Nubes/condensación/tornado visual | No | World/CloudField y shader atmosférico existentes | esfera del cielo con raymarch y volumetría; **no son quads de partículas VFX** | `render/skylib.js`, `render/viewport.js`, `world/tornado-visual.js` | **CONSERVAR** por contrato vigente |
| FX-12 | Agua, ondas y espuma | No | WaterWorld/solver, `RIPPLE_MAX=16`; shaders de superficies de agua | mallas de agua y normales/espuma; no emisor CPU | `geometry/waterworld.js`, `geometry/waterripple.js`, `geometry/water-surface.js` | **CONSERVAR** por autoridad física |
| FX-13 | Brasas y agua suspendida de tornado | **Opcional**, por nodo VFX3D explícito | `TornadoCombustion` y WaterWorld conservan la física; adaptador solo mueve VFX asignado | Consume renderer FX-01, **no crea renderer genérico nuevo** | `events/play-tornado-destruction.js:14–44,215–232` | **CONSERVAR** y verificar QA físico |
| FX-14 | Marcadores del Editor y efectos de postprocesado | No | `navigation.js` contiene `THREE.Points` de ayuda; `look.js` y `render/*` son pases de imagen | No son simuladores de partículas creados por el usuario | `nodes/navigation.js`, `render/look.js`, `render/volumetric.js`, etc. | **FUERA** de migración `.vfx` |

Este inventario cubre el código de construcción de Points, quads, shaders visuales, runtime de naturaleza, climas, agua y postproceso del baseline. No se afirma que cada clase se ejecute en toda escena ni que sus máximos estén simultáneamente activos.

## 3. Capacidad real y riesgos de sustituir

- El recurso `.vfx` v1 **no** admite ribbons, condensación atmosférica, drenaje de agua, colisiones per-partícula, GPU advección o cantidades ilimitadas. `resource.js` define emisión/forma/movimiento/apariencia/evolución sin propiedades meteorológicas; `simulation.js` limita a `VFX_MAX_PARTICLES = 1024`.
- `PrecipFX` utiliza un conjunto fijo de geometrías y atributos GPU compartidos con la cámara, sin `Object3D` por gota. Transportar esas 7.000 gotas + 1.800 instancias de bruma al VFX CPU sería un cambio de algoritmo, escala y rendimiento; **NO RECOMENDADO** en el estado actual.
- `LeafFX` hace el movimiento de hojas en el vertex shader y actualiza la búsqueda de emisores menos frecuentemente que los frames. VFX CPU no ofrece esa equivalencia.
- `CritterSystem` tiene comportamiento IA, sincronización y refugio meteorológico; `.vfx` no describe agentes ni FSM.
- `SplashFX` y la salpicadura `PrecipFX` **no son duplicados funcionales exactos**: gotas balísticas de cuerpos de agua frente a anillos orientados a superficies impactadas por lluvia. Pueden compartir reglas de alfa/depth, no necesariamente un solver.
- `LightningFX` regenera ribbons sobre la ramificación del canal; un quad VFX genérico no sustituye la geometría del rayo.
- El Player carga `.vfx` referenciado y comprueba la textura desde `runtime/package/host.js:26–33`; la exportación comprueba referencias en `core/buildList.js:42–46`. No alterar contratos de empaquetado por este análisis.

## 4. Hallazgo transversal: GTAO y geometría translúcida

**OBSERVADO:** `vfx/render.js:79–80` marca el mesh VFX con `lfExcludeFromAO=true`, y `render/look.js:294–308` utiliza la caché de `_overrideVisibility()`/`_restoreVisibility()` del GTAOPass para ocultar ese Mesh mientras se generan normales/depth. La política **no** se aplica en `world/fx.js` (lluvia, bruma, salpicaduras) ni en `world/leaves.js`.

**INFERENCIA TÉCNICA:** los quads instanciados de lluvia/bruma/hojas, al sustituirse su material durante GTAO, podrían contribuir con su quad base sin los atributos GPU ni `discard` usados en el shader original. Es compatible con la captura de Llovizna con tornado desactivado, y con la diferencia observada respecto al `.vfx` corregido.

**CAUSA RAÍZ DE LLOVIZNA:** **NO DEMOSTRADA** hasta ejecutar en Electron una comparación con/sin GTAO y con/sin `PrecipFX` en la misma escena. No atribuir ni solucionar el artefacto durante S00. El Gate autorizado `LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001` es dueño de esa eventual corrección; habrá que validar también `LeafFX`, pues usa quads de tipo Mesh transparentes.

## 5. Decisión de consolidación propuesta (no autorizada para ejecutar)

| Área | Decisión | Condición antes de cambiar | Resultado esperado |
|---|---|---|---|
| Renderer VFX oficial | **CONSERVAR** | Regresión GPU/Player completa y conservación del correctivo GTAO | Una sola implementación de recursos VFX de autor |
| Geometrías instanciadas especiales (lluvia, hojas) | **CONSERVAR**, evaluar infraestructura **común limitada** para policy alpha/depth/AO | Medición visual CPU/GPU y comparativa con GTAO real | Evitar bugs comunes sin reemplazar simulaciones GPU |
| SplashFX / PrecipFX splash | **EVALUAR**, no sustituir aún | Comparativa de trayectorias, normales, volumen, contratos de Player y costes | Reuso donde exista equivalencia real |
| CritterSystem | **CONSERVAR FSM y render**, revisar política de Points | QA visual día/noche, cap de agentes y additive | Sin regresiones IA o rendimiento |
| LightningFX | **CONSERVAR**, evaluar sólo política de transparencia/post | Prueba de cintas de rayo real en Electron | Mantener ramas y halos físicos |
| CloudField, Sky, WaterWorld | **CONSERVAR** sin migración | Amendments vigentes | No reintroducir tornado como capa VFX |
| Editor / Player / paquetes | **CONSERVAR**, QA obligatorio | Comparar mismo proyecto exportado, visual y recursos | Misma definición, simulación por instancia |

Los cambios deben implementarse **en los archivos originales**, usando el mínimo mecanismo compartido que demuestren las pruebas, no crear `FXManager`, `GenericVFXRenderer`, `utils.js`, un segundo runtime, escena persistente o estado duplicado. No se recomienda un Gate de migración masiva.

## 6. Instrumentación y evidencia

- `scripts/test-vfx-renderer-consolidation-audit-s00-g001.mjs`: invariantes de consumidor, contratos, techos y riesgos de consolidación; pruebas estructurales no equivalentes a QA GPU.
- `scripts/bench-vfx-renderer-consolidation-s00-g001.mjs`: benchmark de **CPU aislada** de `VfxSimulation` con 64, 256 y 1.024 partículas durante 600 pasos, cinco repeticiones; no mide VFX gráfico, precipitación, GPU ni FPS.
- `scripts/fixtures/vfx/renderer-consolidation-audit.html`: instancia **las clases reales**, con cámara y resolución constantes; registra draw calls, conteos, medianas de envío de CPU, errores GPU y casos que utilizan un emisor sintético. Incluye LightningFX **inactivo** (no es un benchmark de descarga). No modifica el Editor ni persiste documentos.
- `scripts/test-vfx-renderer-consolidation-electron-s00-g001.mjs`: usa el harness existente de Electron y `LF_VFX_RENDERER_AUDIT`. **No exige Chromium/Brave externos.**

**Evidencia obtenida en este entorno:** 17 pruebas nuevas Node y regresión relacionada ejecutadas; resultados en documento QA. Sin `node_modules`, GPU Electron y Player **NO VERIFICADOS**; cualquier clasificación dependiente de rendimiento final permanece condicionada a esa evidencia.

## 7. Dependencias, Gates posteriores y cierre

- `LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001` (**YA AUTORIZADO**): aislar `PrecipFX`, bruma, posibles quads en GTAO, capturar error/cambio visual y corregir solo tras probar causa raíz.
- Recomendar un Gate posterior **solo si el usuario lo decide** para compartir política AO/depth/alpha, sin mover los solvers (`LF-VFX-TRANSPARENCY-INTEGRATION-EVAL-G001`, nombre propuesto, NO AUTORIZADO).
- Evaluar aparte un Gate de convergencia **visual** de salpicaduras si el QA demuestra equivalencia (`LF-VFX-SPLASH-REUSE-EVAL-G001`, propuesto, NO AUTORIZADO).
- **Bloqueo:** sin comparativa GPU/Player no hay autorización técnica para sustituir `PrecipFX`, `LeafFX`, `SplashFX` o `CritterSystem` por `.vfx`. Cambios incompatibles con los Amendments deben resolverse antes mediante Contract Amendment.
- QA local del usuario y aprobación explícita para **CERRAR** S00. El ledger debe reflejar `IMPLEMENTADO`, `TEST AUTOMATIZADO NODE PASS`, `QA ELECTRON NO VERIFICADO`, `QA LOCAL PENDIENTE` hasta nueva evidencia.
