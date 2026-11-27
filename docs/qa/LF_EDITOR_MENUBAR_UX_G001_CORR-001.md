# LF-EDITOR-MENUBAR-UX-G001_CORR-001

## Causa confirmada

La barra usa `store.menu` para Archivo/Editar/Ver/Juego/Ayuda/Malla, mientras que Añadir usa `store.addModal`. `openAddMenu()` no cerraba `store.menu`, y `openMenu()` no cerraba `store.addModal`; por ello coexistían dos overlays.

## Corrección

- `MenuBar.vue`: una selección activa derivada de ambos estados; transición excluyente y toggle coherente. El trigger se marca para no cerrar Añadir prematuramente durante pointerdown.
- `commands.js`: al abrir Añadir, cerrar el dropdown anterior; se conserva el registro de comandos y el panel especializado.
- `AddModal.vue`: el clic en un botón de menubar lo resuelve la propia barra; el clic exterior sigue cerrando el panel.

## QA

Pruebas estructurales y de contratos de estado: `node --test scripts/test-editor-menubar-ux-g001*.mjs`. La validación de interacción real, build y Electron debe ejecutarse localmente; no se afirma QA visual PASS.

## No alterado

Event Order Flow, ECS, escenas, runtime, Player y formato de proyecto.
