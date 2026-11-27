# QA local — LF-WEATHER-UNIFICATION-S02-G001

**Estado:** IMPLEMENTADO · Node PASS · QA visual/Compatibility/Player/WebGL NO VERIFICADO · NO CERRADO.

## Instalación

El CHANGE está hecho contra `LevelForge_WEATHER_UNIFICATION_S01_G001_SOURCE_BASELINE.zip`. Compara primero los archivos locales con esa base: no sobrescribas modificaciones no inspeccionadas. Extrae CHANGE en la raíz junto a `package.json` respetando sus rutas. No borres escenas, Assets ni `node_modules`. El nuevo SOURCE_BASELINE completo debe conservarse aparte como base del siguiente Gate; nunca se superpone sin comparación.

## Pruebas automatizadas (desde la raíz)

```
npm ci
node --test scripts/test-weather-unification-s02-g001.mjs
node --test scripts/test-weather-tornado-world-s12-g001.mjs scripts/test-weather-tornado-transitions-s02-g001.mjs scripts/test-weather-tornado-destructive-s12a-g001.mjs scripts/test-weather-unification-s01-g001.mjs
LF_VFX_BROWSER="$(command -v chromium)" node --test scripts/test-weather-tornado-visual-cohesion-webgl-corr-g001.mjs scripts/test-weather-tornado-visual-webgl-corr-g001.mjs
npm run build
npm run electron
```

Resultados de referencia de S02: **12/12 pruebas nuevas Node PASS** y **349/349** en la regresión de 19 suites ejecutables en el entorno de implementación (excluye el test histórico de `jszip` sin instalar). La prueba Chromium, compilación y QA Editor/Player permanecen sin evidencia de ejecución en ese entorno.

## Comprobación visual Editor, Play y Player

1. Reproducir escena mínima con cámara fija y `Tiempo = Tormenta`, `Permitir tornados = false`. Comprobar que no se forma embudo. **Registrar por separado si sigue apareciendo el rectángulo negro general de tormenta.**
2. Permitir tornado, modo scripting. Iniciar la formación con la API meteorológica existente; grabar el desarrollo, organización, formación, actividad, debilitamiento y disipación sin cambiar de cámara.
3. Verificar que la nube madre y la condensación inferior compartan textura, dirección, tono e iluminación. Girar cámara, acercarse al terreno y cruzar objetos opacos para comprobar profundidad/oclusión; informar si el embudo aparece solo en cielo o incorrectamente detrás de objetos.
4. Repetir con CloudField clásico y por celdas. Comprobar que la base de nube usada sea la del campo real y que la altura física del tornado permanezca independiente de la visual.
5. Guardar un proyecto que contenga la propiedad heredada `tornadoVfxNodeId`; verificar migración, ausencia del campo nuevo, preservación del nodo y del recurso `.vfx` de usuario, sin moverlo ni usarlo para el embudo.
6. Repetir Play/Stop y guardado/restauración en formación, actividad y disipación. La nube no debe quedar en el cielo cuando no hay tornado.
7. Verificar lluvias, rayos, VFX genéricos y agua/fuego; estos últimos conservan sus vínculos VFX opcionales.
8. Repetir la prueba en Player. Ejecutar en Compatibility y registrar FPS promedio, mínimo y RAM frente al SOURCE_BASELINE S01 con idéntica escena, cámara y resolución.

## Evidencia que debe devolver el usuario

Salida completa de tests, Chromium y `npm run build`; vídeo/capturas de las seis fases, diferencias de Classic/Cells, Play/Stop, estado del nodo VFX heredado y medición de FPS. **Compilar no equivale a QA visual**. Si el shader no compila o la oclusión falla, devolver la consola exacta y el fotograma.

## Incidencias fuera del Gate

El artefacto negro general de Tormenta tiene Gate separado y sigue abierto. Jolt WASM real sigue NO VERIFICADO; S13 permanece BLOQUEADO.
