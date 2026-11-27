# QA local — LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001

## Preparación

SOURCE_BASELINE inicial: `LevelForge_VFX_RENDERER_CONSOLIDATION_AUDIT_S00_G001_SOURCE_BASELINE.zip`. Aplicar CHANGE solo sobre esa base, después de comparar los cambios locales, o extraer el SOURCE_BASELINE nuevo en una carpeta separada. No tocar carpetas de proyectos, escenas, Assets, `node_modules` ni datos del usuario.

Electron debe utilizarse desde el proyecto (`npm ci` cuando se trate de una carpeta limpia); no requiere Chromium o Brave externos.

## Desde la raíz de LevelForge

```bash
node --test scripts/test-weather-storm-black-artifact-corr-g001.mjs
node --test scripts/test-weather-storm-black-artifact-electron-corr-g001.mjs
node --test scripts/test-weather-storm-activation-electron-g001.mjs
node --test scripts/test-vfx-black-artifact-electron-g001.mjs
npm run build
npm run electron
```

El primer comando **debe obtener 12 PASS**; el resultado medido en el entorno de preparación fue 12 PASS. El segundo debe devolver 1 PASS con al menos doce comprobaciones GPU, así como `LF_PRECIP_GTAO_CORR_AUDIT` con píxeles `unfiltered` y `corrected`. El tercer comando registra las once situaciones meteorológicas (presets y aislamientos); el cuarto es la regresión del VFX oficial. **Resultados Electron, build y Play todavía NO VERIFICADOS** en el entorno de preparación.

## QA visual obligatorio del usuario

Con idéntica escena, cámara, resolución y configuración:

1. Seleccionar Despejado, Llovizna, Lluvia, Tormenta, volver a Despejado. Capturar cada estado y comprobar que no quedan quads residuales.
2. Repetir con el perfil Forward+ y GTAO activado y desactivado, sin cambiar ningún otro ajuste. Comparar el rectángulo negro y la sombra de un objeto sólido.
3. Repetir en Mobile y Compatibility. Si existe el rectángulo SIN GTAO, registrar ese hecho como otra ruta culpable; no ocultarlo con la marca GTAO.
4. Comprobar bruma, nieve, impactos en superficies inclinadas, salpicaduras y bajo techo.
5. Cambiar de clima reiteradamente; entrar/salir de Play y abrir Player exportado.
6. Observar errores de consola y valores CPU/FPS con F3 bajo la misma carga. No confundir tiempo CPU de simulación con coste GPU.

## Evidencia a devolver

Salida completa de los cuatro tests Node/Electron, logs de `npm run build`, mensajes de consola al cambiar clima, capturas Forward+ GTAO On/Off y Compatibility y confirmación de Editor/Player. La captura del resultado S00 no acredita el QA visual del correctivo meteorológico.

## Estado

Implementado y Node PASS. Electron, build y QA visual/local PENDIENTES. Gate NO CERRADO.
