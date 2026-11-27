> **Enmienda posterior:** `LF-EDITOR-VIEWBAR-UX-CA-002` autoriza únicamente el icono para alternar Ratón/Trackpad en ViewBar. Permanecen en Ver el render del viewport y las operaciones avanzadas.

# LF-EDITOR-VIEWBAR-UX-G001 — Organización del visor

**Baseline autorizado:** `LevelForge_ASSETS_SLOT_DND_S01_G004_SOURCE_BASELINE.zip`.
**Autorización:** `Listo. LF-EDITOR-VIEWBAR-UX-G001 autoriza comenzar`.

## Auditoría y diagnóstico

**Observado:** `ViewBar.vue` repetía ajustes que ya estaban en `PreferencesModal.vue` o el catálogo de comandos `commands.js`: tamaño de gizmo, elección ratón/trackpad, órbita alrededor de selección, acciones de cámara y el método de render del visor. `editorFov` estaba en `store.prefs` con valor predeterminado 90°, se aplicaba mediante `viewport.applyPrefs()`, pero se editaba en ViewBar. `store.view.renderMethod` es el override de render (Editor/Play); `project.render` es la configuración persistida para exportación. El menú Ver ya incluía operaciones de cámara y navegación, y el menú Juego ya abría los ajustes permanentes.

**Inferencia:** la duplicación distrae en Edit Mesh y dificulta distinguir ajustes globales de operaciones de vista.

**Causa raíz:** ubicación redundante de controles; no falta un sistema de preferencias o un renderer.

## Cambios de este Gate

- `ViewBar.vue` conserva las pestañas **Escena/Juego**, toggles editoriales y atajos de vistas + encuadrado; elimina los controles redundantes de FOV, tamaño de gizmos, navegación, órbita, operaciones avanzadas de cámara y renderer. No altera la barra contextual de Edit Mesh.
- `PreferencesModal.vue` incorpora **Cámara del editor → FOV horizontal** (40–120°, predeterminado 90°) y restaura 90° mediante el botón de restablecimiento existente. Respeta `store.prefs.editorFov`, su persistencia en `levelforge:prefs` y la actualización de `viewport.applyPrefs()`. Se ajusta la descripción de tamaño de gizmos; navegación ratón/trackpad continúa en el mismo panel.
- `commands.js` añade el submenú **Ver → Render del viewport** con opción **Usar render del proyecto** y las opciones `RENDERERS` existentes. Solo escribe `store.view.renderMethod`; `project.render` y los ajustes exportados permanecen intactos. Las acciones de cámara y navegación ya existentes continúan en Ver.
- El viejo test HF-14 comprobaba literalmente la presencia de FOV en ViewBar. Se actualiza **solo esa aserción de ubicación** al nuevo contrato explícitamente aprobado y se conserva la prueba de conversión de FOV horizontal en el motor. No se altera el cálculo de FOV.

## No incluido

No cambian `GameSettingsModal.vue`, `viewport.js`, `store.view` ni `store.prefs` (esquema), Renderer/Player, exportación, atajos ni código de Edit Mesh. No se crean servicios, ventanas, estilos globales ni estados duplicados. La fuente de verdad sigue siendo `project.render` para el juego y `store.view.renderMethod` para la anulación de trabajo.

## QA y limitaciones

Ver `docs/qa/LF-EDITOR-VIEWBAR-UX-G001_QA.md`. Las pruebas Node abarcan la estructura, el comportamiento extraído de las acciones y regresiones de FOV/Snap. No equivalen al renderizado SFC, compilación Vite ni QA visual de Electron. Si aparece un fallo de empaquetado o de interfaz, no declarar cierre hasta reproducirlo y obtener QA del usuario.

**Pendiente planificado:** S02-G002 refinará el contexto de Edit Mesh; S02-G003 validará la integración del Sprint.
