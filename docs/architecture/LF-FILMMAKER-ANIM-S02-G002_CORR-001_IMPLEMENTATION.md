# LevelForge — LF-FILMMAKER-ANIM-S02-G002_CORR-001

**Fecha:** 2026-10-29. **Estado:** IMPLEMENTADO; compilación Editor/Player y QA Jolt WASM/Electron PENDIENTES. **Baseline:** `LevelForge_FILMMAKER_ANIM_S02_G002_SOURCE_BASELINE.zip`.

## Motivo

El usuario ejecutó `npm ci` correctamente en Windows 10 y `npm run build` falló durante la compilación del Editor: `physicsSignature` no está exportada por `physics-bake.js`. La auditoría posterior identificó además un bloqueo de reproducción sin planos, captura prematura de cuerpos horneados y preflight de importación posterior al cambio de escena.

## Correcciones entregadas

1. **A-01 — Import/Export.** `src/filmmaker/session.js` importa `physicsSignature` desde `./physics-data.js`, su módulo propietario. No hay helper duplicado.
2. **A-02 — Montaje sin planos.** `playMontage` acepta pistas de nodos, bakes o audio, siempre que exista contenido. La duración tiene mínimo 0,1 s para una clave única en el fotograma inicial; `onFrame` evalúa tiempo absoluto sin invocar `locate()` sobre una secuencia vacía. El botón Play superior elige el montaje si `montageEnd()>0`. No se crea una cámara de relleno. Los planos previos siguen su ruta anterior.
3. **A-03 — Jolt/Timeline.** Se separan **reserva de ID** (al abrir el timeline) y **propiedad física efectiva** (en `track.start`). `TimelineRunner._apply` invoca un hook de sincronización antes de aplicar muestras. El cuerpo sigue dinámico antes de `start`; la adquisición lo vuelve cinemático solamente al cruzar el inicio. Seek inverso/loop antes del inicio restauran modo dinámico, Transform y velocidades previas; stop/skip/reset hacen lo mismo. Después del final de las muestras se mantiene la última pose hasta terminar el timeline, según contrato S02. El sistema de eventos, la jerarquía de nodos y la interpolación SLERP se conservan.
4. **A-04 — Preflight transaccional.** `importFilm` carga con `db.loadScene()` los objetos de la escena destino antes de `switchScene`, valida IDs/firma de colisiones y normaliza el futuro timeline **sin mutar la escena activa**. Una vez superado el preflight, cambia de escena y ejecuta la importación. Si falla una operación posterior, restaura el snapshot de la escena de destino, revierte los assets añadidos y vuelve a la escena anterior. Un único `commit` solo ocurre al finalizar la operación exitosa.
5. **A-05 — QA.** Se añadió `scripts/test-filmmaker-anim-s02-g002-corr001.mjs` con 14 pruebas; algunas ejecutan las funciones reales mediante dependencias aisladas para comprobar propiedad Jolt, inicio diferido, seek inverso, preflight, rollback y montaje sin planos. No sustituyen el runtime WASM real.

## Límites y pendientes

- `npm ci --offline` falla en este contenedor por ausencia en caché de `zip-stream@4.1.1`. Por ello no fue posible ejecutar `npm run build` aquí. La prueba que requería Vite y la prueba ZIP que requería JSZip no pudieron completarse. Deben ejecutarse en Windows con `node_modules` ya instalados.
- El test automatizado de propietarios físicos usa dobles del motor Jolt; se requiere verificar cambios de `EMotionType`, jerarquía y condiciones de carrera con Jolt WASM real.
- La importación real `.nfm` con blobs de recursos y actualización de escena todavía necesita QA en Electron/IndexedDB. El rollback de assets soporta la lógica existente, pero los fallos de persistencia de IndexedDB durante la restauración requieren validación local.
- A-06 (`scripts/godot-check.mjs` dependiente de `playground.mjs` ausente) queda fuera de alcance: no está relacionado con el fallo Vite reportado.

## Reglas mantenidas

Sin ECS, sin motor físico alterno, sin nuevos presets/assets de demostración, sin cambios al formato `.nfm` v4 ni a Event Order Flow. Se extienden los módulos existentes conforme a EXTEND BEFORE DUPLICATE.

## Cierre

**NO CERRADO** hasta obtener `npm run build` PASS (Editor y Player) en Windows, tests de QA y prueba real de extremo a extremo Jolt/FilmMaker/Player. No se declara aprobación de QA visual.
