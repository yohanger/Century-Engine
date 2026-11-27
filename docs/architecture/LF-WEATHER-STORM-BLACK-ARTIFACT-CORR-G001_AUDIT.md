# LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001 — Auditoría de activación

Estado: **DIAGNÓSTICO IMPLEMENTADO; CAUSA RAÍZ NO VERIFICADA; CORRECCIÓN PENDIENTE**.

## Base y autoridad

SOURCE_BASELINE de partida: `LevelForge_WEATHER_UNIFICATION_S04_G001_SOURCE_BASELINE.zip`.
Gate `LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001`, autorizado previamente.
No se ha alterado el motor gráfico, World, Jolt ni el sistema de recursos del usuario.

## Observaciones del código

- `render/viewport.js`: crea una única instancia `PrecipFX` y una `LightningFX` al iniciar el viewport; la esfera del cielo también existe desde ese momento.
- `world/fx.js`: construye `rain`, `mist`, `snow` y `splash` una sola vez y los añade a la escena con `visible = false`.
- `PrecipFX.update`: al superar `rainScale > 0.01` **reactiva simultáneamente** `rain` y `mist`. Activa salpicaduras solamente mientras haya impactos visibles; nieve usa otra ruta.
- `render/viewport-env.js`: cambiar el clima actualiza uniforms de cielo, nubes, iluminación y niebla; activar nubes puede asignar texturas 3D. No significa crear una segunda esfera de cielo.
- `world/lightning-fx.js`: la geometría visible del rayo solo aparece con descargas y su modelo físico, no con llovizna.
- `world/weather.js`: los presets `drizzle`, `rain` y `storm` tienen lluvia distinta de cero. `clear`, `partly`, `cloudy` y `overcast` no tienen lluvia.
- El usuario observó el artefacto con `tornadoEnabled=false` y en el Editor. No debe atribuirse automáticamente al tornado.

## Hipótesis a contrastar, no causas raíz

H1: transición `visible=false → true` en `rain` o `mist`, o en una salpicadura.
H2: cambio de material, orden de render o profundidad al dibujar precipitación frente a la escena.
H3: paso de cielo/nubes/niebla o material de geometría persistente afectado por el entorno.

## Medio de aislamiento

`scripts/fixtures/weather/storm-activation.html` usa `Viewport` y `World` reales, sin segundo sistema atmosférico. Mantiene cámara, suelo y objeto de contraste; desactiva tornados, director y rayos. Registra once condiciones: seis presets y cinco aislamientos de visibilidad.

El runner `scripts/test-weather-storm-activation-electron-g001.mjs` usa el Electron instalado dentro del proyecto y el servidor Vite del harness S03. Produce `LF_WEATHER_ACTIVATION_AUDIT` con identidad, visibilidad, número de instancias, estado de niebla y nubes, draw calls, recuento de píxeles oscuros y códigos GPU. Con `LF_QA_CAPTURE_DIR` genera mosaico PNG.

Una escena de contraste **no sustituye** la reproducción en el proyecto original. Si las once imágenes no reproducen el rectángulo, habrá que aislar la escena real (material del Spawn, terreno, pases y otros objetos) con evidencia antes de decidir cambios.

## Criterio de continuación

Identificar inequívocamente el objeto, material, shader o pase responsable, idealmente reproduciendo el rectángulo y haciéndolo desaparecer al aislar solo ese componente. No borrar ni desactivar permanentemente lluvia o nubes como solución. La implementación correctiva quedará dentro de este Gate cuando exista causa raíz demostrada.
