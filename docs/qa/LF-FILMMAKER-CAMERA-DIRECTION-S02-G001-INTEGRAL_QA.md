> **Actualización vinculante 2026-11-05:** CA-001 y CA-002 han sido ratificados; la mención a v4/v5/migraciones del diagnóstico inicial ha sido SUPERSEDIDA por CA-002. El Gate continúa en implementación, **NO COMPILADO / QA LOCAL PENDIENTE / NO CERRADO**. Las secciones históricas siguientes se conservan como evidencia de la auditoría inicial y no describen el estado actual.

# QA y estado — LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL

**Estado 2026-11-05:** AUTORIZADO · AUDITADO · **BLOQUEADO CONTRACTUALMENTE ANTES DE CÓDIGO**. NO IMPLEMENTADO. NO COMPILADO EN ESTE GATE. QA LOCAL NO EJECUTADO. NO CERRADO.

## Evidencia disponible

- Baseline ZIP S01-G002-INTEGRAL APPROVAL abierto íntegramente y revisados `operator.js`, `film.js`, `session.js`, `montage.js`, `CameraPanel.vue`, `NleTimeline.vue`, `play-camera-shake.js`, `camera-shake.js` y `camera.js`.
- Sintaxis JavaScript de 5 módulos clave: PASS.
- Suite de regresión focal sin shake G004: **32 tests / 31 PASS / 1 SKIP JSZip / 0 FAIL**, ver `docs/qa/evidence/LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL/node-baseline-20261105.log`.
- Suite adicional, **solo diagnóstico** con shake G004: **68 tests / 66 PASS / 1 FAIL / 1 SKIP**. Falla G004-13 por patrón regex estático que requiere que `_shakeClocks.clear()` sea la primera línea de `_setupScene`, aunque el código real lo hace después de `_runtimeGroups = new Map()`. No atribuir PASS a esa suite; no corregir código histórico bajo S02 sin justificación contractual.
- Sin dependencias Vite/JSZip instaladas en este contenedor. Compilación Electron, guardado binario y UI N5030 NO VERIFICADOS.

## Bloqueos

- CA de esquema v5, cámaras FilmMaker-only y política Camera Shake pendiente de aprobación.
- Evidencia S01-G002 (compilación/JSZip/QA Electron/export) aún pendiente en ledger. No transferirla a este Gate.

## QA de implementación posterior a ratificación

- Cada rig: movimiento verificable, controles unidades, límites físicos cinemáticos, restitución de viewport, guardado/reapertura.
- Camera Shake: única receta/evaluador, replay reproducible con seek reversible, sin offset acumulado y sin doble composición con capas NLE.
- Multicámara: identidad, selección, grabación, corte, cambio de rig, borrado/referencia huérfana, performance con un viewport.
- `.nfm` v4 → v5: migración sin pérdida de `passes`, `takes`, `edit`, `overrides`, `nodeTracks`, `physicsBakes`, versiones futuras rechazadas.
- Exportación: LevelForge/Cinematics consumen datos sin adquirir autoría de las cámaras FilmMaker; Player utiliza trayectoria final sin aplicar shake duplicado.
- Electron en PC del usuario, capturas y resultados objetivos; sin afirmar benchmark no ejecutado.

## Evidencia posterior a CA-002 (2026-11-05)

- `film.js` elimina `NFM_VERSION`, el campo versionado y la migración por comparaciones; `newFilm()` crea su cámara inicial y `normalizeFilm()` valida estructura. No altera el protocolo Android.
- Pruebas focales de modelo, cámara, encuadre, animación y UI estática: **56 pruebas: 55 PASS, 1 SKIP JSZip, 0 FAIL** (`docs/qa/evidence/LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL/node-ca002-focal.log`).
- En la suite ampliada de FilmMaker el único FAIL es `FILM-S01-UI`: requiere Vite no instalado. No se atribuye a la lógica de cámaras; queda NO VERIFICADO hasta ejecución local con dependencias.
- Verificaciones faltantes: JSZip real, build Vite/Electron, QA visual, persistencia `.nfm` binaria, Player/LevelForge y medición N5030. No declarar Gate APROBADO/CERRADO.
