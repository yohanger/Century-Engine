# LF-FILMMAKER-CAMERA-NAV-DEVICE-G001 — Integración PC/Laptop

**Autorización literal recibida:** «Listo. LF-FILMMAKER-CAMERA-NAV-DEVICE-G001 autoriza comenzar» (2026-11-05).
**Estado:** IMPLEMENTADO EN FUENTES; TEST AUTOMATIZADO PASS PARCIAL; COMPILACIÓN/QA VISUAL ELECTRON NO VERIFICADOS; NO APROBADO/NO CERRADO.
**Base:** SOURCE_BASELINE S03 INTEGRAL CORR-001. El ZIP `lf(9).zip` enviado por el usuario contenía los mismos 2.192 archivos de fuente de esa base y 24 archivos `dist-player` generados excluidos de la siguiente entrega. Ningún cambio inesperado heredado dentro de las fuentes.

## Auditoría previa — fuentes reales

- `src/components/ViewBar.vue` contiene el selector original de LevelForge; `run('nav.mouse')` y `run('nav.trackpad')` cambian `store.prefs.navigation` en `src/core/commands.js`.
- `src/core/state/state.js` guarda la única preferencia en `levelforge:prefs` mediante el watcher existente. `src/core/editor/keys.js` observa ese campo y actualiza `Viewport.setNavigation`. `src/engine/runtime/render/viewport-nav.js` ya interpreta dos dedos/pellizco/Mayús en edición.
- `src/filmmaker/FilmApp.vue` comparte `Editor` y `Viewport`, pero en una pasada activa llama a `OperatorRig` y manejaba la rueda sin consultar modo; `src/filmmaker/operator.js` solo ofrecía `look()` y `wheel()`; `CameraPanel.vue` explicaba únicamente ratón para la entrada PC.

**Causa raíz de la conexión faltante:** la preferencia y la navegación editorial ya estaban implementadas; FilmMaker no mostraba el selector y el control de la pasada no derivaba del modo elegido.

## Cambios implementados

1. `FilmApp.vue`: un icono alternable en la barra superior, con los mismos iconos `Icon` de LevelForge (`mouse`/`trackpad`), acciones `nav.mouse`/`nav.trackpad`, estado accesible `aria-pressed`, nombre y tooltip; solo visible en escritorio y cuando hay película cargada. No se crea estado paralelo.
2. `FilmApp.vue`: durante una pasada con entrada PC, intercepta el evento `wheel` en fase de captura para que el visor editorial no aplique el mismo gesto. Ratón conserva rueda para zoom y arrastre para mirar. En Laptop, `deltaMode` normalizado y limitación por evento, dos dedos miran, pellizco (`Ctrl + wheel`) ajusta zoom, Mayús + dos dedos desplaza; inputs Android/AR/remoto no interpretan el gesto y tampoco lo entregan a la cámara editorial.
3. `operator.js`: método `trackpad` dentro del `OperatorRig` existente; usa `padOrbit`, `padPan`, `padZoom`, `padInvert`, `padInvertY` ya persistidos por LevelForge. Respeta los límites de zoom del rig y evita la traslación del trípode.
4. `CameraPanel.vue`: instrucciones contextuales reactivas a la preferencia compartida, sin añadir modos al archivo `.nfm` ni modificar el selector de fuentes de filmación PC/sensores/AR.

## Aislamiento

No se cambió el registro cinematográfico, la estructura `.nfm`, `film.frame`, las cámaras del Player, WebRTC, Android, localización 6DoF, colisiones, física, edición de escena ni render. Solo se modificaron tres archivos originales de FilmMaker más pruebas, documentación, evidencia y ledger.

## QA automatizado y límites de evidencia

- Suite compuesta con Editor ViewBar + FilmMaker S01/S01A/S02/S03 + Gate actual: **83 tests, 81 PASS, 2 SKIP, 0 FAIL**. Los dos SKIP son comprobaciones con dependencias faltantes: Electron/Vite y `esbuild`/OpenCV según cada test. Registros: `docs/qa/evidence/LF-FILMMAKER-CAMERA-NAV-DEVICE-G001/node-s03-nav-20261105.log`.
- Tests específicos `NAV-01` a `NAV-09`: **9 PASS, 0 FAIL**. Incluyen comportamiento real de `OperatorRig.look`, `wheel`, `trackpad` aislado sin cambiar la clase; VM de `FilmApp.stWheel`, permisos, prioridad de pellizco, teclado y sensor; continuidad de pref/selector.
- `node --check` de `operator.js` y test: PASS.
- **BUILD Vite en el entorno de implementación: NO VERIFICADO**. `npm ci --ignore-scripts` no pudo descargar dependencias (`EAI_AGAIN` al resolver registry.npmjs.org). No atribuirlo al código del proyecto ni declarar compilación.
- **Electron visual, ratón físico, touchpad real, persistencia tras reinicio, grabación de pase y uso con PC/laptop: QA USUARIO PENDIENTE**.

## Continuidad S03 móvil

El usuario informó que FilmMaker abre/cierra correctamente tras CORR-001 («Funciona excelente») y que el teléfono «funciona bien», pero decidió **pausar el monitor S03** y posponer limpieza de FilmMaker hasta nueva definición. Estos informes acreditan funcionamiento funcional declarado, no métricas cuantitativas S03 ni cierre del Gate móvil. S01A continúa abierto, pose 6DoF real no verificada; S04-S06 no autorizados. El Gate actual no los modifica ni los cierra.
