# QA local — LF-TIMELINE-PREVIEW-RUNTIME-S11-G001-INTEGRAL

Estado: IMPLEMENTADO EN FUENTES, Node 353 PASS / 14 SKIP / 0 FAIL; **Electron/Player y QA visual/auditivo NO VERIFICADOS**; Gate NO CERRADO.

## Preparación y ejecución

1. SOURCE_BASELINE anterior: `LF_TIMELINE_UNITY_REPLACEMENT_S10_G006_INTEGRAL_SOURCE_BASELINE.zip`. Comparar y respaldar los archivos originales antes de aplicar CHANGE sobre la raíz existente (`package.json`); no sobreescribir cambios locales sin reconciliarlos. Alternativa: extraer SOURCE_BASELINE S11-G001 en carpeta nueva y probar allí. No mezclar ambos ZIP ni tocar proyectos, escenas o archivos externos.
2. Desde la raíz del proyecto:

```bash
npm ci
node --test scripts/test-timeline-preview-runtime-s11-g001-integral.mjs
node --test scripts/test-cinematics-player-integration-s05-g004.mjs
node --test scripts/test-runtime-persist-g001.mjs scripts/test-project-safe.mjs
npm run build
npm run electron -- --build
```

**Esperado:** suite G001 **22 PASS, 0 FAIL** con dependencias Vue instaladas; sin Vue: **21 PASS y 1 SKIP**. Guardar salida completa de pruebas y build. La ejecución de Node no sustituye a QA de Electron.

## Casos manuales (en Electron embebido)

1. Crear Timeline de prueba, añadir pista de nodo y dos claves de posición; pulsar Play, Pause, Resume, Seek y Stop. Los nodos se animan y se restauran al detener, sin cambios en el proyecto.
2. Arrastrar un audio válido de Assets a la pista Audio, generar `play` y `stop`, Play: debe escucharse el audio y terminar en el instante previsto. Probar `duration`, `fadeIn/fadeOut`, Loop, Pause/Resume. Detener y comprobar que no continúan sonidos. Un audio ambiental externo a la sesión no debe silenciarse.
3. Crear pista de Comandos con `text`, `switch`, `variable` y, si hay mundo compatible, `weather`. Play: el texto se refleja como subtítulo de Preview, las acciones permitidas se despachan y el clima se restaura con Stop. Comprobar advertencias si falta un recurso.
4. Incluir métodos de script, guardado, señales o `weatherLightning/weatherThunder`: Preview debe advertir que no son aislables y **no ejecutarlos**. Comprobar que el Player normal conserva su comportamiento previamente aprobado, sin tratar como error de Preview una función prohibida por seguridad.
5. Dos comandos en instantes diferentes; comprobar que Seek, Pause, Resume y Loop no generan eventos duplicados. Reproducir, detener, volver a reproducir y comprobar que no quedan eventos pendientes ni voces activas.
6. Durante un audio, cambiar de escena/proyecto, ocultar Timeline, desactivar Vista previa o entrar a PlayMode: todas las sesiones temporales deben cerrarse. Probar una carga de audio lenta y Stop antes de su inicio: no debe sonar después.
7. Guardar el proyecto, cerrar y reabrir; reproducir la Timeline sin cambios inesperados. Comparar Preview y Player en las acciones realmente compatibles. Registrar FPS/memoria con escena razonable si se dispone de medición local.
8. Verificar Responsive First y que las funciones de S10 (Curvas, clips, bracket `]`, cabeceras fijas, Inspector, Mix/Ripple/Replace, grupos y marcadores) siguen funcionando.

## Evidencia a devolver

- Logs Node, compilación y Electron; consola de errores/advertencias si aparece alguno.
- Vídeo corto con una animación, un audio audible y una acción permitida de comando; captura del aviso de acción no aislable.
- Resultado de Stop/Seek/Loop y restauración; guardado/reapertura y comparación Preview/Player.
- Indicar explícitamente PASS/FAIL por caso; describir reproducción mínima del fallo. **No cerrar el Gate antes de tu aprobación.**

## Bloqueadores en el entorno de preparación

`npm ci --offline --ignore-scripts --no-audit --no-fund` falló: `ENOTCACHED zip-stream@4.1.1`. Las dependencias de Vue/Three/Vite/JSZip y Electron no estaban disponibles aquí; ninguna compilación ni QA visual del Gate fue realizada. Los logs Node se incluyen en `docs/qa/evidence/LF_S11_G001_NODE_*`.
