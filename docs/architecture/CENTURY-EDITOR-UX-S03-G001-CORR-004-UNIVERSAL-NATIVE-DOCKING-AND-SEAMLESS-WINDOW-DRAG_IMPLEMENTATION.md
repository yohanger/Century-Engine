# CENTURY-EDITOR-UX-S03-G001-CORR-004-UNIVERSAL-NATIVE-DOCKING-AND-SEAMLESS-WINDOW-DRAG — Implementación en fuente

## Objetivo y baseline

Se parte exclusivamente de `S03-G001-CORR-003` (`SOURCE_BASELINE`) y del Amendment `CE-EDITOR-DOCKING-CA-003`. No hay datos Git en la fuente entregada; no se pueden acreditar cambios locales externos al ZIP.

## Mecanismo

- `docking.js` registra paneles de recursos; permite destinos centrales para paneles opcionales y conserva tres vistas obligatorias.
- `native-dock.js` centraliza los umbrales de 12/24 px y la solicitud de apertura/retorno.
- `dock-gesture.js` reconoce movimiento del puntero antes de `pointerup`, no captura el clic inicial y usa la misma autoridad para la barra superior y las pestañas.
- `DockTree.vue` adopta el gesto de puntero; `DockFloating.vue` traslada los paneles generales mediante `AppWindow` a ventanas Electron.
- `native-tool-window.js` y `native-tool-registry.js` mantienen un único contenido, sincronizan CSS mediante Teleport y exponen identificación y movimiento de la ventana auxiliar.
- `electron/main.cjs` autoriza herramientas conocidas y paneles registrados, las presenta de modo no modal y admite solicitudes de posición desde el editor autorizado.
- `App.vue`, `DockPanelBank.vue`, `FloatingEditorWindow.vue` y `AppWindow.vue` integran el ciclo de ventanas; Event, Shader, Graph, UI, Database, Localization, Tema y Documentación conservan sus editores originales y se acoplan bajo demanda.
- El observador y las vistas obligatorias recuperan destino/canvas tras cambios nativos del docking.

## Restricciones

Se mantiene el store y la instancia documental únicos. No se alteran los modelos Event, Database, UI, Shader ni sus sistemas de persistencia. No se tocan clases de física o runtime del jugador.

**Límite abierto:** la transferencia exacta de control del puntero entre un drag HTML y una ventana del sistema operativo depende de Electron, compositor y gestor de ventanas. Las pruebas de lógica no certifican continuidad del gesto en dos monitores, ni posicionamiento en Wayland.

**Estado:** código implementado, suite parcial PASS; compilación y QA visual no verificados. No aprobado ni cerrado.
