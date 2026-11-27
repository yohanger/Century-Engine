# Inventario — S02-G001-INTEGRAL · CA-001/CA-002 ratificados

**Estado:** Gate S02 autorizado e IMPLEMENTADO EN FUENTES. TEST AUTOMATIZADO PARCIAL PASS. Compilación Vite/Electron, JSZip real, QA local, exportación e integración Player/Cinematics NO VERIFICADOS. **NO CERRADO.**

## Baseline de comparación

`LevelForge_FILMMAKER_CAMERA_DIRECTION_S02_G001_INTEGRAL_AUDIT_SOURCE_BASELINE.zip` (auditoría previa; incluye los contratos, pruebas y evidencia preimplementación). El proyecto local debe incorporar previamente el CHANGE de auditoría o reconciliar sus documentos antes de extraer este CHANGE.

## Archivos originales de producción modificados

- `src/core/capture/math.js`
- `src/core/state/film.js`
- `src/filmmaker/cinematic.js`
- `src/filmmaker/film.js`
- `src/filmmaker/montage.js`
- `src/filmmaker/operator.js`
- `src/filmmaker/panels/CameraPanel.vue`
- `src/filmmaker/session.js`

El modelo `.nfm` tiene una sola estructura con cámaras propias, sin versión ni comparación histórica. `newFilm()` crea su cámara inicial y `normalizeFilm()` rechaza estructuras sin cámaras y referencias activas inválidas. Camera Shake usa el evaluador existente; multicámara conserva referencias por ID y el montaje continúa basado en `pass.id`.

## Tests modificados

- `scripts/test-filmmaker-anim-s01-g001.mjs`
- `scripts/test-filmmaker-anim-s02-g002-corr001.mjs`
- `scripts/test-filmmaker-anim-zip-s01-g001.mjs`
- `scripts/test-filmmaker-camera-nav-device-g001.mjs`
- `scripts/test-filmmaker-frame-s01-g001.mjs`
- `scripts/test-filmmaker-ux-s01-g002-corr001.mjs`
- `scripts/test-filmmaker-ux-s01-g002.mjs`

**Test nuevo:** `scripts/test-filmmaker-camera-direction-s02-g001-integral.mjs`.

## Documentación y ledger

**Modificados:** `docs/architecture/LF-FILMMAKER-CAMERA-DIRECTION-CA-001_PROPOSAL.md`, `docs/qa/LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL_QA.md`, `docs/qa/LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL_FILES.md`, `docs/qa/LevelForge_DB_Ledger.xlsx`.

**Nuevos:** `docs/architecture/LF-FILMMAKER-CAMERA-DIRECTION-CA-002.md` y tres logs en `docs/qa/evidence/LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL/` (`node-ca002-focal.log`, `node-ca002-regression-executable.log`, `node-ca002-regression-diagnostic.log`).

**Eliminados:** ninguno. Los cambios inesperados deberán contrastarse byte a byte con el ZIP de auditoría antes de aceptar el CHANGE. Los archivos de `filmmaker-mobile/`, `electron/` y el Player no se modifican bajo este Gate.

## Instalación sobre el proyecto local existente

1. Abrir la raíz del proyecto LevelForge existente, identificada por `package.json`. **No extraer el SOURCE_BASELINE sobre este proyecto.**
2. Comparar los archivos afectados con cualquier modificación local, respaldar antes de reemplazar y reconciliar especialmente `docs/qa/LevelForge_DB_Ledger.xlsx`; no sobrescribir anotaciones locales ciegamente.
3. Extraer únicamente CHANGE conservando rutas de carpetas. Mantener intactas películas `.nfm`, escenas, proyectos, `node_modules`, builds y datos personales.
4. Conservar SOURCE_BASELINE completo como fuente acumulada para continuidad del Gate.

## QA local exigido

Desde la raíz del proyecto:

```bash
node --test scripts/test-filmmaker-camera-direction-s02-g001-integral.mjs scripts/test-filmmaker-frame-s01-g001.mjs scripts/test-filmmaker-anim-s01-g001.mjs scripts/test-filmmaker-anim-zip-s01-g001.mjs
npm run filmmaker -- --build
```

**Esperado:** 0 FAIL; con dependencias instaladas, el test binario de JSZip debe ejecutarse realmente, no ser SKIP. El build de Vite debe finalizar correctamente; después comprobar Electron en el hardware local, autoría y operación de los cuatro rigs, multicámara, shake, guardado/reapertura `.nfm` y exportación a LevelForge/Cinematics. Devolver salida de las pruebas y capturas/evidencia funcional. No cerrar sin QA local.
