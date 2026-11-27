# Inventario Change / SOURCE_BASELINE · S02-G001-INTEGRAL

Comparación estricta de bytes SHA-256 contra `LevelForge_FILMMAKER_MOBILE_CAMERA_VISUAL_TRACKING_FEASIBILITY_S01A_G001_SOURCE_BASELINE.zip`, baseline vinculante anterior.

**Estado:** IMPLEMENTADO EN FUENTES; 46 Node (44 PASS, 2 SKIP, 0 FAIL); Android/Vite/Electron real, hardware Z2473 y ratificación documental CA-MC-002 PENDIENTES; NO CERRADO.

## Archivos NUEVOS (12)

- `docs/architecture/LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001-INTEGRAL_CA-MC-002.md`
- `docs/architecture/LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001-INTEGRAL_FILES.md`
- `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001-INTEGRAL_QA.md`
- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001/node-local-s02-20261104.log`
- `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001/user-z2473-s01a-captures-assessment.md`
- `electron/filmmaker-mobile-bridge.cjs`
- `scripts/fixtures/filmmaker/mobile-bridge-s02.html`
- `scripts/test-filmmaker-mobile-live-bridge-s02-electron.mjs`
- `scripts/test-filmmaker-mobile-live-bridge-s02-g001.mjs`
- `src/filmmaker/mobile-live-bridge.js`
- `src/filmmaker/mobile-live-monitor.js`

## Archivos MODIFICADOS (11)

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `electron/main.cjs`
- `electron/preload.cjs`
- `filmmaker-mobile/README.md`
- `filmmaker-mobile/android/app/src/main/AndroidManifest.xml`
- `filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MobileCapabilitiesPlugin.java`
- `src/filmmaker/FilmApp.vue`
- `src/filmmaker/MobileCapabilities.vue`
- `src/filmmaker/operator.js`
- `src/filmmaker/panels/CameraPanel.vue`
- `src/filmmaker/session.js`

## Archivos ELIMINADOS (0)

Ninguno.

## Cambios inesperados

No se detectaron alteraciones fuera de los puntos de integración S02, sus pruebas, documentación de continuidad y ledger. No se alteraron Editor/Player ni Cinematics ni esquema `.nfm`.

**Evidencia pendiente:** build real, imagen decodificada, orientación física visual, latencia/FPS, desconexión y QA usuario. Un SKIP no es PASS. S01A mantiene pendiente la pose 6DoF.
