# LevelForge — Auditoría y arquitectura del tornado natural (S00)

**Gate:** `LF-WEATHER-TORNADO-NATURAL-S00-G001` · autorización exacta recibida 2026-10-31.  
**Baseline de entrada:** `LevelForge_WEATHER_STORM_BLACK_ARTIFACT_CORR_G001_SOURCE_BASELINE.zip` (1.306 archivos).  
**Tipo:** diagnóstico, contrato y QA. **NO se autoriza modificar el render de producción.**  
**Estado técnico:** CONTRATO PROPUESTO Y DIAGNÓSTICO NODE; aprobación arquitectónica y QA local Electron/Player **NO VERIFICADOS**.  
**Objetivo:** corregir el defecto conceptual de «cono/capa superpuesta» en futuros Gates, sin reconstruir Weather, CloudField ni Sky.

## 1. Origen y clasificación de evidencias

**OBSERVADO — usuario:** el tornado no parece un fenómeno natural; las nubes no se reorganizan con él. En `.vfx` el defecto de quad negro quedó resuelto según QA visual del usuario; eso es distinto del problema de coherencia meteorológica.

**OBSERVADO — vídeos:** se estudiaron los archivos `tornado2.mp4` (640×360, ~204,5 s) y `videoplayback(2).mp4` (640×360, ~566,6 s). Las hojas de contacto adjuntas son **muestras de fotogramas**, no un seguimiento cinemático completo.

- `tornado2.mp4`: entre 12–130 s predominan visibilidad reducida, precipitación y masas de nube muy oscuras; después aparecen escenas de daños. No se puede medir el diámetro del vórtice ni inferir propiedades físicas a partir de la edición/cámara.
- `videoplayback(2).mp4`: ~30–150 s muestra gran estructura nubosa, bandas y regiones más despejadas; ~225–400 s la circulación se reconoce junto con columna de superficie y precipitación/polvo, cambiando su silueta; ~530 s la zona nubosa sigue evolucionando. **No demuestra** que toda la nube deba girar rígidamente como un cono ni que el embudo siempre condense hasta el suelo.

**OBSERVADO — NOAA/NWS:** las supercélulas pueden presentar corriente ascendente organizada, wall cloud, entrada húmeda, FFD, RFD y clear slot. No todas generan tornado; puede haber tornado físico sin embudo de condensación que toque el suelo. La precipitación puede ocultar la circulación. Los procesos de tornadogénesis no están completamente resueltos. Fuentes:
- https://www.nssl.noaa.gov/education/svrwx101/tornadoes/
- https://www.nssl.noaa.gov/education/svrwx101/tornadoes/types/
- https://www.weather.gov/spotterguide/supercell2
- https://www.weather.gov/spotterguide/tor_life
- https://www.noaa.gov/jetstream/thunderstorms/thunderstorm-hazards-tornadoes

**SIMPLIFICACIÓN ARTÍSTICA PROPUESTA:** un campo macroscópico de organización de tormenta y densidad coherente, sin CFD, para supercélulas representativas. **No** predice cuándo se formará un tornado. Otros tipos (landspout, tromba marina, QLCS) se consideran variantes futuras; no extrapolar obligatoriamente wall cloud/RFD a todos.

## 2. Trazabilidad real del baseline — código y autoridad

| Camino | Ruta comprobada | Estado actual / laguna |
|---|---|---|
| Activación/fases | `world/world.js` `startTornado`, `tornadoStep`, `restoreTornado` | Fases existentes; `startTornado()` solicita preset storm, **no selecciona una nube madre** |
| Viento físico | `world/world.js` `tornadoWindAt`, `windAt3D` → `world/windfield.js` | Autoridad física única, no duplicar fuerza en GPU |
| Nubes por celdas | `world/cloudfield.js` `prepare`, `maintain`, `evaluate`, mapa RGBA; `cloudfield-query.js` | Cumulonimbo localizable para rayo (`lightningOrigin`), **no para un episodio tornádico** |
| Nubes clásicas | `world/params.js` `cloudModel: 'classic'` y `render/skylib.js` `cloudCoverage` | Capa procedural sin identidad de celda persistida; falta definición de región madre local |
| Estado de dibujo | `world/world.js` `frame()` entrega `f.tornado` y `tornadoDurations` | Referencia directa World, sin estado visual persistente adicional |
| Adaptación visual | `world/tornado-visual.js` `tornadoVisualState`, `tornadoFunnelRadius` | Opacidad/alcance/radio dependen de fase, tiempo y altura; no de humedad/condensación local |
| Viewport | `render/viewport-env.js` `setWorld`, `_cellClouds`; `render/viewport.js` | Usa centro tornado, base general de nube y fase; **no clave de nube madre** |
| Campo de nubes shader | `render/skylib.js` `cloudDensity`, `tornadoCloudRoot` | Añade densidad cerca de la base mediante `max(density, root)`; incluso devuelve `root` cuando cobertura local es casi cero |
| Embudo shader | `render/skylib.js` `tornadoCondensation`, `tornadoCloudVolume` | Columna procedural con radio/ruido/espiral; **se marcha por separado** y se compone delante de `cloudLayer()` |
| Composición final | `render/skylib.js` `cloudLayer(dir)` seguido de `tornadoCloudVolume(dir)` | Una sola esfera/ShaderMaterial, **pero dos recorridos de volumen**: explica apariencia de superposición, sin demostrar todos sus defectos visuales |
| Editor/Player | `render/viewport.js`, `events/play-tornado.js`, `events/play-tornado-destruction.js` | Comparten autoridad de World; interacción física y oclusión con geometría 3D requieren QA local |
| Estado persistido | `world/world.js` `restoreTornado` + parámetros Weather | Snapshot de fase/posición/intensidad, no identidad estable de nube madre; semilla `cloudSeed=0` implica aleatoriedad por sesión |

**INFERENCIA — causa de la apariencia artificial:** el embudo tiene una evolución procedimental diferenciada y puede existir donde no hay celda nubosa compatible; mover/activar el tornado no fuerza organización premonitoria de nube madre. La combinación reproduce la sensación de «capa». **CAUSA RAÍZ VISUAL COMPLETA: NO VERIFICADO**, pendiente de A/B en Editor con cámara y perfil constantes.

**Dato de escala que debe revisarse en S01:** el estado World usa `tornado.height` y `tornado.radius` físicos; `tornadoVisualState` puede llevar condensación hasta base gráfica ~900 m; `uTornadoCloud.z` es al menos 35 m o cinco radios. No deben volverse idénticos el volumen físico y el visible, pero sí acoplarse a un mismo eje/región y definir coordenadas y límites verificables.

## 3. Matriz de autoridad vinculante — sin doble estado

| Campo conceptual | Único dueño | Entradas | Consumidores | Persistencia |
|---|---|---|---|---|
| Episodio, fase y trayectoria | `World.tornado` | Weather / `game.weather` / paso fijo | Sky, Jolt, audio, naturaleza, agua, Player | Snapshot World ya existente |
| Estructura y evolución de celdas | `CloudField` (si modo celdas) | Meteorología y viento residente | Mapa de nubes Sky, sombra, precipitación | Semilla y parámetros actuales; caché reconstruible |
| Región madre en modo clásico | Procedimiento **a integrar en el campo de densidad Sky**, gobernado por World | Posición World, clima y tiempo | Sky | **No** crear otro CloudField ni objeto persistente |
| Asociación episodio–nube madre | **Derivación efímera y determinista** propuesta, no implementada | Campo existente, centro World, id de episodio, semilla fija | Sky, diagnósticos | No duplicar estado persistente; verificar reconstrucción exacta al restaurar |
| Circulación física | World/WindField | Intensidad World, centro/radio, obstáculos | Jolt, jugador, agua, árboles | Existing World |
| Advección/densidad atmosférica visual | `CloudField/Sky` | Campo existente, circulación World, humedad, fase | Shader único Sky | Cálculo determinista sin sim física paralela |
| Condensación visible | Sky (función de densidad continua a **diseñar**) | Nube madre, condiciones y campo de circulación | Raymarch atmosférico | Derivada; no en Assets `.vfx` |
| Polvo/material levantado | World + sistemas existentes de superficie, naturaleza, agua y destrucción | Material disponible, contacto, viento | Efectos visuales existentes donde sean aptos | Sin inventar masa desde render |
| Recurso `.vfx` opcional | VFX3D existente | Recurso genérico de usuario | Partículas complementarias, **no embudo principal** | Assets propios sin propiedades meteorológicas |

## 4. CONTRATO PROPUESTO — modelo natural simplificado

### 4.1 NUBE MADRE: selección, enlace y degradación segura

1. **Modo celdas:** seleccionar la celda existente adecuada para organización convectiva según morfología, densidad, humedad, fase y proximidad al episodio. Reusar `evaluate` y una búsqueda determinista acotada siguiendo el patrón de `lightningOrigin`, **sin reutilizar literalmente su criterio eléctrico**. La celda elegida deberá quedar asociada de forma estable durante el episodio: no cambiar de madre por microvariaciones de puntuación.
2. **MODO CLÁSICO:** definir un centro de circulación convectiva derivado de World dentro del mismo campo de nubes clásico; no requiere una `CloudField` segunda ni crear una malla hija. La densidad base y su advección siguen el shader atmosférico original. Se debe justificar cómo un centro solicitado de forma explícita por script organiza gradualmente la capa sin materializar una nube independiente.
3. Si no existe cumulonimbo apto, el modelo no inventará una célula histórica. Debe especificar transición meteorológica → organización de nube *dentro del campo actual*, con estado explícito «madre aún no visible» y sin mostrar instantáneamente un cono.
4. **Determinismo:** `cloudSeed=0` es aleatorio; para Play/Save/Load que exijan restituir la misma nube se necesitará contrato de semilla efectiva reproducible. **BLOQUEO PARA S01** si la política requiere nuevo dato serializado: Amendment explícito antes de implementarlo; no añadir estado oculto persistente por comodidad.
5. La traslación del tornado no debe despegarlo de la tormenta madre ni hacer saltar la cámara/nube. Si las trayectorias dejan de ser compatibles, el contrato S01 definirá la transición de enlace, sin “teletransporte” de volumen.

### 4.2 Organización dinámica (celdas y clásico)

El mismo campo atmosférico debe responder en **organización** antes de mostrar el embudo: entrada lateral, masa ascendente, base bajada local cuando hay humedad y geometría apropiada, deformación/rotación no rígida, concentración de condensación, posibles zonas localmente despejadas del flujo descendente. No todas las tormentas ni wall clouds generan tornado; el modo automático actual conserva episodios fallidos. No introducir temporizadores meteorológicos de NOAA como leyes de juego.

**Modelo de desplazamiento recomendado:** deformar coordenadas de muestreo de densidad con una velocidad visual derivada de la circulación World y altura/distancia (advección estable); el shader no devuelve fuerzas a la física ni modifica `World.tornado`. El tiempo de simulación debe dar el mismo resultado con el mismo estado inicial y pasos.

### 4.3 Condensación continua: retirar la composición aditiva

- **Objetivo S02:** reemplazar la pareja `cloudLayer()` + `tornadoCloudVolume()` compuesta sobre el color final por un **campo de densidad/extinción continuo**, donde la base organizada y la condensación compartan muestra, transmitancia e iluminación volumétrica. La forma procede de campo/humedad/tiempo, no solo de un cono con sinusoides.
- Es un requisito contractual propuesto: no está implementado. Mantener variación irregular espacialmente coherente y temporalmente estable, sin ruido frame-a-frame, sin un emisor VFX3D y sin segunda esfera. Material optativo cerca del terreno no sustituye la condensación.
- Visibilidad del embudo **no equivale a intensidad física**. Con baja humedad puede haber contacto terrestre del viento sin condensación hasta abajo. La lluvia puede ocluir sin apagar la física.
- **Riesgo arquitectónico real:** `cloudLayer()` solo integra la losa `uCBase..uCBase+uCThick`, normalmente elevada. Para condensación bajo la base, integrar un segmento continuo necesita revisar los límites del raymarch, integración/transmitancia y coste. **No basta eliminar `tornadoCloudVolume`**: ello haría desaparecer el embudo bajo la nube. El diseño S02 debe concretar el dominio y la oclusión de escena.
- El Sky es un fondo sin profundidad sólida del mundo; la oclusión frente a edificios, terreno y otros objetos requiere diagnóstico antes de prometer realismo espacial.

### 4.4 Suelo, lluvia y material disponible — S03

- Mantener `PrecipFX` para lluvia y bruma, `WaterWorld` para líquido y World/Jolt para movimiento y colisiones. La señal de suelo material debe venir del recurso de superficie existente; sin evidencia de material disponible no habrá polvo infinito.
- Un tornado físico con condensación parcial puede generar una nube de polvo/debris solo si interactúa con suelo y materiales aptos. La representación debe seguir el mismo viento/centro World.
- Lluvia intensa puede ocultar el embudo. No convertir polvo/agua en un nuevo emisor obligatorio, y no reutilizar VFX3D para sustituir nubes.
- S03 no redefine Jolt; cualquier dependencia Jolt WASM real sin QA permanece **NO VERIFICADA**.

### 4.5 Morfologías y fases — estados y variantes, no presets de sistemas nuevos

- Preservar las ocho fases World vigentes. `development` y `organization` **no aplican fuerza de tornado** por contrato; solo cambian entorno y futura estructura visible.
- `formation`: puede existir circulación física progresiva sin columna de condensación continua; `active`: no obliga a mostrar un embudo hasta el suelo; `weakening` y `dissipation`: estructura se desorganiza sin cortar la nube madre bruscamente.
- Variantes: estrecho, wedge, inclinación, condensación parcial y rain-wrapped son parámetros de una misma infraestructura, no clases/emitters diferentes. Multi-vórtice queda **PENDIENTE PLANIFICADO**.
- **Diferencia contra baseline:** `tornadoVisualState` fija `reach=1` en active y `ground` con `reach>0.7`; eso se interpreta solo como alcance visual actual y se desacoplará de contacto físico en S02 mediante contrato, no cambiándolo ahora.

## 5. Restricciones, contradicciones y decisiones pendientes

| ID | Estado | Problema / resolución obligatoria |
|---|---|---|
| NAT-DEP-01 | PENDIENTE PLANIFICADO | `CloudField` opcional y modo clásico predeterminado: S01 debe cubrir ambos sin sistema paralelo |
| NAT-DEP-02 | **BLOQUEO POTENCIAL** | Cloud seed aleatoria 0 y restauración de nube madre: resolver reproducibilidad antes de exigir identidad tras Save/Load |
| NAT-DEP-03 | **AMENDMENT PENDIENTE** | Reemplazar la composición separada del `tornadoCloudVolume` por integración de densidad continua cambia el mecanismo visual ya implementado; revisar `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001` con `LF-WEATHER-TORNADO-NATURAL-CA-001` propuesto |
| NAT-DEP-04 | QA PENDIENTE | Profundidad/oclusiones Sky contra geometrías sólidas no certificadas: no prometer sin medición |
| NAT-DEP-05 | QA PENDIENTE | Jolt WASM real y Player; no declarar QA físico por tests unitarios |
| NAT-DEP-06 | QA PENDIENTE | Rendimiento GPU por perfil: no se dispone en este entorno de Electron instalado ni medición FPS/tiempo GPU del shader reestructurado |
| NAT-DEP-07 | ALCANCE EXCLUIDO | Tornado no-supercélula: landspout/tromba marina requiere evaluación posterior, no forzar wall cloud en todos los tornados futuros |
| NAT-DEP-08 | PENDIENTE PLANIFICADO | Definir dueño/contrato de muestras de terreno para polvo; no crear sistema físico paralelo |

**Compatibilidad con contratos:** `LF-WEATHER-TORNADO-LIFECYCLE-CA-001` rige World y fases; `LF-VFX-WEATHER-DECOUPLING-CA-001` quedó **SUPERSEDIDO parcialmente** por `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001` en cuanto al emisor del embudo. No alterar ni “reabrir” obligaciones de efectos genéricos, agua, fuego, Jolt o recursos VFX.

**CA-001 PROPUESTO**: documento contractual separado, no vigente hasta aprobación; no afirma superseder por sí solo un Amendment aprobado.

## 6. Rendimiento y diseño de presupuesto

**OBSERVADO:** `SKY_FRAG` utiliza hasta `uCloudSteps` (24/36/56 según perfil en Viewport) para nube y cuatro muestras de sombra por paso con densidad positiva. `tornadoCloudVolume` añade hasta **12** muestras por pixel intersectado, con descarte temprano si no hay episodio; no son necesariamente 12 sobre toda la pantalla.

**NO VERIFICADO:** tiempo real GPU, número total de samples por píxel en una escena variable, costos de voxel/texture, calidad de Compatibility y Player. Un `gl.getError() == 0` solo acredita ausencia de error GPU, no rendimiento o fidelidad meteorológica.

**Política propuesta de medición S01–S04** (umbrales no fijados sin evidencia): misma escena/resolución/cámara/posición, perfil y distancia, comparación base S00 contra cambios; reportar p50/p95 frametime, GPU timer si extensión disponible, draw calls, memoria y pixel coverage de la región de condensación; render sin tornado no debe recorrer la región extra. Preservar escasez de recursos del N5030/4GB y evitar CPU por partícula. Si una mejora degrada injustificadamente Compatibility, BLOQUEAR y rediseñar.

## 7. Gates futuros (PLAN, NO AUTORIZADOS)

| Sprint | Unidad de implementación | Dependencia/QA de integración |
|---|---|---|
| S01 | Nube madre: vínculo determinista (celdas/clásico), deformación atmosférica localizada en organización | CA si afecta persistencia; pruebas de continuidad al mover centro y restaurar; CPU/GPU |
| S02 | Condensación acoplada a densidad/transmitancia común del campo y RFD visual moderado | CA-001 ratificado; visual A/B frente a vídeos, escena sólida y 3 perfiles, sin halo/capa |
| S03 | Contacto terrestre y materia disponible; visibilidad por lluvia | Depende de S02; sin duplicación agua/Jolt; evidencias en superficie |
| S04 | QA integración Editor/Play/Player, rendimiento y regresión, N5030 | Completar Jolt WASM real si se reclama física; finales/destrucción sin residuos |

Cada Sprint requiere **otro Gate autorizado explícitamente**. Este S00 no modifica lógica, shaders, recursos ni proyectos.

## 8. Resultado S00 y criterio de cierre

- **IMPLEMENTADO:** auditoría, matriz de autoridad, propuesta contractual, referencias visuales y plan de pruebas; código de producción intacto.
- **TEST AUTOMATIZADO NODE:** resultados recogidos en QA independiente.
- **QA ELECTRON:** fixture diagnóstica existente (`tornado-cohesion.html`); estado registrado en QA; no representa nuevo tornado natural.
- **NO VERIFICADO:** comportamiento visual final, oclusión 3D, Player, reproducción físico/Jolt, GPU en N5030.
- **CIERRE:** se requiere revisión y aprobación del usuario de esta arquitectura y resolución de las contradicciones contractuales relevantes antes de S01/S02. No se declara S00 cerrado automáticamente.
