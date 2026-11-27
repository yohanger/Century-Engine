# LF-EDITOR-CAMERA-CONTINUOUS-GRAB-G001 — Navegación continua en Edit Mode

Estado: IMPLEMENTADO; regresión Node PASS; Electron, build y QA local NO VERIFICADOS.

## Contrato aplicado

En Edit Mode, los gestos de navegación con botón central (órbita), Shift + botón central (desplazamiento), Alt + botón izquierdo (órbita), Alt + Shift + botón izquierdo o Espacio + izquierdo (desplazamiento), Shift + botón derecho (desplazamiento) y botón derecho (vuelo) pueden utilizar desplazamiento ilimitado mediante el **mismo ContinuousGrab** propiedad del Editor. El cursor virtual reaparece en el borde contrario del viewport; no se altera el cursor físico.

En `src/core/editor.js`, `Viewport.setEditNavigation()` recibe una consulta dinámica de `this.edit` y la instancia `this._continuousGrab` ya construida para los gizmos. No existe un segundo cursor ni un estado persistente de Edit Mode en Viewport.

En `viewport-nav.js`, `_bindContinuousNavigation()` se instala después de los handlers oficiales de `OrbitControls` y vuelo. Se conserva el evento nativo original para que funcione el fallback si Electron/OS deniega Pointer Lock. Cuando la captura se obtiene, el `ContinuousGrab` detiene la propagación del evento `pointermove` y envía sus deltas **una sola vez** a `_orbitBy()`, `_panBy()` o `_flyRotate()` según el gesto. La órbita conserva la sensibilidad preferida y el rango polar de OrbitControls en función de la altura del viewport; las vistas rápidas mantienen su restricción anterior. La navegación derecha requiere que el vuelo real ya esté activo; Shift + derecho requiere controles habilitados.

`EditSession` conserva el menú contextual para clic derecho corto, pero no lo abre al terminar un arrastre continuo. Tampoco selecciona geometría por error después de un arrastre de navegación. Al salir de Edit Mode, cancelar, perder foco o destruir Viewport se libera el gesto y se oculta el cursor virtual.

## Límites

- No se alteran las transformaciones, Snap, Bevel, eventos del Player ni operaciones normales de selección.
- `OrbitControls` es un addon oficial; no se modifica su código.
- Pointer Lock depende de un gesto humano y de las capacidades de Electron/OS. La fixture gráfica simula su adquisición para automatizar el resto; **no acredita la captura nativa en X11/Wayland ni Windows**.
- No se alteran ni registran coordenadas de escenas o proyectos de usuario.

## Archivos de producción afectados

- `src/core/editor.js`
- `src/core/editor/meshedit.js`
- `src/core/mesh/session-input.js`
- `src/engine/runtime/render/viewport.js`
- `src/engine/runtime/render/viewport-nav.js`

## QA y aceptación

- Node: `scripts/test-editor-camera-continuous-grab-g001.mjs` (16 casos PASS).
- Regresión focal: 17 suites, 288 tests PASS tras primera integración; ejecutar de nuevo sobre la entrega final.
- Electron: `scripts/test-editor-camera-continuous-grab-electron-g001.mjs` y fixture `scripts/fixtures/editor/camera-continuous-grab-g001.html`; NO EJECUTADA en este entorno por falta de node_modules.
- Build Editor/Player: NO VERIFICADO aquí.
- QA local usuario: pendiente. Sin QA local no declarar READY, FIXED o CERRADO.
