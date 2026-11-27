# QA — Navegación continua de cámara en Object Mode

**Gate:** `LF-EDITOR-CAMERA-CONTINUOUS-OBJECTMODE-G001`.
**Autorización:** `Listo. LF-EDITOR-CAMERA-CONTINUOUS-OBJECTMODE-G001 autoriza comenzar`.
**Base vinculante:** `LevelForge_PLAYER_CAMERA_MOTION_S01_G001_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO · NODE PASS · ELECTRON/BUILD/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Diagnóstico y cambios

**Observado en código:** `Editor` conectaba `setEditNavigation(() => !!this.edit, this._continuousGrab)`. Fuera de una sesión Edit Mode, el guard impedía empezar Pointer Lock de navegación; la misma instancia `ContinuousGrab` ya era compartida con los gizmos de Object Mode.

**Causa raíz:** condición de activación restrictiva, no ausencia de un navegador de cámara. El gesto de navegación y la lógica de envolver cursor ya existían.

**Corrección:** `Editor` habilita el controlador continuo en Object Mode y Edit Mode siempre que no haya Play activo, reutilizando `ContinuousGrab`. La entrada en Play y el cambio de escena cancelan un gesto activo para liberar el cursor. No se toca Player ni se añade un segundo cursor, renderer o sistema de cámara.

**Regresión histórica:** el test ECG-01 de Edit Mode ahora comprueba el guard extendido; ECG-03 mantiene la prueba de desactivación explícita de la fuente. La fixture gráfica compartida incorpora comprobaciones de Object Mode y Play. La prueba G004-14 comprueba que `stopCameraPilot()` se invoca en limpieza, sin exigir una posición textual fija frente a la liberación previa de Pointer Lock. No se cambia el contrato del pilotaje.

## Pruebas realizadas

- Nuevas `OCG-01..14`: **14/14 PASS**.
- Regresión focal junto a ECG histórica: **30/30 PASS**.
- Regresión ampliada, 14 suites de Editor/Bevel/Snap/LoopCut/edición: **228/228 Node PASS**. Ver `LF-EDITOR-CAMERA-CONTINUOUS-OBJECTMODE-G001_NODE.log`.
- La suite completa G004 contiene además `G004-15`, que falla **también en el baseline de entrada** porque exige la cadena de UI «Orbitar alrededor de la selección» que ya no figura en `ViewBar.vue`. Se aisló este único caso histórico preexistente con `--test-skip-pattern='G004-15:'`; no se alteró producción para ocultarlo.
- Prueba Electron de Object Mode preparada usando la fixture real de `OrbitControls`. **NO VERIFICADO:** no hay `node_modules`/Vite en este entorno.
- Build Editor/Player: **NO VERIFICADO** (`vite: not found`, código 127).
- QA visual y Pointer Lock nativo Linux X11/Wayland y Windows: **PENDIENTE**.

## QA local (raíz del SOURCE_BASELINE entregado)

Si no están instaladas las dependencias: `npm ci`.

```bash
node --test scripts/test-editor-camera-continuous-objectmode-g001.mjs
node --test scripts/test-editor-camera-continuous-grab-g001.mjs
node --test scripts/test-editor-camera-continuous-objectmode-electron-g001.mjs
npm run build
npm run electron
```

**Esperado:** 14/14 OCG Node PASS, 16/16 ECG Node PASS, una prueba Electron PASS con 16 verificaciones WebGL2, build Editor/Player sin errores. Las advertencias de Vite deben distinguirse de errores de compilación.

## Escenarios de aceptación manual

1. Object Mode, sin Edit Mode: orbitar con MMB, cruzar repetidamente los cuatro bordes y comprobar cursor virtual envolvente y cámara continua.
2. Repetir en perspectiva y ortográfica; desplazar con Shift+MMB y Shift+RMB.
3. Alt+LMB orbita, Espacio+LMB desplaza; clic izquierdo normal selecciona sin capturar el cursor.
4. Botón derecho y WASD permiten vuelo sin saltos ni deltas duplicados; al soltar se libera el puntero.
5. Con un objeto seleccionado, mover/rotar/escalar con los gizmos sigue utilizando Continuous Grab y el Snap existente.
6. Entrar en Edit Mode y repetir los gestos; Edit Mode conserva Bevel, Shift/Snap y transformaciones G/R/S.
7. Escape, pérdida de foco y cambiar de escena o entrar en Play deben liberar Cursor/Pointer Lock. En Player no debe capturarse la navegación del Editor.
8. Comprobar que selección normal, menú contextual de Edit Mode y demás herramientas continúan funcionando.

**Evidencia para cerrar:** salida Node, Electron, `npm run build`, vídeo corto del cruce de bordes en Object Mode, sistema de ventanas (X11 o Wayland) y aprobación expresa del usuario. El Gate `LF-EDITOR-INSPECTOR-TRANSFORM-RESET-G001` permanece pendiente y fuera de alcance.
