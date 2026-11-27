# QA — LF-TIMELINE-AUDIO-CLIP-EFFECTS-S11-G005-INTEGRAL_CORR-001

Estado: **IMPLEMENTADO EN FIXTURE**, Node PASS. **ELECTRON POSTCORRECCIÓN NO VERIFICADO**, compilación Editor/Player NO VERIFICADA, QA LOCAL / PLAYER REAL PENDIENTE; G005 y su CORR-001 NO APROBADOS / NO CERRADOS.

## Incidencia reportada por el usuario, 2026-11-07
- G005 inicial: 25/25 Node PASS y Electron 1 FAIL, con 43 comprobaciones internas PASS previas a la excepción.
- Falla real al intentar `privateA.gain.connections.includes(...)` en la fixture G005. Los `GainNode` nativos de Web Audio no tienen propiedad `connections`; esta propiedad existe en los mocks Node.
- Mensaje y contexto conservados en `docs/qa/evidence/LF_S11_G005_CORR001_USER_FAILURE.md`. El FAIL no se reclasifica como PASS.

## Corrección y mecanismo
- Única modificación funcional de archivo: `scripts/fixtures/editor/timeline-audio-clip-effects-s11-g005.html`.
- La fixture observa temporalmente `AudioNode.prototype.connect`, ejecuta el método nativo y registra los pares origen/destino de las dos voces. Verifica, por identidad de nodo, las dos conexiones `voice.gain → bus.input` al mismo bus personalizado y restaura `connect` mediante `finally`, incluso ante error. Añade comprobación explícita de restauración.
- No se incorporaron hooks al runtime ni a AudioEngine. No se modificaron los mocks anteriores, ni el runner común. Se prefiere observar conexiones nativas efectivas frente a depender de muestras de audio/analizador, sensibles a suspensión del contexto o sincronización en Electron sin dispositivo físico.

## Evidencia generada (este entorno)
- `docs/qa/evidence/LF_S11_G005_CORR001_NODE_FOCAL.log`: 28 PASS / 0 FAIL / 0 SKIP (25 G005 + 3 nuevas pruebas de regresión de fixture).
- `docs/qa/evidence/LF_S11_G005_CORR001_NODE_COMPATIBLE.log`: 79 PASS / 0 FAIL / 1 SKIP (80); un test opcional de compilador Vue no disponible.
- `docs/qa/evidence/LF_S11_G005_CORR001_NODE_EXTENDED.log`: 79 PASS / 1 FAIL / 1 SKIP (81); la suite histórica de Camera3D no se pudo cargar por dependencia `@vue/compiler-sfc` ausente. No es un PASS y no demuestra regresión del audio.
- `docs/qa/evidence/LF_S11_G005_CORR001_ELECTRON_ENV.log`: 1 FAIL de infraestructura antes de abrir la fixture («Falta Vite; ejecutar npm ci antes del QA»). **No constituye Electron PASS.**
- `docs/qa/evidence/LF_S11_G005_CORR001_BUILD_ENV.log`: `vite: not found`, exit 127. **No constituye compilación PASS.**

## QA local requerido (carpeta raíz existente con package.json)
1. Antes de aplicar CHANGE comparar con los cambios locales y respaldar el archivo de fixture y `docs/qa/LevelForge_DB_Ledger.xlsx`. CHANGE es incremental sobre G005; no extraer SOURCE_BASELINE sobre un proyecto con cambios locales sin comparación.
2. `node --test scripts/test-timeline-audio-clip-effects-s11-g005.mjs scripts/test-timeline-audio-clip-effects-s11-g005-corr001.mjs` — esperado 28 PASS / 0 FAIL.
3. `node --test scripts/test-timeline-audio-clip-effects-s11-g005-electron.mjs` — objetivo 1 PASS, al menos 40 verificaciones internas, Web Audio y WebGL reales. Observar también «Ambas voces llegan al mismo bus existente» y «Observación temporal de conexiones restaurada».
4. `npm run build` — verificar que terminan `vite build` (Editor) y `vite build --mode player` (Player).
5. `npm run electron` — usar un proyecto de prueba/respaldado, escuchar dos claves Audio con FX independientes dirigidas al mismo bus, comprobar FX del Mixer, pausa, reanudación, Stop, Inspector, guardado/reapertura y Player real. No repetir QA de G004 aprobado salvo anomalía concreta.
6. Devolver resultados de Node, Electron, build y evaluación visual/auditiva; ninguna salida esperada se declara ejecutada sin log real.

## Aceptación y cierre
Solo después de evidencia nueva de Electron, compilación y QA local del usuario se determinará la aprobación y cierre de G005/CORR-001. Los fallos históricos de G003, G004 y de las suites antiguas siguen separados; G006 persistencia integral y G007 automatización/fundidos quedan fuera de alcance.
