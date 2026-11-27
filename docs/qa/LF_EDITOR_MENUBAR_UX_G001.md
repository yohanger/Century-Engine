# LF-EDITOR-MENUBAR-UX-G001

Baseline: LevelForge_EDITOR_HUB_POLISH_G001_SOURCE_BASELINE.zip

Cambios: MenuBar.vue abre y alterna dropdowns anclados, con estado activo y aria-expanded; ContextMenu.vue permite interacción con la barra superior sin velo modal bloqueante, cierra por Escape/clic exterior, y recalcula la posición al cambiar de menú. Se preservan los comandos y el registro MENUS.

QA automatizado: `node --test scripts/test-editor-menubar-ux-g001.mjs` — 2 PASS. Son verificaciones estructurales, no pruebas de interacción real. `npm run build` y QA visual Electron pendientes. No se ha alterado Event Order Flow ni Player.

Pendientes de aceptación: comprobar menús largos, clic exterior, submenús, navegación por teclado y comportamiento en ventanas pequeñas. La navegación completa por teclado no queda acreditada con estas pruebas.
