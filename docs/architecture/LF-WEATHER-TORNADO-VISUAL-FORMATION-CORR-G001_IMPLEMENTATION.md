# LF-WEATHER-TORNADO-VISUAL-FORMATION-CORR-G001 — Implementación

**Estado:** IMPLEMENTADO; pruebas Node de integración PASS; compilación Vite, Chromium WebGL y QA visual Editor/Player NO VERIFICADOS; Gate NO CERRADO.

**Baseline:** `LevelForge_VFX_INSPECTOR_UX_CORR_G001_SOURCE_BASELINE.zip`. **Autoridad:** autorización literal del usuario para este Gate; `LF-WEATHER-TORNADO-LIFECYCLE-CA-001`, `LF-VFX-WEATHER-DECOUPLING-CA-001`, S12/S12A y VFX existentes. No se ha modificado el esquema `.vfx`, el modelo físico Jolt ni el guardado del tornado.

## Observado en la base S02

- `createWeatherVfx3D` emitía en caja y solo durante fases con intensidad mayor que 0,5; `development` y `organization` no tenían representación visual. La altura de la caja no se relacionaba con la base nubosa.
- `VfxBillboardRenderer` declaraba sampler `uMap` nulo cuando no se asignaba textura y lo seleccionaba mediante una expresión condicional de shader. El color negro específico reportado por el usuario requiere reproducción GPU real para confirmar su causa.
- World ya calcula fases, posiciones, intensidades, viento, transición de presets y altitud de nubes; Jolt, scripting y Player ya consumen World.

## Cambios realizados

1. `world/tornado-visual.js`: modelo **solo visual** que deriva alcance de condensación, anchura de embudo y opacidad de `World.tornado.phase`, `phaseAge` y altitud de nube `w.cur.altitude`. La altura física de `tornado.height` no se altera. Los tiempos se leen del `cfg.weather` existente. Desarrollo/organización muestran señales en la base nubosa, formación desciende progresivamente; al madurar el embudo puede alcanzar proximidad del suelo y generar polvo visual; en debilitamiento/dissipación se estrecha y pierde opacidad. No se simula CFD ni se garantiza que la condensación coincida con circulación física.
2. `nodes/vfx.js`: el emisor transitorio sigue utilizando **un** `VfxSimulation` y **un** `VfxBillboardRenderer`, sin modificar Assets. La instancia selecciona posiciones procedurales según el perfil meteorológico, reutiliza `World.tornadoWindAt` para la influencia de movimiento y conserva su ciclo de vida. Partículas limitadas a 896 por emisor automático. La sombra, colisiones y agua siguen en sus sistemas existentes.
3. `vfx/simulation.js`: callback opcional `spawnAt` sobre la instancia de runtime, después de transformar la posición de nacimiento, sin crear campos meteorológicos en recursos persistidos. Ausencia de callback = comportamiento anterior.
4. `vfx/render.js`: la ruta de shader sin textura se compila sin muestreo de sampler y aplica máscara radial suave. La ruta de textura se activa con `VFX_HAS_MAP`, recompilando material solo al cambiar presencia de mapa. Opciones de tamaño/opacidad por instancia, sin modificar las curvas de `.vfx`.
5. `events/play-tornado.js`: se vacía el pool meteorológico temporal al comenzar otro episodio, evitando reutilizar partículas antiguas.
6. Se actualizaron pruebas/harness de VFX y se incorporó harness Chromium con escena meteorológica real. La prueba Node del nodo anterior tenía un reemplazo de exports incompleto; se ajustó el harness, no el runtime.

## Alcance y límites

- CloudField mantiene su render, mapa y autoridad propios. El visual de Weather se ancla a la **altitud atmosférica** disponible en World; no deforma volúmenes individuales de CloudField. Si se exige unión volumétrica con una celda concreta, hará falta un alcance y QA explícitos adicionales, no fingir esa conexión.
- El perfil representa un caso supercelular simplificado: NOAA/NWS indica que la circulación, la condensación visible y el polvo terrestre no siempre surgen en el mismo orden. Las duraciones son editoriales, no pronósticos reales.
- El **origen exacto del quad negro en GPU del usuario no está demostrado**: se retira una condición de riesgo (sampler nulo) y se incorpora prueba WebGL que debe ejecutarse localmente. No se declara FIXED sin captura y GPU PASS.
- Jolt WASM real, física de interacción y Player **NO VERIFICADOS**; S13 permanece bloqueado.

## Fuentes meteorológicas

- https://www.nssl.noaa.gov/education/svrwx101/tornadoes/
- https://www.weather.gov/spotterguide/tor_life
- https://www.noaa.gov/jetstream/thunderstorms/thunderstorm-hazards-tornadoes

La evidencia requerida y órdenes de prueba constan en `docs/qa/LF-WEATHER-TORNADO-VISUAL-FORMATION-CORR-G001_QA.md`.
