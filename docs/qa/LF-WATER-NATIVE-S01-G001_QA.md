# LF-WATER-NATIVE-S01-G001 — Registro de QA

**Fecha:** 18–19 noviembre 2026. **Parent:** `LF_TOOLING_S00_G001_ELECTRON_LAUNCH_AND_PACKAGE_SCRIPTS_HYGIENE_SOURCE_BASELINE.zip`.

## Estados diferenciados

- IMPLEMENTADO: cambios de código en la copia de trabajo.
- TEST PASS: solo resultados automatizados de los runners enumerados abajo.
- COMPILADO: **NO VERIFICADO** en este entorno; el módulo `vite`/`node_modules` no está presente. El `npm run build` previo aportado por el usuario acredita únicamente su línea anterior, no este Gate.
- QA LOCAL PASS (Electron, Jolt WASM real, WebGL y Player): **NO VERIFICADO**.
- APROBADO: pendiente de revisión del usuario. CERRADO: no.

## Pruebas Node

**Ejecución final en contenedor (19/11/2026):** `docs/qa/evidence/LF_WATER_NATIVE_S01_G001_NODE_113_PASS.log`: **113/113 PASS**; `docs/qa/evidence/LF_WATER_NATIVE_S01_G001_NPM_SMOKE_25_PASS.log`: **25/25 PASS**; 10 módulos JS modificados con `node --check`: PASS. Las comprobaciones son de sintaxis, lógica y mocks; no implican compilación GPU ni QA local.

Medición exploratoria del río largo: **3.752 celdas ~304–338 ms** para montar dominio en este contenedor. No extrapolar al equipo N5030 ni interpretarlo como FPS.


Ejecutar desde la raíz del proyecto:

```
node --test scripts/test-water-native-s01-g001.mjs
node --test scripts/test-water-s01.mjs scripts/test-water-s02.mjs scripts/test-water-s03.mjs scripts/test-water-s03-corr001.mjs scripts/test-water-s04.mjs scripts/test-water-runtime-visibility-s00-g001.mjs
npm test
```

Se ajustaron aserciones históricas opt-in de S02, S03, S04 y Visibility al nuevo comportamiento CA-005. Se preservaron identificadores y casos, sin ocultar los fallos anteriores:
- `test-water-s02`: 2 expectativas de activación manual supersedidas por CA-005.
- `test-water-s03`: una expectativa de fuente `player/fps/water.js` apuntaba a un archivo inexistente incluso en el SOURCE_BASELINE anterior; se dirigió al consumidor Character/Jolt efectivo.
- `test-water-s04`: el mock de lluvia se amplió con `disturb`, nuevo método del mundo real.
- `test-water-runtime-visibility`: el mock incorporó `nativeWaterConfiguration`; las pruebas opt-in de visibilidad cambiaron a expectativas de Lago nativo.

## Ensayos obligatorios para QA local

1. Lago y Río con y sin región manual, solapamiento único «agua-terreno» y conflicto deliberadamente ambiguo.
2. Pendiente de Terrain, barrera estática, entrada/salida del personaje y un RigidBody que cae y flota.
3. Cambios de volumen real con lluvia; suspensión y reanudación de estado; Editor→Play→Stop→Editor; Runtime independiente.
4. Observación visual de ondas, espuma, transparencias, normativas de iluminación y errores GPU/GLSL.
5. Controles en N5030/4 GB: tiempo de inicio, CPU p50/p95, memoria, GPU si hay contadores, FPS con 128/1024/4096 celdas y nivel real.
6. Confirmar cambios de nodos padres, desactivación y restauración de visibilidad en UI; confirmar que no desaparecen proyectos actuales.

**No equiparar pruebas de Node o generación de shader con una validación visual WebGL.**
