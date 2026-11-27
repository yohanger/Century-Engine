# LF-WEATHER-LIGHTNING-WORLD-S11-G001 — Impactos de rayos sobre el mundo

**Autorizado:** `Listo. LF-WEATHER-LIGHTNING-WORLD-S11-G001 autoriza comenzar`.
**Fuente:** `LevelForge_LIQUID_CONTAINERS_S10_G001_SOURCE_BASELINE(1).zip` (ZIP adjunto por el usuario, 1.211 archivos, CRC PASS).
**Contratos padres:** WEATHER/AUDIO/VFX/JOLT, WATER, LF-WATER-LIQUID-CA-001/002/003, S05–S10.
**Estado:** IMPLEMENTADO · TEST NODE PASS · BUILD/QA EDITOR/PLAYER NO VERIFICADOS · NO CERRADO.

## Observado y causa raíz

- `World._startStrike` genera una descarga meteorológica con semilla e identidad, emite `lightning`, y reserva `thunder` para su retardo acústico.
- `LightningFX.build` reconstruía el canal por separado usando una posición de la cámara. No existía punto de contacto físico compartido con Play.
- Terrain y `scene/water.js` ya proporcionan clasificación de superficies y raycasts; `game.physics.explode` ya utiliza Jolt, y `addRipple` ofrece ondas exclusivamente visuales.
- La causa raíz era la separación entre la generación del canal gráfico y la identificación del impacto en el mundo, sin contrato entre ellas.

## Mecanismo implementado

1. `world/lightning.js` conserva `createStrike` y exporta `resolveWorldStrike` que invoca **ese mismo generador** una única vez con la semilla y el observador capturado. Su resultado `{bolt,impact}` incluye identificación, coordenadas mundiales, normal, superficie y material, si hay intersección compatible.
2. `world/world.js` prepara el canal al iniciarse cada descarga en modo físico **solo si** `lightningImpacts=true` y Play registra un contexto. El evento meteorológico añade el impacto ya resuelto sin modificar las rutas anteriores de sonido. No hay generación de un segundo canal de gameplay.
3. `world/lightning-fx.js` consume `strike.bolt` si existe y utiliza coordenadas mundiales sin la proyección de acercamiento a la cámara. En modo anterior continúa construyendo el canal heredado. El destino visual de un canal acoplado coincide con el evento del mismo ID.
4. `events/play-lightning.js` reutiliza `groundAtAll`, `scene/water.rainImpact` y `WaterWorld.at()` para priorizar la primera superficie de Terrain, objeto o agua. No genera ni altera volumen; no sustituye colisiones ni shaders existentes.
5. `events/play.js` instala el contexto de detección durante `_worldStart` y lo retira durante la salida de Play, evitando una suscripción independiente del render. Conserva `game.on('lightning')` y `game.on('thunder')`; emite **`game.on('lightningImpact')`** una vez cuando hay contacto válido.
6. Impactos físicos opcionales reutilizan `game.physics.explode` (Jolt) con radio máximo 30 m e intensidad máxima 15 m/s. El evento no supone daño, combustión ni un sistema de salud.
7. Impactos sobre agua opcionales reutilizan `addRipple` y no llaman a `WaterRegion.queue`, transferencias, hidrología ni generación de charcos. La respuesta es visual, no conducción eléctrica ni alteración del inventario.
8. `world/params.js` añade cinco controles opcionales en la sección existente de Clima: activar impactos, activar impulso, radio [m], fuerza [m/s] y respuesta del agua. Todos desactivados por defecto salvo los valores numéricos, que no tienen efecto sin opt-in.

## Preservación, limitaciones y seguridad

- Proyectos anteriores conservan modo `simple` o canal físico sin impactos cuando `lightningImpacts=false`, mismos eventos de trueno y retardo.
- El detector de geometría usa los objetos de escena compatibles ya admitidos por `rainImpact` (primitivas/mallas/carreteras/textos visibles). No garantiza colisión directa contra cada forma Jolt ni mallas arbitrarias, y el radio físico actúa solo sobre cuerpos registrados en el sistema existente.
- El contacto con agua usa la superficie en el XZ del extremo del canal, y la selección de candidatos prioriza la cota más alta. Este modelo es acotado, no una descarga eléctrica volumétrica, ni un trazador de todas las ramas del rayo.
- El render acoplado no acerca el canal a la cámara cuando excede la distancia de recorte. Un canal muy lejano puede no ser visible; **no se falsifica el impacto moviéndolo**.
- El evento de impacto no define daño, resistencia eléctrica, inflamabilidad o conductividad. Los scripts pueden implementar esos resultados mediante las APIs existentes, con su propio contrato.
- Determinismo físico limitado a misma semilla, estado meteorológico, observador y geometría congelada. En escenas que cambian de forma entre descargas, los resultados naturalmente cambian.
- La compilación Vite y el QA de Electron/Player no se ejecutaron aquí por dependencias ausentes. No atribuir PASS a runtime real.

## Evidencia

`npm run test:weather-lightning-world`: **392 tests declarados, 383 PASS, 0 FAIL, 9 SKIP**; casos nuevos S11 **36/36 PASS**. Incluye test histórico de rayos, truenos, audio, agua, S05–S10 y física. Revisión sintáctica de módulos modificados PASS.

Las pruebas de usuario se detallan en `docs/qa/LF-WEATHER-LIGHTNING-WORLD-S11-G001_QA.md`.
