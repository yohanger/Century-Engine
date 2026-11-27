# LF-FILMMAKER-EDIT-WORKSPACE-S01-G001 — Implementación (2026-11-05)

**Autorización literal:** «Listo. LF-FILMMAKER-EDIT-WORKSPACE-S01-G001 autoriza comenzar».
**Estado histórico al entregar implementación:** IMPLEMENTADO EN FUENTES · 108 PASS/2 SKIP · VITE/ELECTRON/QA PENDIENTES.
**Estado actualizado 2026-11-05:** TEST ESPECÍFICO USUARIO 9/9 PASS · VITE BUILD PASS · QA LOCAL APROBADO POR USUARIO · GATE APROBADO Y CERRADO. Ver cierre en `docs/qa/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001_CLOSE.md`.
**SOURCE_BASELINE:** `LevelForge_FILMMAKER_CAMERA_NAV_DEVICE_G001_SOURCE_BASELINE.zip` (2.197 archivos). Se preserva la corrección Electron S03 CORR-001 y los cambios acumulados. La limpieza de FilmMaker y S03 monitor Android permanecen pausados.

## Auditoría antes de cambiar

- FilmMaker utiliza `src/filmmaker/FilmApp.vue` con `work` flex, side docks a izquierda/derecha, viewport central, panel inferior `bottomH=300`, `Splitter` nativo y `ResizeObserver` de `work` y de `stage`.
- El panel inferior se acota por `Math.max(150, workH-205)` para conservar monitor vertical utilizable; los lados se acotaban al 23 % y 27,5 % del ancho incluso al arrastrarlos más.
- `NleTimeline.vue` conserva pistas de planos, actor, texto, efectos, audio, física y nodos, regla, zoom, slider de scroll horizontal y `ResizeObserver(syncScroll)`; **no era necesario reconstruir la Timeline**.
- La incidencia previa del Gate `LF-FILMMAKER-CAMERA-NAV-DEVICE-G001`: botón `film-nav-device` presente, pero `.bar .ic { display: none }` oculta el SVG de `Icon.vue`. El selector no se duplicará ni se alterarán sus comandos.
- `src/components/Splitter.vue` acepta flechas de izquierda/derecha en ancho, pero no manejaba flechas para altura `dir=y px`, por lo que no era accesible por teclado.

## Cambios del Gate actual: espacio de edición

1. `FilmApp.vue` eleva la altura inicial de la Timeline de 300 a **360 px** (siempre con la restricción existente de 205 px de monitor cuando el contenedor tenga suficiente altura). El usuario puede arrastrar el separador existente; no se introduce un segundo splitter.
2. Un botón accesible **Ampliar / Restaurar** en el encabezado del dock inferior utiliza el **mismo componente `NleTimeline`**, sin recargar escenas ni redefinir .nfm: oculta temporalmente los docks laterales mediante `v-show` (sin desmontar sus componentes), expande el panel inferior hasta `workH - 205` y permite restaurar automáticamente altura y paneles anteriores. Al seleccionar Assets o Mezclador el modo ampliado se desactiva, manteniendo el contenido de las pestañas.
3. Los docks laterales aceptan un rango más amplio, limitado a 30 % y 31 % del ancho, para reservar al menos 39 % aproximado para el viewport en escritorio (sin considerar los separadores de 5 px). No se modifica el componente de docking de LevelForge ni se crean estructuras paralelas.
4. `Splitter.vue` admite flechas Arriba/Abajo cuando `dir=y px`, respetando `invert`, `min` y `max`, además del comportamiento horizontal que ya existía.
5. El `ResizeObserver` de `stage` y el `ResizeObserver` de scroll de Timeline existentes gobiernan sus dimensiones. No se añade un nuevo listener de resize ni estado persistente global para FilmMaker; tamaños y modo de ampliación son **estado efímero de interfaz**, no contenido de película.

## Prerrequisito en el Gate anterior: icono Laptop/PC

**Corrección identificada bajo la autorización previa de `LF-FILMMAKER-CAMERA-NAV-DEVICE-G001`, no como función nueva de este Gate:** dentro de `FilmApp.vue` se agrega una excepción CSS específica `.bar .nav-device :deep(.ic) { display: block; }`, conservando el ocultamiento de otros iconos en la barra. Esto remedia la omisión visual observada en la captura del usuario. **QA visual real y cierre del Gate anterior: PENDIENTES.** No se declara aprobación ni se sustituye la preferencia compartida.

## Exclusiones y continuidad

No se modifica `NleTimeline.vue`, `montage.js`, `session.js`, `.nfm`, Editor/Player/Cinematics, cámara de operador, clima, física, WebRTC, Android ni la futura dirección cinematográfica. No se corrigen todavía `filmEnd()` ni `montageHasContent()` (reservado para S01-G002). No se introduce persistencia local nueva; la preferencia de layout original de LevelForge sigue sin alterarse.

## Evidencia reproducible

```bash
node --test scripts/test-filmmaker-edit-workspace-s01-g001.mjs scripts/test-filmmaker-camera-nav-device-g001.mjs scripts/test-filmmaker-ux-s01-g002.mjs scripts/test-filmmaker-ux-s01-g002-corr001.mjs scripts/test-filmmaker-frame-s01-g001.mjs scripts/test-filmmaker-mobile-monitor-s03-g001.mjs scripts/test-filmmaker-mobile-live-bridge-s02-g001.mjs scripts/test-filmmaker-mobile-live-bridge-s02-electron.mjs scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs scripts/test-filmmaker-mobile-visual-tracking-s01a.mjs
```

- **110 tests: 108 PASS / 2 SKIP / 0 FAIL**, con 9 pruebas específicas del espacio e icono previo. Archivo: `docs/qa/evidence/LF-FILMMAKER-EDIT-WORKSPACE-S01-G001/node-20261105.log`.
- Dos pruebas omitidas: `esbuild` y Electron/Vite no disponibles en este entorno. La prueba S01A con análisis visual sí ejecutó PASS. Además, el test anterior `test-filmmaker-frame-ui-s01-g001.mjs` no se incluyó en la suite validada por requerir `node_modules/vite/bin/vite.js`, ausente aquí; se intentó como diagnóstico y **falló por ausencia de Vite, no por defecto funcional confirmado**.
- **Compilación Vite/Electron en este Gate: NO VERIFICADA. QA local visual: PENDIENTE.** No declarar FIXED/READY/CERRADO sin evidencia del usuario.
