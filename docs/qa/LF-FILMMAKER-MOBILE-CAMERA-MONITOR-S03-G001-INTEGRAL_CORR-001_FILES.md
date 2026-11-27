# S03-G001-INTEGRAL · CORR-001 · Inventario de entrega

**BASE COMPARADA:** `LevelForge_FILMMAKER_MOBILE_CAMERA_MONITOR_S03_G001_INTEGRAL_SOURCE_BASELINE.zip` (2.189 archivos). Fecha: 2026-11-05.

## Archivos nuevos (3)

- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001-INTEGRAL_CORR-001_FILES.md` — inventario de la corrección.
- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001/node-lifecycle-corr001-20261105.log` — salida de la suite local.
- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001/user-electron-lifecycle-corr001-20261105.md` — resumen verificable de capturas y build aportados.

## Archivos modificados (6)

- `electron/main.cjs` — conservar ID del renderer antes del cierre, detener la sesión por ID; validar la ventana en `second-instance`; no enviar respuesta a ventana destruida.
- `scripts/test-filmmaker-mobile-monitor-s03-g001.mjs` — S03-15 y S03-16; dobles de Electron que fallan si se accede a `webContents` destruido.
- `scripts/test-filmmaker-mobile-live-bridge-s02-g001.mjs` — la regresión S02 valida liberación mediante ID conservado, en vez de exigir la lectura insegura después del cierre.
- `docs/architecture/LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001-INTEGRAL_IMPLEMENTATION.md` — causa, mitigación y límites de evidencia.
- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-MONITOR-S03-G001-INTEGRAL_QA.md` — QA de cierre y segunda instancia, instalación limpia y evidencia solicitada.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — sincronización de ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY; conservadas las 12 tablas.

## Eliminados (0)

Ninguno. **Cambios inesperados (0).** No se modifican Editor/Player, Cinematics, `.nfm`, Android, rig, lógica de colisiones ni el transporte WebRTC. La base resultante conserva 2.192 archivos.

## Resultado verificado

- `node --check electron/main.cjs`: PASS.
- 62 pruebas Node: **60 PASS, 2 SKIP, 0 FAIL**. Los SKIP responden a ausencia de `esbuild` y Electron/Vite en el contenedor; la prueba S01A con OpenCV sí ejecutó PASS.
- Vite S03: **PASS según log del usuario**, antes de esta corrección de `electron/main.cjs`; no sustituye prueba Electron.
- Electron ejecutado y cerrado sobre CORR-001: **NO VERIFICADO**.
- APK Android S03 y QA del monitor real: **PENDIENTES**.

## Entrega LevelForge

Exactamente dos ZIP: (A) CHANGE de archivos anteriores y (B) SOURCE_BASELINE acumulado completo. Sin ZIP de evidencias separado, sin `.sh`, sin SHA-256 separado, sin node_modules, builds, cachés ni temporales.
