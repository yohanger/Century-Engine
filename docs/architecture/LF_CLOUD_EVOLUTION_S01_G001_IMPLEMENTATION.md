# LF-CLOUD-EVOLUTION-S01-G001 — Implementación integral de evolución atmosférica

**Estado:** IMPLEMENTADO EN FUENTES · NODE TEST PASS · BUILD/ELECTRON/PLAYER NO VERIFICADOS EN EL CONTENEDOR · APROBACIÓN DE USUARIO PENDIENTE.

## 1. Precedencia y fundamento

Último SOURCE_BASELINE inicial: G003 Authority Recovery and Contract Reconciliation, 3568 archivos. Autoridad vinculante: CA-002-01..10 ratificada; G002 aprobado; G003 aprobado; contratos meteorológicos anteriores compatibles. Extender código real, sin copiar código de Unreal/Decima ni introducir dependencias. La ausencia del texto literal CA de reemplazo volumétrico anterior permanece en su histórico y no se trata como permiso de sobrescritura.

## 2. Mecanismo implementado

- **World/Weather:** forzado ambiental y ciclo del Director siguen bajo World. La mezcla de estados y CloudField usan el mismo paso meteorológico cuando el Director está activo; la hora del día puede conservar un reloj separado. El tiempo del shader del cielo con clima activo procede del estado de World (se congela durante pausa).
- **CloudField:** `evaluate()` conserva la etiqueta morfológica para diagnóstico, elegibilidad de rayos, meteorología y tornado. En lugar de escoger primitivas discretas, mantiene *convective*, *sheet* y *wispy* como características continuas. Radio, altura, desarrollo y relieve derivan de esas características; `_apply` aproxima progresivamente sus objetivos. Las seis primitivas por celda mantienen orden e identidad hash; el viento diferencial no cambia por reclasificar MORPH. No hay objetos nube que se sustituyan entre categorías.
- **CloudVolume:** conserva condensado, vapor, advección simplificada, interpolación temporal, volumetría 80×80×16 máxima. Recentrado solapado remuestrea; saltos sin solapamiento generan fuente de condensado en destino antes de publicar un frame vacío. Esta reconstrucción expresa una distribución aproximada de equilibrio, NO la historia física exacta de la región no residente.
- **GPU/Sky:** permanece la textura 3D RG (dos estados temporales) y el único shader atmosférico. La estructura continua ya se expresa en el condensado antes del envío a GPU. El detalle visual deja de desplazarse verticalmente de forma independiente del volumen. No se añadió textura de tipos ni shader paralelo.
- **Editor:** no invoca `World.update` en Edit Mode. Permite remuestrear regiones espaciales al desplazarse la cámara sin hacer transcurrir tiempo meteorológico. `liveFx` mantiene lluvia visual, agua, iluminación, naturaleza y demás previsualizaciones. La hora y el tiempo de shader meteorológico están estáticos fuera de Play.
- **Play/Player Save:** snapshot opcional de transición meteorológica activa, progreso y tiempo, offset de viento, director y forzado del campo; el estado volumétrico existente se mantiene. Se aceptan guardados anteriores sin estos campos. NO se acredita secuencia futura idéntica de números aleatorios del Director después de cargar; se conserva continuidad del estado de clima y condensado.
- **Inspector:** nuevas escenas usan campo `cells` como ruta natural predeterminada y esconden los controles manuales de forma y semilla. Se preservan parámetros en datos y esquema API, y `classic` sigue siendo legible para escenas guardadas que lo especifican. No se impone migración ni se eliminan datos experimentales.

## 3. Interfaces públicas e integraciones

| Consumidor | Mecanismo de preservación | Prueba |
|---|---|---|
| World/Director | `setWeather`, `nextWeather`, `update`, `frame` | S01-09, S01-13 |
| CloudField | `evaluate`, `prepare`, `primitives`, `maintain`, `precipitationAt`, `lightningOrigin` | S01-03..06, S01-14, clouds |
| CloudVolume | `rebuild`, `advance`, `sample`, `snapshot`, `restore` | S01-07..08, G001-03..05 |
| GPU/Sky | 3D RG8 y mismo raymarch | S01-08, fixture 14 checks pendiente GPU |
| Editor | `_sceneFrame`, `applyWorld`, `liveFx` | S01-12, QA local pendiente |
| Player Save | `captureWorld`, `restoreWorld`, `restoreCloudField` | S01-09..11; Player local pendiente |
| Tormenta | `selectTornadoMother`, `lightningOrigin`, `startTornado`, `precipitationAt` | S01-14, Weather series |
| Curvatura | radio planetario terrestre compartido | CORR-002 / CORR-003 8+8 |

## 4. Contrato de límites y contradicciones

- El tiempo atmosférico puede acelerarse sin alterar el movimiento de cuerpos Jolt ni el reloj de juego. Las APIs previas no se renombran.
- Las nubes `classic` de escenas previamente guardadas se conservan por protección de trabajo vigente, no como segunda implementación nueva. Una futura retirada requiere auditoría independiente y autoridad específica.
- La textura RG8 no codifica etiquetas MORPH; la variedad procede de la estructura del condensado antes de llegar al shader. Calidad visual y representaciones finas como cirros necesitan QA A/B de usuario.
- La recuperación tras un teletransporte distante es espacial, no una simulación física retroactiva; no se garantiza reproducir el mismo volumen histórico en áreas no residentes.
- Persisten límites anteriores no intervenidos: composición con Terrain, oclusión por geometría, igualdad perceptual de Editor/Player, memoria GPU y 60 FPS no certificados.
- `World.restoreWeatherEvolution` valida su entrada antes de mutar; snapshots de partidas anteriores son opcionales.
- No se crea controlador meteorológico, renderizador, geometría de nube o motor de partículas paralelo.

## 5. Archivos productivos afectados

`src/engine/runtime/world/{cloudfield.js,cloud-volume.js,world.js,params.js}`, `src/engine/runtime/render/{sky-cloud-volume.js,viewport.js}`, `src/engine/runtime/events/play-saves.js`, `src/engine/runtime/scene-graph.js`, `src/components/ScenePanel.vue`.

Las modificaciones a `scripts/test-clouds.mjs` y `scripts/test-cloud-evolution-integral-validation-g001.mjs` actualizan expectativas de comportamiento explícitamente supersedidas por G001 de implementación. El histórico anterior permanece en G003. La fixture `cloud-convection.html` se extiende; se añaden runners integrales Node y Electron WebGL2.

## 6. Criterios QA de aceptación antes de cierre

- Node: suite integral, nube natural, atmósfera, clima, tormenta, guardado y tests de autoridad.
- Electron: `node --test scripts/test-cloud-evolution-electron-s01-g001.mjs`; verificar al menos 14 checks, GLSL y comparación suelo/aire.
- PlayMode: formación, convección, fusión, disipación, pausa, avance del Director, Play/Stop.
- Runtime: comprobar Player, lluvia/rayos/tormentas, guardado en transición y teletransporte de al menos 20 km, sin publicaciones vacías.
- Perfiles Forward+, Mobile y Compatibility: medir FPS, p50/p95 CPU y GPU y memoria GPU/CPU sobre mismos escenarios; no prometer 60 FPS sin medirlo.
- Guardado/recarga: documento de entrada completo y parcial; no modificar proyecto de usuario.

**Gate:** Autorizado e implementado, no aprobado ni cerrado sin QA local de usuario.
