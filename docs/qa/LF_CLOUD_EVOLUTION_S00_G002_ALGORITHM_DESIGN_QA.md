# LF-CLOUD-EVOLUTION-S00-G002 — Auditoría QA del contrato de diseño

**Fecha:** 17-11-2026. **Gate:** documental. **Estado:** diseño redactado, QA documental y regresiones Node PASS; aprobación/ratificación del usuario pendiente; QA GPU del nuevo algoritmo NO VERIFICADO porque no se implementó.

## 1. Fuentes y pruebas

**SOURCE_BASELINE de entrada:** `LF_CLOUD_EVOLUTION_S00_G001_INTEGRAL_VALIDATION_SOURCE_BASELINE.zip`, SHA-256 `1c2b21ade48ce5c113dbd11e18c1560fbf8a9f78f302ad1e97a2335c7ab9bb66`.

**Código inspeccionado:** `world/{world,weather,params,cloudfield,cloudfield-query,cloudfield-bake,cloud-volume,cloud-volume-state}.js`, `render/{skylib,sky-cloud-volume,viewport-env,viewport}.js`, `scene-graph.js`, `scene/environment.js`, `events/play-saves.js`, `world/api.js`, `core/events/game-api.d.ts`; documentos CA vinculantes y G001.

**Evidencia local G001 aportada por usuario (no generada por G002):** `evidence/lf-cloud-evolution-s00-g002/g001-local-user-2026-11-17.log` con Node 9/9, Electron WebGL2 12/12 y Vite build PASS (933 módulos). Usuario indicó que el Editor arrancó sin errores observables. Esto **no** prueba exportación Player, FPS de escena real ni el futuro algoritmo.

## 2. Regresiones existentes ejecutadas en G002, sin modificaciones productivas

| Comando | Resultado | Log en evidencia |
| --- | --- | --- |
| `node --test scripts/test-cloud-evolution-integral-validation-g001.mjs` | **9 PASS / 0 FAIL** | `g001-characterization-regression.log` |
| `node scripts/test-clouds.mjs` | **103 OK** | `clouds-regression.log` |
| `node scripts/test-atmosphere.mjs` | **31 OK** | `atmosphere-regression.log` |
| `node --test scripts/test-cloud-altitude-horizon-corr002.mjs scripts/test-cloud-natural-scale-corr003.mjs` | **16 PASS / 0 FAIL** | `calibration-regression.log` |

**No se repitió** GPU Electron en el entorno documental: se conservó la evidencia QA local aprobada de G001. Tampoco se ejecutaron cambios al Player, build adicional o benchmark GPU; esos estados quedan NO VERIFICADOS en G002.

## 3. Pruebas contractuales de trazabilidad

| ID | Contrato del diseño | Fuente | Escenario QA futuro | Resultado documental |
| --- | --- | --- | --- | --- |
| CT-01 | World autoridad única | `world.js`, Weather/Tornado CA | mismo preset/fade entre Renderer/FX | diseño trazado |
| CT-02 | Morfología continua sin cambio de plantilla | `cloudfield.js: evaluate/primitives` | serie temporal A/B cruzando umbrales | pendiente implementación |
| CT-03 | Condensado persistente | `cloud-volume.js: _step/advance` | crecimiento-unión-disipación | diseño trazado |
| CT-04 | RG8 2 estados inicialmente | `sky-cloud-volume.js`, `viewport-env.js` | shader WebGL2, memoria/uploads | propuesta condicionada |
| CT-05 | No cielo vacío por teletransporte | `cloud-volume.js: _recenter` | 20 km y retorno, 1er frame | candidato por validar |
| CT-06 | Guardado con fade | `play-saves.js`, `world.js` | guardar en 25/50/75% y cargar | ampliación condicionada |
| CT-07 | Edit Mode fijo | `scene-graph.js`, `viewport.js` | reposo editor, liveFx independiente | Amendment sin ratificar |
| CT-08 | Precipitación/rayos/tornado coherentes | `cloudfield-query.js`, CA Tornado | nube madre, lluvia bajo núcleo | preservación contractual |
| CT-09 | `cloudModel` UX consolidado | `params.js`, `api.js`, `game-api.d.ts` | escena actual y nuevas condiciones | BLOQUEO authority |
| CT-10 | Paridad Player y perfiles | WebGL2/Player/Render | Editor/Player Compatibility/Mobile/Forward+ | NO VERIFICADO |

## 4. Contradicciones, riesgos y pruebas de admisión

**C-01 · Editor:** `liveFx` avanza World aun con `clock:false`, contradiciendo la decisión de Edit Mode estático; resolver solo mediante Amendment ratificado y pruebas de otros consumidores.

**C-02 · Autoridad:** `LF-VOLUMETRIC-CLOUDS-REPLACEMENT-CA-001` no figura como documento íntegro en `docs/architecture` del SOURCE_BASELINE. No inferir su texto ni declarar supersesión. Estado **BLOQUEADO para ratificación de cláusulas relacionadas**.

**C-03 · `cloudModel`:** `classic` es valor por defecto; `cells` es alternativo y `game.weather.cloudModel` lo publica. No eliminar hasta ratificar cambio contractual, consumidores y persistencia.

**C-04 · Render:** el Amendment Weather/Tornado no certifica nubes ocluidas por mallas/terreno; no considerar la calidad visual integral aprobada sin este escenario.

**C-05 · Memoria y FPS:** los números `80×80×16`, RG8 dos estados, 24/36/56 pasos son configuración actual, no garantía de que la futura evolución cumpla 60 FPS en N5030/4GB.

**C-06 · Persistencia:** el G001 prueba restauración volumétrica, no reproducción exacta de Director/Fade/PRNG; la especificación promete continuidad visual condicionada, no determinismo perfecto histórico.

## 5. Estado QA / criterios de aprobación del diseño

- **Entregado:** contrato de diseño, borrador de Amendment, diagramas de autoridad y ciclo de vida, matrices de API/consumidores/QA, regresiones Node y ledger.
- **QA DOCUMENTAL:** comprobar integridad de ZIP, que producción permanece binariamente idéntica a G001, que el ledger retiene seis hojas e historial, que las referencias de test existen y que el PDF representa fielmente el Markdown.
- **No aprobado/ratificado:** usuario debe revisar diseño y borrador. No cerrar contrato porque el QA sea PASS.
- **Siguiente acción:** conseguir texto íntegro del Amendment ausente, reconciliarlo y ratificar las cláusulas efectivas; Gate integral de implementación solo después de esa autoridad.
