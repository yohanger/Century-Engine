# LF-CLOUD-EVOLUTION-S00-G002 — Algoritmo de evolución y contrato de autoridad

**Versión del documento:** revisión de diseño 1.0, 17-11-2026  
**Estado:** **PROPUESTA DOCUMENTAL ENTREGADA; PENDIENTE DE REVISIÓN/RATIFICACIÓN DEL USUARIO**. No representa implementación, aprobación de un Amendment ni cierre del Gate.  
**Autorización documental:** `Listo. LF-CLOUD-EVOLUTION-S00-G002-ALGORITHM-DESIGN-AND-AUTHORITY-CONTRACT autoriza comenzar`.  
**Fuente de continuidad:** `LF_CLOUD_EVOLUTION_S00_G001_INTEGRAL_VALIDATION_SOURCE_BASELINE.zip`, SHA-256 `1c2b21ade48ce5c113dbd11e18c1560fbf8a9f78f302ad1e97a2335c7ab9bb66`; G001 aprobado por usuario tras Node 9/9, Electron WebGL2 12/12 y compilación Vite PASS. No atribuir esa evidencia a G002.

## 0. Declaración de Gate: límites de autoridad

- **OBJETIVO:** especificar, de forma verificable y trazable, cómo deben evolucionar las formaciones nubosas de LevelForge sin reemplazos de morfología, sin sistemas meteorológicos paralelos y preservando el primer salto funcional.
- **MECANISMO:** contrato de propietarios e interfaces, formulación matemática conceptual de condensación/transporte, relojes y pausa, continuidad de regiones, restauración, ruta GPU, consumidores, UX y QA; alternativas con criterios de admisión y descarte.
- **PRERREQUISITOS:** SOURCE_BASELINE G001 íntegro; contratos vigentes de Weather/World/Tornado/VFX; evidencia G001 y log local aportado por el usuario; comparativas Decima/Nubis, UE 5.1, CRYENGINE, Flax, Godot y O3DE.
- **ALCANCE:** documentación y diagramas, conciliación contractual como propuesta, seis hojas del ledger; revisión de runners y archivos productivos **en solo lectura**. La implementación, cambios de archivos de producción, parámetros, shaders, persistencia, Inspector o export están excluidos.
- **MEDIOS:** inspección de código real, runners Node preexistentes, contratos adjuntos y evidencia Electron entregada por usuario; documentos y comprobación de integridad/diferencias.
- **EVIDENCIA:** matriz código→requisito→prueba; comandos y resultado QA documental; hash baseline; auditoría de contradicciones; integridad CHANGE→SOURCE_BASELINE.
- **CONTRADICCIONES:** `liveFx` avanza Weather en Edit Mode; ruta `classic` es predeterminada y `cells` optativa; el texto completo de `LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001` no está en la carpeta contractual del baseline; oclusión frente a geometría no certificada; Player exportado y presupuesto GPU no medidos aquí. **No se declaran cláusulas supersedidas sin enmienda ratificada.**
- **SIGUIENTE ACCIÓN:** revisión del usuario y, si se acepta, ratificación de la autoridad/Amendment pertinente. Solo entonces podrá declararse un Gate de implementación integral compatible.

## 1. Madurez, fuente y clasificación de evidencia

LevelForge es una base funcional, aún sometida a Gates pre-1.0. El número de versión de documentos o Gates no acredita estabilidad universal del runtime. Las pruebas siguientes son de **caracterización**: no deben interpretarse como resultados de una implementación todavía inexistente.

| Categoría | Afirmación | Fuente verificable |
| --- | --- | --- |
| OBSERVADO | `World` es el dueño del tiempo, los estados meteorológicos y la petición de descargas | `world/world.js`, `world/api.js`, CA Weather/Tornado |
| OBSERVADO | `CloudField` tiene claves espaciales estables, 7 categorías y `morph`/`prevMorph` con mezcla discreta | `cloudfield.js`: `evaluate`, `primitives` |
| OBSERVADO | `CloudVolume` mantiene `water`, `vapor`, dos muestras temporales y dimensiones 80×80×16 máximas | `cloud-volume.js`, `cloud-volume-state.js` |
| OBSERVADO | La textura 3D RG conserva dos canales de densidad, no la etiqueta morfológica | `viewport-env.js`, `sky-cloud-volume.js`, prueba G001-02 y WebGL2 G001 |
| OBSERVADO | El recentrado lejano puede publicar inicialmente condensado cero | `CloudVolume._recenter`, G001-04 (20 km) |
| OBSERVADO | `World.update(dt,{clock:false})` avanza condensado sin avanzar la hora | `world.js`, `scene-graph.js`, G001-07 |
| OBSERVADO | Snapshot Player no captura íntegramente `_fade` | `play-saves.js`, G001-06 |
| INFERENCIA | Un cielo puede parecer que sustituye formas cuando cambian geometrías categóricas | requiere secuencias visuales A/B |
| HIPÓTESIS | Una densidad más estructurada en la misma textura RG8 alcanzará variedad suficiente | por validar en WebGL2 real |
| DECISIÓN PENDIENTE | Necesidad de atributo GPU extra y criterio cuantitativo de residencia | sujeto a QA de prototipo posterior |

**Regla de propiedad:** contratos definen obligaciones; código acredita estado; QA acredita comportamiento; el ledger registra sin sustituir a ninguno de ellos.

## 2. Autoridad y límites del subsistema

**A-01 · World único.** `World` mantiene clima, viento, director, hora, fases de tormenta/tornado, eventos y forzado atmosférico. Se prohíbe crear otro Weather Director o estado climático propietario en Sky, VFX o CloudVolume.

**A-02 · CloudField distribuye, no gobierna el clima.** Sus claves mundiales, distribución regional, residentes, consultas y semilla efectiva se conservan. Su clasificación `MORPH` queda **descriptiva/derivada** para compatibilidad de consultas y diagnóstico; nunca reemplazará una formación existente por cambiar de categoría.

**A-03 · CloudVolume conserva el estado del condensado.** Reutilizar sus buffers, paso fijo, rango activo, remuestreo y snapshot; no crear simulador global paralelo ni sistema de objetos nube equivalente.

**A-04 · Sky es consumidor.** `viewport-env.js` proporciona datos y recursos al shader existente. `sky-cloud-volume.js` y `skylib.js` convierten densidad en imagen, sin decidir dónde nace una tormenta.

**A-05 · Efectos consumidores.** `effectivePrecipitationAt`, `lightningOrigin`, `physicalState`, `opticalDepthAlongRay`, `windAt3D` y fenómenos tornádicos conservarán semántica y contratos públicos; cualquier cambio incompatible precisa Amendment explícito.

**A-06 · Editor/Play/Runtime.** Edit Mode muestra representación editorial fija y recalcula cuando cambien sus ajustes; PlayMode y Player avanzan el tiempo meteorológico. Debe preservarse la previsualización editorial independiente de otros FX.

**A-07 · Un único ciclo de vida.** Un volumen/recursos GPU por campo residente, con liberación en cambio de escena, reset, Stop y disposal; no duplicaciones de datos sin perfilado.

**A-08 · No adoptar código de otros motores.** Las publicaciones de Decima/Nubis, la fuente UE5.1 y otros motores se usan como referencias de responsabilidades y técnicas, no como autorización de copia, redistribución o sublicencia.

## 3. Interfaces existentes y futuros contratos de datos

| Propietario | Entrada vigente | Estado vigente / salida | Restricción propuesta |
| --- | --- | --- | --- |
| `World.update(dt,{clock})` | `dt` y modo de reloj | `cur`, `_fade`, viento, `_cloudStep`, relámpagos | introducir noción explícita de tiempo meteorológico sin duplicar el avance |
| `World._cloudState()` | `cur`, humedad | `{coverage,density,humidity,storm,rain,altitude}` | conservar significado, aplicar mismo forzado a consultas/volumen |
| `CloudField.update(state,wind,dt)` | condiciones, vector, segundos | `f`, `windOff`, `evolution`, residentes | identidad espacial independiente de morfología categórica |
| `CloudField.evaluate(cx,cz,out)` | clave fuente y estado del campo | `base,y,radius,thick,condensate,maturity,dev,tau,elec,morph` | derivar estructura **continua**; preservar campos públicos |
| `CloudField.primitives(cell,list)` | geometría de celda | primitivas `{x,y,z,rx,ry,rz,str,type}` | transición por parámetros continuos; evitar cambio de topología abrupto |
| `bakeMethods.bake()` | residentes/primitivas | mapa 2D RGBA; fuentes 3D | una fuente de geometría común; no convertir tipo promedio en autoridad |
| `CloudVolume.rebuild(map,volumes)` | región, lista `{x,y,z,rx,ry,rz,str}` | `_core`, `_lift` y remuestreo | mantener interfaz inicial; no exigir buffers GPU adicionales |
| `CloudVolume.advance(dt,forcing,wind)` | paso, forzado y viento | `_water`, `_vapor`, `data` RG, `blend`, `version` | conservar dos estados y monotonicidad de publicación; pasos acotados |
| `Viewport._cellClouds` | `frame().clouds.map` | textura RGBA2D y RG 3D | mantener ownership/disposal; telemetría de uploads |
| `SKY_FRAG` | densidad interpolada + ruido + luz | volumen y efectos relacionados | detalle procedimental subordinado al volumen; comprobar compatibilidad |
| `captureWorld/restoreWorld` | estado de World y escena | snapshot CloudField y CloudVolume | reanudar transición bajo contrato verificable, sin migración arbitraria |

**No se añaden en G002 nuevas funciones o propiedades a esas APIs.** Sus futuras entradas derivadas deberán usar los objetos/argumentos vigentes cuando sea viable; cambios de forma/ABI quedan condicionados a Gate de implementación.

### 3.1 Parámetros estructurales continuos (diseño, no nuevas propiedades persistidas)

Para una fuente espacial `i`, derivar, a partir de variables existentes, un vector conceptual normalizado:

`S_i = (coverage_i, condensate_i, maturity_i, development_i, horizontalSpread_i, verticalGrowth_i, shear_i, precipitationPotential_i)`.

- Los primeros cuatro se obtienen de `CloudField.f`, `evaluate()` y el historial volumétrico existente.
- `horizontalSpread` y `verticalGrowth` serán funciones **continuas** de la humedad, desarrollo y estabilidad aproximada; no `switch (MORPH)` para reconstruir la forma.
- `shear` se derivará de viento/altura y de variaciones espaciales reproducibles; no introduce un viento meteorológico rival.
- `precipitationPotential` y electricidad conservan el control de Weather y la nube madre; las etiquetas pueden permanecer para compatibilidad de diagnóstico, pero no como disparador único de cambio de geometría.
- Las variaciones individuales utilizarán la clave mundial actual y coeficientes con continuidad; no un `Math.random()` nuevo en cada fotograma.

**Topología estable:** para evitar que el cambio de cantidad de elipsoides haga aparecer lobos súbitamente, usar posiciones/índices estables de primitivas dentro del límite `MAX_PRIMS=8`, permitiendo que sus **pesos** cambien suavemente. No se aprueba aumentar `MAX_PRIMS` ni reemplazar su representación sin medición de coste.

## 4. Modelo matemático propuesto (aproximado, no CFD físico)

Cada celda volumétrica `p` mantiene condensado `C_p∈[0,1]` y vapor `V_p` no negativo, interpolables entre estados. Las fuentes `F_p` vienen de `CloudField` y su viento `U_p` deriva de World. La formulación es conceptual y discretizable reutilizando `CloudVolume._step`.

**M-01 · Transporte semilagrangiano:**

`C_adv(p) = sample(C_prev, p - U_p·Δt)`, `V_adv(p) = sample(V_prev, p - U_p·Δt)`.

Conservación de límites y muestreo trilineal/horizontal según el dominio; no se promueve la advección simplificada a solver conservativo exacto. El desarrollo vertical responde a `dev`, `storm`, humedad y `lift` derivados, con velocidad vertical acotada y sin saltos de capa por actualización.

**M-02 · Tendencia de formación:**

`Q_p = sat01(F_p · g(humidity, saturation(z), development))`;
`condense_p = k_c·max(0, Q_p - C_adv)`;
`evaporate_p = k_e·max(0, C_adv - Q_p)`.

`g` es función continua, acotada y meteorológicamente orientada. `k_c` y `k_e` son ganancias dependientes del `Δt` fijo, calibrables tras QA; **no representan ecuaciones microfísicas medidas**. No se establecen números nuevos en este Gate.

**M-03 · Actualización acotada:**

`C_next = clamp(C_adv + condense_p - evaporate_p, 0, 1)`.

`V_next` combina vapor advectado y aporte local; su actualización debe impedir NaN, valores negativos y oscilación por pasos repetidos. El actual `CloudVolume` ya sigue una mezcla dirigida a objetivo; las ecuaciones definen su **comportamiento requerido**, no una orden de reescribirlo literalmente.

**M-04 · Morfología emergente:**

`ρ(p) = C_next(p) · E(p,S_i) · D(p,seed,wind,time)`.

`E` es una envolvente espacial continua (bancos horizontales, torres, base irregular) y `D` erosión procedural fina **subordinada a C**. Las categorías `MORPH` no crean por sí mismas un segundo volumen ni sustituyen súbitamente `E` al cruzar umbrales. El shader no calcula de nuevo clima. Un mismo estado ambiental puede albergar varias formaciones con distinta clave y madurez.

**M-05 · Mezcla/solapamiento:** regiones vecinas aportan fuentes al mismo campo `F_p`; la fusión se expresa como continuidad de `C`, no como reemplazo de objetos A+B por C. Mantener saturación y transparencia de forma que la unión no explote la densidad óptica.

**M-06 · Iluminación y precipitación:** atenuación `T≈exp(-τ)` derivada del condensado/columna trazada; fuente de lluvia vinculada a humedad, estado meteorológico y condensado de la región. No declarar equivalencia física perfecta entre la aproximación CPU y el raymarch GPU hasta validar diferencias toleradas.

**Nota de estabilidad:** las ganancias `k_c,k_e`, el dominio del paso fijo y la cota de subpasos se fijarán con experimentación y criterios de estabilidad; G002 no adopta una fórmula cerrada ni un coste por vóxel definitivo sin ese contraste.

## 5. Orden de actualización y relojes

**T-01.** Mundo/entrada de simulación determina si se puede avanzar: `Edit` = 0 s meteorológicos; `Play/Runtime` = avance si no está pausado.

**T-02.** `World` evalúa la progresión del Weather Director y la transición `_fade` en un **reloj meteorológico explícito** `Δt_weather`, reconciliado con `weatherScale`, `followClock` y APIs `game.weather`/`game.clock`.

**T-03.** Con el mismo forzado, actualizar viento y condiciones del campo con pasos acotados. El estado de agua/vapor avanza mediante `CloudVolume.advance` con paso fijo, no por fotograma de dibujo.

**T-04.** `CloudField.maintain` prepara residentes, hornea solo cuando cambia firma/región y publica el volumen. Evitar que una subida de textura GPU use parcialmente dos versiones temporales distintas.

**T-05.** Recalcular/filtrar consultas de cobertura, lluvia y transmisión usando estados con una marca temporal común; las cadencias distintas de consumidores pueden mantenerse si se certifica error y latencia aceptables.

**T-06.** `World.frame()` suministra información coherente a Viewport/FX y Player. `uTime` puede animar microdetalle, pero **no avanzar el condensado por sí mismo**; pausa congela la evolución meteorológica y el detalle relacionado.

**T-07.** El paso fijo no debe perder silenciosamente tiempo acumulado ni generar una espiral de actualización. La política de acumulación/salto limitado debe definirse y probarse bajo frames de larga duración, pausar y retomar; **no se elige todavía un nuevo valor de paso**. El actual usa `PHYS_STEP=0.125 s` en residentes y `STEP=0.5 s` en volumen.

**T-08.** `Weather Director` hoy usa `simDt`, mientras `_fade`, `_cloudStep` y parte de los efectos usan `dt`: el cambio de escala meteorológica es una dependencia explícita. Cualquier nueva equivalencia temporal requiere pruebas de `weatherScale != 1`, `followClock`, pausa y transición abrupta.

## 6. Continuidad espacial y residencia

**R-01 · Identidad global:** conservar clave mundial `(seed, sourceChunkX, sourceChunkZ)` y deriva acumulada `windOff`. Una celda residente es caché temporal; no es un objeto permanente de mundo.

**R-02 · Recentrado con solapamiento:** preservar `_recenter()` y muestras anteriores; verificar errores máximos, inyección de nuevos límites y ausencia de contaminación de estados. No regenerar todo cuando el volumen solapa la región anterior.

**R-03 · Recentrado sin solapamiento:** antes de publicar una nueva región, derivar una ocupación inicial **reconstruida a partir de condiciones espaciales deterministas actuales**. El mecanismo exacto de preacondicionamiento (warm-start de densidad, reconstrucción evaluada o mezcla acotada) queda **candidato condicionado**: necesita QA GPU de aparición y coste. No reproducir todo el pasado atmosférico ni almacenar el mundo entero.

**R-04 · Cámara rápida/teletransporte:** no transportar nubes del origen al destino ni introducir un vacío artificial por reset. Registrar comportamiento de primer frame, 0,5 s, 1 s, varios segundos; valorar continuidad de luz, lluvia y cielo, no solo un vóxel.

**R-05 · Semilla efectiva:** `cloudSeed=0` en código significa semilla aleatoria por sesión. Una reconstrucción repetible requiere conservar la semilla **efectiva**; no prometer mismo cielo entre partidas independientes con semilla cero.

**R-06 · Presupuesto:** caché de regiones distantes no obligatoria. Si se considera, debe demostrar necesidad visual y límite de memoria con N5030/4GB.

**R-07 · Persistencia:** usar snapshot existente de `CloudVolume` (`bounds`, `pending`, `blend`, `water` codificada) y CloudField (`seed`, `windOff`, `evolution`) como base. Para continuidad de `_fade` y Director, definir y validar **estado temporal mínimo** (origen, destino, duración, avance, semilla/PRNG cuando corresponda) sin almacenar el historial completo. **Recuperación visual coherente** y **reproducción bit a bit** son garantías distintas; esta última NO se promete.

**R-08 · Mutación segura:** lectura/validación completa del snapshot antes de aplicar estado; preservar archivos/partidas reales y no exigir migraciones por defecto pre-1.0. Las incompatibilidades contractuales se resuelven explícitamente.

## 7. GPU y calidad por perfiles

**G-01 · Ruta inicial:** conservar `Data3DTexture` `RGFormat` con dos densidades temporales RG8 y los uniforms `uCVolume`, `uCVolumeOrigin`, `uCVolumeBlend`, `uCMap`, `uCAtm`, `uTime` existentes. La representación más expresiva debe llegar primero por densidad/estructura de las fuentes de simulación, **sin nuevo canal obligatorio**.

**G-02 · Formatos alternativos:** añadir atributos estructurales/textura/atlas solo si A/B demuestra que la ruta inicial no distingue suficientemente cirros, estratos y convección con coste aceptable. Necesita autorización técnica separada dentro del Gate integral de implementación y comparativa en los tres perfiles.

**G-03 · Integración visual:** el shader `simulatedCloudDensity` combina condensado y ruido Perlin-Worley. No borrar la profundidad histórica ni crear otra capa de clouds. La dispersión, iluminación lunar/solar, niebla, tornado madre y lluvia siguen consumidores del mismo World.

**G-04 · Oclusión:** la integración de nubes con geometría opaca y efectos de profundidad está expresamente **NO VERIFICADA** en el Amendment de Weather/Tornado. La nueva apariencia no puede darse por aceptada con un cielo de fondo que atraviese terreno o mallas. Si el pipeline obliga a otra estrategia de composición, deberá auditarse y ratificarse; no se presupone un renderer adicional.

**G-05 · Escalabilidad:** `uCloudSteps` usa perfiles 24/36/56 actualmente, sin promesa de FPS. Medir simulación CPU p50/p95, tiempos de bake, `Data3DTexture.needsUpdate`, memoria total/VRAM aproximada, GPU frame, shader compile/link, jank y estabilidad después de cambio de escena en Compatibility, Mobile, Forward+.

**G-06 · Baseline de memoria:** volumen 80×80×16 = 102.400 voxels; RG8 publicado ~204.800 bytes **solo de la textura de densidad sin overhead de GPU**. Los arrays float y texturas adicionales también cuentan. No confundir ese dato con memoria total del renderizador.

**G-07 · Paridad:** Electron/Editor fixture WebGL2 PASS 12/12 en G001; Player/NGM Runtime y otros backends **NO VERIFICADOS**. No se declara paridad por compartir archivos fuente.

## 8. Contrato de Edit Mode y UX

**E-01.** Edit Mode muestra cielo derivado del World configurado sin evolución automática por tiempo. Cambios de Inspector actualizan su imagen estática y la distribución derivada correspondiente.

**E-02.** `liveFx` actual controla, además de Weather, efectos de precipitación, naturaleza, animación de ruido y otras previsualizaciones. **No desactivarlo globalmente** para cumplir E-01; separar el permiso de avance meteorológico de los permisos de previsualización independientes.

**E-03.** PlayMode/Runtime ejecutan evolución; Stop revierte estado autoral sin contaminar el proyecto; pausa no acelera meteorología ocultamente.

**E-04.** El usuario configura condiciones de clima y variabilidad, no cada forma nubosa. Reducir selector manual de formas/presets duplicados **solo tras auditar todos los consumidores** y ratificar la sustitución contractual; proteger proyectos actuales aunque sean pre-1.0. No crear migración de versiones inexistentes.

**E-05.** `params.js` define ahora `cloudModel: 'classic'` por defecto y `CLOUD_MODELS = classic/cells`, y `game.weather.cloudModel` expone esta elección. Consolidarla como única experiencia meteorológica exige una decisión de contrato/Amendment **antes** de cambiar persistencia y Game API. En G002 NO se elimina.

## 9. Matriz de integración y obligaciones

| ID | Consumidor / módulo | Contrato que no puede perderse | QA mínimo futuro |
| --- | --- | --- | --- |
| I-01 | `World._cloudStep`, `frame()` | un solo reloj/forzado | transición + escala de tiempo, Play/Player |
| I-02 | `cloudfield-query.effectivePrecipitationAt` | lluvia local bajo nube, huellas de caída | unión, disipación, movimiento |
| I-03 | `lightningOrigin`, `World._cellOrigin` | cumulonimbo apto; semilla/evento único | tormenta sin rayos espurios; rayo cerca de nube |
| I-04 | `physicalState`, `opticalDepthAlongRay` | cobertura y transmisión física | comparativa CPU/GPU al sol y la luna |
| I-05 | `tornadoVisualState`, `SKY_FRAG` | World controla fases; embudo sin renderer duplicado | nube madre/embudo, apagado/PlayStop |
| I-06 | `viewport-env`, `viewport` | textura/IBL/fog, disposal, `uTime` | WebGL2, oclusión, fuga de recursos |
| I-07 | `scene-graph`, `scene/environment` | Editor estable con FX autorales preservados | Edit/Play/Stop con `liveFx` |
| I-08 | `play-saves`, `World.restoreCloudField` | semilla efectiva, volumen, transición | reload durante `_fade`, escena y teletransporte |
| I-09 | `world/api`, `game-api.d.ts` | API `game.weather` existente | scripts, autocomplete, Runtime |
| I-10 | Rendering presets | calidad y recursos coherentes | Compatibility/Mobile/Forward+ |
| I-11 | Terreno, niebla, reflejos, agua y VFX | no pintar nubes delante de sólidos erróneamente | casos de cámara suelo/altura/atravesando |
| I-12 | Weather Director, WindField/Jolt | autoridad y fuerzas sin duplicados | viento de nubes vs vegetación/agua/FPS |

## 10. Comparación de motores: principios adoptables, no implementaciones

- **Decima/Nubis:** continuidad de estructuras, mapas meteorológicos, variación procedural y evolución. Referencias publicadas: https://www.guerrilla-games.com/read/nubis-authoring-real-time-volumetric-cloudscapes-with-the-decima-engine ; https://www.guerrilla-games.com/read/nubis-evolved ; https://www.guerrilla-games.com/read/nubis-cubed . No afirmar CFD integral de toda nube del cielo.
- **Unreal Engine 5.1:** código privado del usuario `yohanger/UnrealEngine`, rama `release`, `Engine/Build/Build.version` 5.1.0; se auditaron `VolumetricCloudComponent`, `VolumetricCloudRendering`, `VolumetricCloud.usf`, `VolumetricRenderTarget`, `SkyAtmosphereRendering`. Enseña separación del material, atmósfera, sombras/oclusiones y render volumétrico. Requiere respetar la EULA de Epic: **no copiar fragmentos a LevelForge**.
- **CRYENGINE:** entorno exterior, viento, ruido, calidad volumétrica. No se ha inspeccionado repositorio fuente completo en este Gate.
- **Flax:** `yohanger/FlaxEngine` `Sky.h/Sky.cpp/VolumetricFog.shader`; niebla volumétrica e historial temporal **no equivalen** a motor nuboso dinámico. Licencia EULA.
- **Godot / O3DE:** técnicas de cielo, atmósfera y modularidad, no prueba de equivalencia Nubis.

La evaluación de licencias es de alcance técnico, no asesoría jurídica. La arquitectura debe ser original de LevelForge.

## 11. Runners, criterios de aceptación e integración

**QA-01.** Mantener `scripts/test-cloud-evolution-integral-validation-g001.mjs`, `scripts/test-cloud-evolution-electron-g001.mjs` y `scripts/fixtures/weather/cloud-convection.html` como base de extensión; no crear laboratorio alternativo.

**QA-02.** Tests deterministas de nubes: la misma clave/semilla y forzado producen mismo patrón espacial (con tolerancia cuantificada); el tipo cambia sin discontinuidad de densidad morfológica.

**QA-03.** Transiciones representativas: despejado→parcial, parcial→cubierto, parcial→tormenta, tormenta→despejado, `abruptChance`, variación de viento y `weatherScale != 1`.

**QA-04.** Continuidad espacial: solapamiento, salto de 20 km, retorno, giro/cámara rápida y cero de semilla; medir primera imagen pos-salto, 0,5 s, 1 s, 5 s, recuperación de sombra y precipitación.

**QA-05.** Persistencia: guardar/cargar con `_fade` a 25/50/75 %, comparar continuidad perceptual y estados de precipitación/luz con corrida de referencia; hacer explícita la precisión de cuantización RG8.

**QA-06.** Edit Mode: no crece condensado durante reposo ni con `liveFx`; lluvia/hojas/agua/luces siguen su preview autorizada; Play/Stop revierte estado editor. Verificar que no se modifica el proyecto.

**QA-07.** WebGL2: compilar shader, captar frames y diferencias por píxel, nubes desde suelo/aire, geometría delante/detrás, sombra/sol y niebla. Sin shader GPU PASS no hay QA visual PASS.

**QA-08.** Rendimiento: p50/p95 frame CPU y GPU si posible, residencia, uploads, memoria y FPS de escenarios equivalentes por perfil; no confundir benchmark sintético con FPS del Editor o Player.

**QA-09.** Regresiones existentes: CloudField 103, atmósfera 31, calibración 16, G001 9, Electron G001 12 checks; conservar fallos históricos de tornado como histórico y atribuir cualquier fallo nuevo por comparación A/B.

**QA-10.** Criterio integral de cierre: IMPLEMENTADO ≠ TEST PASS ≠ COMPILADO ≠ QA LOCAL PASS ≠ APROBADO ≠ CERRADO. Exigir evidencias por consumidor, Editor, PlayMode, Player/Runtime y paridad gráfica; integración de Sprint solo después de aceptación real.

**Pruebas nuevas previstas para el futuro:** deben extender fixtures/runners actuales; el detalle de escenarios, invariantes y parámetros de tolerancia cuantitativa se definirá a partir del perfilado, no como número inventado en G002.

## 12. Matriz de decisiones, alternativas y bloqueos

| ID | Propuesta recomendada | Alternativa descartada/condicionada | Estado |
| --- | --- | --- | --- |
| D01 | Integrar evolución en `CloudField` + `CloudVolume` | simulador meteorológico paralelo | propuesta de diseño |
| D02 | Descriptores continuos derivados; `MORPH` solo etiqueta/consulta | transición de plantilla por enum | propuesta de diseño |
| D03 | Reutilizar densidad RG8 de dos estados | nuevos canales/materiales por defecto | **CONDICIONADA A A/B GPU** |
| D04 | Reconstrucción determinista al salto lejano | almacenar toda la atmósfera del mundo | **CONDICIONADA A QA** |
| D05 | Un reloj meteorológico definido con paso fijo | `uTime` como fuente de formación | propuesta, contrato temporal por ratificar |
| D06 | Edit Mode fijo y preview FX independiente | desactivar `liveFx` globalmente | **CONFLICTO CONTRACTUAL** |
| D07 | UX orientada a clima, preservar campos hasta auditoría | quitar `cloudModel`/API de inmediato | **AMENDMENT REQUERIDO** |
| D08 | Continuación de snapshot existente + mínimo estado de transición | historial completo / migraciones preventivas | pendiente de especificación QA |
| D09 | Un único Sky renderer, integración de Depth condicionada | segunda ruta nubosa | no justificada |
| D10 | Presupuestos calculados por evidencia de hardware | promesa de 60 FPS sin medición | pendiente de QA |

### 12.1 Bloqueo de autoridad no resuelto

El archivo **`LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001`**, referido como ratificado en la continuidad conversacional, **no aparece como contrato íntegro** bajo `docs/architecture` en el SOURCE_BASELINE G001 auditado. No se altera su estado ni se recrea su texto. Mientras no se coteje la versión aprobada, **BLOQUEADA la ratificación final de cláusulas de supersesión** que pudieran afectarlo. El texto presente `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md` sí se cotejó y permanece vinculante en lo compatible.

**BLOQUEO de implementación:** no hay decisión aprobada de retirar `classic/cells`, de cambiar Game API/serialización ni de desactivar la simulación editorial. El documento complementario de Amendment está expresamente **BORRADOR PENDIENTE**.

## 13. Estado y salida documental

- **DOCUMENTADO:** relaciones, modelo de evolución, firmas existentes, variantes GPU, tiempos, residencia, persistencia, paridad, UX, QA y trazabilidad.
- **NO IMPLEMENTADO:** algoritmo productivo, shaders, filtros, formatos de proyecto y migraciones.
- **NO VERIFICADO:** continuidad morfológica visual del algoritmo futuro, calidad/compatibilidad de propuestas, rendimiento GPU, Player exportado, composición con geometría.
- **NO RATIFICADO:** este diseño y cualquier Amendment asociado; la autorización de G002 permite redactar, no ratifica automáticamente.
- **SIGUIENTE ACCIÓN:** revisión contractual del usuario, recuperación del Amendment ausente, ratificación de conflictos y futura declaración de Gate de implementación con alcance integral y criterios QA acreditables.
