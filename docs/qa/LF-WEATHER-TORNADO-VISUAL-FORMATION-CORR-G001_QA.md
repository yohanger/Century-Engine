# LF-WEATHER-TORNADO-VISUAL-FORMATION-CORR-G001 — QA del usuario

**Implementado, NO CERRADO.** Pruebas Node ejecutadas sobre el baseline modificado: 282 PASS, 0 FAIL, 0 SKIP (12 suites). La compilación `npm run build` devolvió `vite: not found`; el harness Chromium no arrancó por ausencia de `node_modules/vite/bin/vite.js` tras un `npm ci` que no completó. Estas condiciones NO son PASS visual ni fallos demostrados del render meteorológico. Jolt WASM real permanece pendiente.

## Preparación / comandos

Trabajar sobre un proyecto de prueba y comparar modificaciones locales antes de reemplazar archivos. Desde la carpeta LevelForge que contiene `package.json`:

```bash
npm ci
node --test scripts/test-weather-tornado-visual-formation-corr-g001.mjs
node --test scripts/test-weather-tornado-transitions-s02-g001.mjs scripts/test-weather-tornado-world-s12-g001.mjs scripts/test-weather-tornado-destructive-s12a-g001.mjs scripts/test-vfx-inspector-s01-g001.mjs scripts/test-vfx-inspector-ux-corr-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-vfx-node-s02-g002.mjs scripts/test-weather-lightning-world-s11-g001.mjs scripts/test-liquid-containers-s10-g001.mjs scripts/test-liquid-rainflow-s07-g001.mjs scripts/test-runtime-jolt-play-corr-g001.mjs
node --test scripts/test-vfx-webgl-s02-g001.mjs scripts/test-weather-tornado-visual-webgl-corr-g001.mjs
npm run build
node --test --test-name-pattern='JW-04' scripts/test-runtime-jolt-wasm-real-corr-g001.mjs
```

Si JW-04 pasa, entonces: `npm run test:runtime-jolt-wasm`. Debe dar 12 PASS, 0 FAIL, 0 SKIP para Jolt real. Iniciar Editor con `npm run electron`. El harness Chromium requiere `chromium` disponible o `LF_VFX_BROWSER` apuntando al navegador; no equivale al QA visual de Editor/Player.

## QA visual / físico en Editor y Player

1. Mundo en **Clima → Permitir tornados**, modo scripting, clima inicialmente despejado. Sin activar el tornado no debe aparecer embudo ni ejercer fuerzas. Ejecutar `game.weather.startTornado()` y observar la transición gradual hacia tormenta. No asignar nodo VFX3D manual.
2. Grabar etapas: (A) inicio de desarrollo, (B) organización con nube giratoria, (C) formación parcial, (D) tornado activo, (E) debilitamiento y (F) disipación. **No debe aparecer una columna entera instantáneamente.** Registrar configuración, segundos y posición de cámara.
3. Acercar y alejar cámara; girar alrededor. La estructura debe verse como vórtice de partículas suavizadas sin rectángulo negro opaco ni texturas ausentes; comparar materiales con y sin textura en un `.vfx` corriente.
4. Confirmar que nube y condensación son aproximaciones visuales derivadas de World; comprobar cielo clásico y nubes por celdas. Evaluar si el embudo se ve alineado con la base nubosa en el caso de prueba. La integración volumétrica celda por celda no forma parte de este Gate.
5. Guardar/restaurar durante formación y disipación; repetir Play/Stop, dos episodios sucesivos, cambiar de escena y verificar ausencia de emisores temporales residuales. Comprobar VFX3D personalizado con recurso genérico en Espacio Mundo; no editar un `.vfx` meteorológico.
6. Medir FPS/uso de RAM en el hardware real del usuario con 896 partículas máximas; documentar cualquier degradación frente al baseline anterior. Probar Editor, Player y exportación disponible.
7. Verificar scripting de fases, posición y parada, así como objetos Jolt, vegetación, agua, FPS y fuego cuando proceda. No atribuir PASS a interacciones físicas hasta que Jolt WASM real haya superado su runner.

## Evidencias requeridas

- Log completo de la suite Node, la prueba WebGL y `npm run build`.
- Vídeo o capturas de las **seis etapas** y una imagen con la cámara junto al vórtice para diagnosticar el quad negro.
- Prueba de Play/Stop, repetición, guardado/restauración y cualquier error de consola.
- Log aislado JW-04 y suite WASM, si procede, y prueba Editor/Player.
- Medidas FPS/memoria y GPU/navegador usados. Diferenciar cada condición no ejecutada como NO VERIFICADO.

El usuario aprueba el resultado después de evaluar la evidencia; hasta entonces el Gate sigue NO CERRADO. S13 se mantiene BLOQUEADO por Jolt.
