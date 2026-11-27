# LF-WEATHER-TORNADO-VISUAL-COHESION-CORR-G001 — Implementación

**Estado:** IMPLEMENTADO · TEST NODE PASS · WEBGL/COMPILACIÓN/EDITOR/PLAYER NO VERIFICADOS · GATE NO CERRADO.

## Autoridad y base

- Autorización literal: `Listo. LF-WEATHER-TORNADO-VISUAL-COHESION-CORR-G001 autoriza comenzar`.
- SOURCE_BASELINE: `LevelForge_WEATHER_TORNADO_BLACK_QUAD_CORR_G001_SOURCE_BASELINE.zip` (1.262 archivos).
- Padres vinculantes: LF-WEATHER-TORNADO-LIFECYCLE-CA-001, LF-VFX-WEATHER-DECOUPLING-CA-001, S12/S12A, Weather S02, visual formation y Black Quad; VFX3D y Sky existentes.
- Referencia del usuario: `videoplayback(1).mp4` (fotogramas 00:30–01:00). Se aprecia la base masiva de la tormenta, un embudo visualmente continuo y una misma familia tonal; no constituye una medición de tiempos o fuerzas.

## Problema auditado (OBSERVADO)

- `World.tornado` ya gobierna fases, posición, intensidad y física.
- `VfxBillboardRenderer` generaba el embudo con el emisor temporal de `nodes/vfx.js` y color fijo `#b7bdc5`.
- Las nubes usaban el shader `SKY_FRAG` y `CloudField` (o su modo clásico); la zona donde nace el embudo no recibía una señal localizada desde `World.tornado`. Por eso ambos se actualizaban desde Weather, pero no formaban una masa visual común.
- La textura meteorológica Black Quad era un disco circular suave que podía percibirse como esferas aisladas al repetirse.

## Intervención

1. **Una sola autoridad:** `World.frame()` expone referencias de solo lectura a `tornado` y a la configuración meteorológica, sin crear otro estado físico. `Viewport.setWorld` deriva la misma opacidad/fase usando `tornadoVisualState`. Cuando Weather se apaga, el enlace se pone a cero.
2. **Base nubosa integrada:** `SKY_FRAG.cloudDensity` añade `tornadoCloudRoot()` únicamente alrededor del vórtice meteorológico y en la franja inferior de la capa de nubes. Se evalúa dentro del raymarch/iluminación existentes, usando la misma textura 3D, la misma luz, el mismo tinte y los mismos pasos. La modulación de borde es orgánica, giratoria y gradual. No hay una segunda esfera, plano ni sistema de nubes.
3. **Coordenadas sin desacople:** `Viewport` actualiza `uCamXZ` cada fotograma; `uTornadoCloud.xy` permanece en XZ de mundo. El shader transforma sus muestras relativas a cámara para alinearlas con el emisor meteorológico al mover cámara o tornado.
4. **Paleta meteorológica:** el VFX temporal usa color base blanco y obtiene cada tick `World.cur.tint`. La cota de formación utiliza el mismo `CloudField.map.slabBase` que el cielo en modo por celdas (y la altitud del preset en el modo clásico). Convierte sRGB a lineal y usa un `visualTint` exclusivo de instancia en `VfxBillboardRenderer.sync`, sin cambiar el esquema `.vfx` ni las curvas de recursos compartidos.
5. **Filamentos en lugar de discos:** la textura RGBA procedural temporal cambia la máscara circular por hebras erosionadas y alargadas; sus límites siguen transparentes. Conserva máximo 896 partículas, un único VFX3D y liberación de textura al salir de Play.
6. **IBL:** durante el horneado del ambiente se desactiva temporalmente la influencia localizada del tornado, sin modificar la iluminación global persistida.

## Rendimiento y límites

- No se añade ningún pase, sample de textura, objeto de nube independiente ni resolución de grid; la función de condensación hace early-return fuera de la zona localizada. La evaluación efectiva usa instrucciones extra solo donde hay circulación meteorológica.
- Es **continuidad visual** entre el raymarch del cielo y el VFX temporal, no simulación CFD ni un campo volumétrico físico unificado. No se puede afirmar que el comportamiento sea idéntico a un tornado real.
- En modo CloudField por celdas se conserva la autoridad de las celdas existentes. La señal meteorológica local añade condensación cerca de la base aunque una columna contenga poco volumen visible, sin alterar persistentemente el mapa.
- No se altera `tornado.height`, `tornadoWindAt`, Jolt, eventos, scripting, guardado/restauración ni la definición `.vfx`.
- El material no ha sido compilado en WebGL real en el entorno de entrega. **No** declarar cohesión visual PASS, ausencia de quad negro ni rendimiento verificado sin QA de Editor y Player.

## Evidencia técnica

- `node --test` (9 suites, incluyendo nueva suite VC-01–VC-08): **206 PASS / 0 FAIL / 0 SKIP**.
- Pruebas específicas VC-01–VC-08: **8 PASS**.
- `npm run build`: detenido antes de compilar con `vite: not found`.
- Harness WebGL existente y nuevo: no iniciables sin `node_modules/vite`.
- Scripts que dependen de `jszip` tampoco se ejecutaron en esta máquina; no se anotan como FAIL de ejecución funcional.
- Jolt WASM real: **NO VERIFICADO**; S13 permanece BLOQUEADO.

## Fuentes meteorológicas

- NOAA/NSSL: https://www.nssl.noaa.gov/education/svrwx101/tornadoes/
- NOAA JetStream: https://www.noaa.gov/jetstream/thunderstorms/thunderstorm-hazards-tornadoes
- NWS: https://www.weather.gov/spotterguide/tor_life
