# QA de usuario — LF-WEATHER-UNIFICATION-S01-G001

**No cerrar sin QA local y evidencia.** La aprobación del cambio de código no equivale a un PASS visual o de Jolt WASM.

## Instalación

1. Partir del SOURCE_BASELINE de `LF-WEATHER-TORNADO-VISUAL-COHESION-CORR-G001` con los cambios locales comparados.
2. Extraer únicamente `LevelForge_WEATHER_UNIFICATION_S01_G001_CHANGE.zip` en la raíz de LevelForge, donde está `package.json`, respetando rutas internas y reemplazando solo los archivos modificados.
3. Conservar el SOURCE_BASELINE de S01 en una carpeta/ZIP separado como siguiente base. No sobrescribir escenas, proyectos o Assets modificados localmente sin comparar.
4. No eliminar `node_modules`, configuraciones, escenas ni partidas.

## Pruebas automatizadas Linux

```bash
npm ci
node --test scripts/test-weather-unification-s01-g001.mjs
node --test scripts/test-weather-tornado-transitions-s02-g001.mjs scripts/test-weather-tornado-world-s12-g001.mjs scripts/test-weather-tornado-destructive-s12a-g001.mjs scripts/test-weather-tornado-visual-formation-corr-g001.mjs scripts/test-weather-tornado-visual-cohesion-corr-g001.mjs scripts/test-weather-tornado-black-quad-corr-g001.mjs scripts/test-weather-lightning-world-s11-g001.mjs scripts/test-liquid-rainflow-s07-g001.mjs scripts/test-liquid-rain-audio-s08-g001.mjs scripts/test-liquid-waterbody-coupling-s09-g001.mjs scripts/test-liquid-containers-s10-g001.mjs scripts/test-runtime-jolt-play-corr-g001.mjs scripts/test-weather-unification-s01-g001.mjs
npm run build
npm run electron
```

Referencia obtenida antes de instalar dependencias: **14 PASS** nuevos; **321 PASS** en regresión (13 suites). La compilación se detuvo en `vite: not found`. No inferir resultados de otras plataformas.

## QA Editor / Play

1. Con escena mínima Terreno + Sol + Spawn, registrar el viento ambiental en Despejado y Tormenta. Sin tornado debe conservar su comportamiento anterior.
2. Habilitar tornado en modo script, iniciar un episodio y observar la deriva de lluvia, nieve (si aplica), hojas y vegetación junto a la circulación física. La respuesta visual es una muestra local cerca de la cámara, no todavía un cálculo por árbol.
3. Comparar cuando la cámara sale del radio del vórtice; el efecto extra debe desaparecer. Repetir con un obstáculo de viento existente.
4. Comprobar Play/Stop y cambio de escena. Revisar que scripts que consultan `game.weather.windAt` conserven el comportamiento previo 2D.
5. Comprobar con viento bajo y con `weatherOn=false`; lluvia/vegetación deben mantener compatibilidad y no generar NaN.
6. Probar Editor y Player exportado. Registrar FPS de referencia en Compatibility desde la misma cámara; no basta con observar rendimiento sin compararlo.
7. No atribuir el rectángulo negro de tormenta a esta unificación: anotar por separado la incidencia `LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001`.
8. Si se valida física, ejecutar primero JW-04 aislado y después suite Jolt WASM real (12 PASS exigidos); tests de contrato no prueban colisiones nativas.

## Evidencia que debe volver

Salida de tests y build, capturas o vídeo de lluvia/vegetación dentro y fuera del radio de tornado, Play/Stop, estado de obstáculos, FPS comparativo y, si se ejecutó, resultados JW-04 + WASM completo. No cerrar S01 sin revisar estas evidencias y aprobación del usuario.
