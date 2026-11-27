# QA — S02 CORR-002, contorno geométrico oscuro

**Estado:** IMPLEMENTADO · NODE PASS (registro adjunto) · ELECTRON/GPU/QA VISUAL PENDIENTES · NO CERRADO.

**Prerrequisito:** aplicar el CHANGE únicamente sobre `LevelForge_WEATHER_TORNADO_NATURAL_S02_G001_CORR_001_QA_UPDATE_SOURCE_BASELINE.zip` o extraer el nuevo SOURCE_BASELINE CORR-002 en una carpeta independiente. No reemplazar proyecto `proyecto_8`, escenas, Assets ni `node_modules` existente sin comparación.

## Comandos (raíz de CORR-002)

```bash
npm ci
node --test scripts/test-weather-tornado-natural-s02-corr002.mjs
node --test scripts/test-weather-tornado-natural-electron-s02-corr002.mjs
node --test scripts/test-weather-tornado-natural-s02-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s02-g001.mjs
node --test scripts/test-weather-tornado-natural-electron-s01-g001.mjs
node --test scripts/test-weather-tornado-visual-cohesion-corr-g001.mjs
npm run build
npm run electron
```

`npm ci` solo es necesario si esa carpeta no conserva las dependencias instaladas. No usar Brave/Chromium externo para las fixtures.

**Esperado, NO certificado en la máquina del asistente:** 11 tests TC2 Node PASS; test CORR-002 Electron 1 PASS con al menos 25 verificaciones y marcador `TN2_CORR002_WEBGL` (incluida diferencia de píxeles **0** del cilindro vacío); test S02 Electron 1 PASS, S01 Electron 1 PASS; 16 TN2 Node y 8 VC Node PASS; compilación Vite Editor + Player sin errores bloqueantes.

## Validación visual del usuario

Repetir la escena `Probando` desde el encuadre original: tornado en X=0, Z=−250, radio 25 m, avance 0, tormenta al máximo, Play activo, cámara mirando hacia la columna. Captura inicial de referencia: `docs/qa/reference/LF_TORNADO_S02_CORR002_original_viewport.png`.

Observar alrededor de la columna, sobre todo los límites diagonales oscuros a izquierda y derecha. Repetir con cámara más arriba, más abajo y en movimiento lateral, durante formación, fase activa y disipación. El fondo nuboso y el horizonte **no** deben crear prismas oscuros que delimiten el cilindro de raymarch.

También verificar sin tornado, tormenta sin tornado, `classic`, `cells`, Play/Stop, lluvia, VFX3D genérico y ausencia de nuevos artefactos. Confirmar que el tornado sigue visible en desarrollo posterior y que no se ha reemplazado su condensación por un plano o emisor.

**Evidencia a devolver:** salida íntegra de Node, Electron y build; captura posterior desde el mismo ángulo y preferiblemente vídeo corto moviendo la cámara. Si el rectángulo permanece, indicar perfil gráfico, fase y consola. No confundir el PASS de la fixture con aceptación de la escena.

**Pendiente fuera del alcance de este correctivo:** QA de oclusión espacial frente a objetos sólidos y ejecución de Player independiente. S02 global continúa abierto hasta cubrir estos puntos y aprobación visual del usuario.
