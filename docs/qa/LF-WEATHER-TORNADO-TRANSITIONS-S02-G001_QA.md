# LF-WEATHER-TORNADO-TRANSITIONS-S02-G001 — QA del usuario

**Estado:** ejecución local pendiente. La suite Node observada: **255 PASS, 0 FAIL, 0 SKIP** (nueve scripts). El test Node PASS no significa QA visual ni Jolt WASM real PASS. Probar sobre una copia de la carpeta del proyecto y conservar el SOURCE_BASELINE S01 anterior.

## Preparación

En la **raíz LevelForge** que contiene `package.json`:

```bash
npm ci
node --test scripts/test-weather-tornado-transitions-s02-g001.mjs scripts/test-weather-tornado-world-s12-g001.mjs scripts/test-vfx-inspector-s01-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-weather-lightning-world-s11-g001.mjs scripts/test-weather-tornado-destructive-s12a-g001.mjs scripts/test-liquid-containers-s10-g001.mjs scripts/test-liquid-rainflow-s07-g001.mjs scripts/test-runtime-jolt-play-corr-g001.mjs
node --test --test-name-pattern='JW-04' scripts/test-runtime-jolt-wasm-real-corr-g001.mjs
npm run test:runtime-jolt-wasm
npm run electron
```

Si `npm run electron` no existe en la versión instalada, verificar los scripts reales de `package.json` y reportar la discrepancia sin inventar comandos. No ejecutar la suite Jolt completa si JW-04 falla. Resultado exigido para Jolt real: **12 PASS, 0 FAIL, 0 SKIP** (no alcanzado en este entorno). No confundir test de stubs con WASM.

## Prueba funcional Editor y Player

1. Crear escena de prueba con `World → Clima`: activar clima y **Permitir tornados**. En modo **Solo desde scripting**, iniciar Play sin crear VFX: no debe aparecer tornado ni ejercerse fuerzas hasta orden explícita.
2. Desde el scripting existente, solicitar `game.weather.startTornado({ weatherTransition: 5 })`. Observar cambio gradual del cielo/tormenta, fases, formación progresiva de la columna automática, desplazamiento y debilitamiento. Verificar que `game.weather.tornado.phase` expone fase y posición y que `game.weather.modifyTornado({ intensity: 26, direction: 90, moveSpeed: 2 })` cambia su comportamiento.
3. Solicitar `game.weather.stopTornado()`; comprobar debilitamiento y disipación. Repetir con `stopTornado(true)` para transición inmediata expresamente pedida. No debe quedar VFX al salir de Play.
4. Modo **Automático con tormentas**: con probabilidad 0, una tormenta no forma tornado; con probabilidad 1 y tormenta intensa, inicia la secuencia. Probar la transición del clima existente al cambiar de presets.
5. Sin asignar `tornadoVfxNodeId`, confirmar representación automática visible y SIN recursos añadidos a Assets. Asignar luego un nodo VFX3D con recurso genérico **Espacio Mundo**: no emite prematuramente; el estado de Transform, emisión y partículas se restaura al detener Play. Cambiar de escena y verificar limpieza.
6. Abrir un `.vfx` heredado con `movement.tornadoFlow` por la ruta de importación admitida. Confirmar que al validar/guardar el campo no persiste, que otros datos y referencias siguen intactos y que un valor mal formado produce un error útil. Probar con un proyecto desechable, no con la única copia del trabajo.
7. Con `tornadoBodies`, `tornadoPlayer`, `tornadoDestruction`, `tornadoWaterLift`, `tornadoFire` habilitados cuando corresponda: comprobar Jolt real, colisiones, árboles, agua y agua suspendida (conservación de masa), fuego, sonido y respuesta de jugador. Comparar fases y fuerzas; los sistemas físicos no se sustituyen por partículas.
8. Guardar/restaurar partida durante desarrollo, formación, actividad y disipación. Ejecutar Play/Stop repetidamente, cambio de escena, Film Maker y Player exportado. Revisar consola, fugas de recursos, FPS/memoria en equipo N5030/4 GB.
9. Ejecutar pruebas de integración Editor, Player y exportación disponible. Si hay problemas de iconos en distribución, documentar incidencia previa separada; no adjudicarla a S02 sin evidencia.

## Evidencias para devolver

- Salida textual completa del runner Node y de JW-04 y, si pasa, del runner Jolt WASM completo.
- Capturas/clip de las fases y transición meteorológica, VFX automático y recurso personalizado, Inspector y Play/Stop.
- Logs de consola de Editor/Player y detalle de reproducción de errores (configuración, paso, esperado, observado).
- Evidencia de guardado/restauración, física de objetos, jugador, agua, vegetación y fuego, y registro de rendimiento cuando sea posible.

**Criterios de cierre:** pruebas automatizadas pertinentes, compilación, ejecución WASM real, QA visual/físico Editor y Player, aprobación expresa del usuario y actualización final del ledger con evidencia. Sin esos elementos el Gate permanece **NO CERRADO**.
