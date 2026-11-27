# QA local — LF-WEATHER-UNIFICATION-S03-G001

**Estado:** IMPLEMENTADO · TEST NODE PASS · QA LOCAL NO VERIFICADO · NO CERRADO.

## Instalación y seguridad del baseline

Base exacta para CHANGE: `LevelForge_WEATHER_UNIFICATION_S02_G001_SOURCE_BASELINE.zip`.
Extraer CHANGE en la raíz del proyecto que contiene `package.json`, respetando carpetas. Comparar primero cualquier archivo modificado localmente. No sobrescribir escenas, proyectos o Assets. No eliminar `node_modules`. Conservar SOURCE_BASELINE S02 como respaldo; mantener SOURCE_BASELINE S03 completo aparte como origen del Gate siguiente. CHANGE contiene solo rutas nuevas/modificadas, sin builds ni cachés.

## Pruebas automatizadas

Desde la raíz de LevelForge:

```bash
npm ci
node --test scripts/test-weather-unification-s03-g001.mjs scripts/test-weather-unification-s03-electron-contract.mjs
node --test scripts/test-weather-unification-s01-g001.mjs scripts/test-weather-unification-s02-g001.mjs scripts/test-weather-tornado-destructive-s12a-g001.mjs scripts/test-liquid-containers-s10-g001.mjs scripts/test-liquid-waterbody-coupling-s09-g001.mjs scripts/test-runtime-jolt-play-corr-g001.mjs
node --test scripts/test-vfx-webgl-s02-g001.mjs scripts/test-weather-tornado-visual-webgl-corr-g001.mjs scripts/test-weather-tornado-visual-cohesion-webgl-corr-g001.mjs
npm run build
npm run electron
```

**El harness gráfico usa Electron incluido en el proyecto.** Ya no requiere `LF_VFX_BROWSER` ni Chromium/Brave por separado. Para capturas diagnósticas automatizadas, opcionalmente establece `LF_QA_CAPTURE_DIR` a una carpeta escribible. En Linux necesita una sesión gráfica; no se fuerza renderizado software para ocultar defectos GPU. Las fixtures no son equivalentes al Player exportado.

Para verificar Jolt WASM real, separado de los mocks:

```bash
node --test --test-name-pattern='JW-04' scripts/test-runtime-jolt-wasm-real-corr-g001.mjs
npm run test:runtime-jolt-wasm
```

Ejecutar la suite real completa solo si JW-04 pasa. Requisito contractual previo: 12 PASS, 0 FAIL, 0 SKIP; si falla, enviar registro exacto, no declarar la integración física aprobada.

## QA de integración (realizar en Editor y Player)

1. Cargar la misma escena y cámara con clima ambiental, sin tornado: validar viento en hojas, hierba, fuego y lluvia; el agua suspendida existente debe responder a brisa ambiental sin inventar volumen.
2. Activar tornado progresivamente: comprobar que el agua suspendida cambia de trayectoria por el vórtice, las fuentes térmicas y árboles vecinos reciben el viento de su ubicación y que el jugador no recibe fuerzas duplicadas.
3. Comparar dos focos de fuego, uno bajo nube lluviosa y otro fuera de la lluvia en CloudField por celdas. Registrar enfriamiento local distinto; la lluvia global no debe apagar indiscriminadamente ambas fuentes.
4. Verificar arraigo y desprendimiento de árboles cercanos, con objetos dinámicos Jolt y colisiones, respetando la opción de destrucción. Comprobar Play/Stop y reposición al Editor.
5. Validar conservación de agua levantada/depositada, fuentes y brasas con guardado/restauración, sin acumulación residual. Repetir varias veces.
6. Comprobar Pixel/Compatibility y Player con la misma resolución, escena y posición; registrar FPS, RAM, incidencias y tiempo aproximado de actualización. No se establece una promesa fija de 60 FPS sin medir.
7. Registrar por separado la presencia del rectángulo negro al seleccionar `Tiempo = Tormenta` con `Permitir tornados` desactivado. **Ese fallo tiene Gate independiente**, no se declara solucionado en S03.

## Evidencia que devolver

Salida íntegra de ambas suites Node, pruebas WebGL Electron, build y Jolt real; vídeo/capturas del agua, árboles, fuego, jugador y Play/Stop; tabla FPS/Compatibility para Editor/Player e incidencias del viewport. Diferenciar PASS de bloqueo por entorno. El Gate no está CERRADO hasta QA local y aprobación.

## Repetición de QA Electron tras fallo de uniforms (S03 QA-CORR-001)

El usuario confirmó el 31-10-2026: **25 PASS Node** y **1 PASS / 2 FAIL WebGL Electron**. Los dos fallos de tornado se produjeron en la aserción «sin errores GPU» y no aportaron el código GPU. La corrección candidata actualiza solamente las dos fixtures del cielo y su diagnóstico; no modifica el motor.

```bash
node --test scripts/test-weather-unification-s03-g001.mjs scripts/test-weather-unification-s03-electron-contract.mjs scripts/test-weather-unification-s03-electron-shader-uniforms-corr.mjs
node --test scripts/test-vfx-webgl-s02-g001.mjs scripts/test-weather-tornado-visual-webgl-corr-g001.mjs scripts/test-weather-tornado-visual-cohesion-webgl-corr-g001.mjs
```

**Node esperado:** 29 PASS, 0 FAIL, 0 SKIP. **Electron requerido para aprobar el QA gráfico:** 3 PASS, 0 FAIL, comprobando WebGL2 real. Estos resultados GPU siguen PENDIENTES; si vuelve a fallar, la respuesta ahora debe incluir `details.code` y `details.glsl`, útiles para determinar si se trata de `GL_INVALID_OPERATION`, compilación GLSL u otra causa. Adjuntar la salida íntegra, sin catalogar como corregido el render antes de ese retest.

El build/Player y la inspección visual siguen siendo pruebas distintas. No atribuir a esta corrección la eliminación del rectángulo negro de Tormenta, cuyo Gate permanece abierto.
