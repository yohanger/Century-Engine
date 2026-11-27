> **Enmienda posterior vigente:** `LF-VFX-INSPECTOR-CA-001` reemplaza la ventana flotante y el estado modal descritos aquí por el Inspector. Historial S03 conservado; las garantías del recurso y preview siguen vigentes.

# LevelForge — LF-VFX-S03-G001 · Implementación del editor VFX

Fecha: 2026-10-29. Gate **AUTORIZADO** mediante «Listo. LF-VFX-S03-G001 autoriza comenzar».

## SOURCE_BASELINE y alcance

Fuente: `LevelForge_VFX_S02_G002_SOURCE_BASELINE.zip`, acumulado de S01/S02. No se sustituyó el motor, la UI de Assets, la física ni Event Order Flow. Se preserva `project.vfx` como documento canónico.

## Integración concreta

- `ProjectPanel.vue`: doble clic y menú contextual de `.vfx` llaman `openVfxEditor`, no duplican archivos.
- `state/vfx.js`: apertura/cierre usan `store.modal`, `vfxEditId` y la API existente `updateVfx`/`finishVfxEdit` para validación y Undo/Redo por gesto.
- `App.vue`: monta el workspace mediante un componente único reutilizando `FloatingEditorWindow.vue`. La ventana es movible y dimensionada por el sistema actual.
- `VfxEditor.vue`: emisión, nacimiento, movimiento, apariencia, evolución, controles de transporte; `NumberField` real, selectores, controles de color y textura por referencia ID.
- `VfxCurveEditor.vue` + `vfx-curves.js`: edición de puntos de tamaño, opacidad y color con límites por esquema, arrastre y extremos inmóviles; inserción/eliminación limitada a 2..32 puntos.
- `vfx-preview.js`: instancia temporal `VfxSimulation` + `VfxBillboardRenderer` sobre `vp.scene`, usando **el mismo renderer y el mismo ciclo de frames** del `Viewport`; no modifica escenas, `project.objects` ni recursos exportados. Pausa, play, paso, reinicio, textura cargada por el caché de sprites.
- `Viewport.onFrame`: ahora devuelve un callback de desvinculación, sin romper los llamadores que ignoran el retorno. La sesión VFX retira su callback y recursos al salir.

La preview toma un snapshot con `saveEditorView()` antes de mover su cámara, oculta temporalmente `world`, `overlay` y grid, y restaura poses, proyección, controles y visibilidad al cerrar. El módulo de render VFX nunca es propietario de las texturas compartidas.

## Restricciones y decisiones

No hay preset café ni escena de demostración de tazas (S03-G002). No se han cambiado NodeLifecycle, Player, paquetes ni archivos del sistema de eventos. No se instalaron dependencias adicionales. La previsualización ocupa el viewport existente **detrás** de la ventana flotante; se puede mover la ventana para despejar el efecto. La preview es local/editorial; no promete exportación de vídeo.

## Evidencia y límites

- Ejecutadas: 8/8 pruebas nuevas de operadores de curva, esquema y sesión con dobles de WebGL; 40/40 de simulación e historial/proyecto anteriores. Total **48/48 Node PASS**.
- Preparado, **NO VERIFICADO**: `scripts/test-vfx-ui-s03-g001.mjs` abre el Editor Vue real en Chromium sobre Vite y comprueba apertura, edición, Undo/Redo, curvas, cierre y restauración. El render de GPU en el editor real tampoco está acreditado.
- Compilación Editor/Player y QA gráfico en 1280×720 y 1024×768: **NO VERIFICADOS** en este entorno. `npm ci --offline` falla por falta de tarball `zip-stream`; el intento de instalar online no concluyó antes del límite. No declaramos PASS inexistentes.

## Siguiente acción

Usuario: ejecutar los tests y build, verificar escenario de prueba real y devolver logs/capturas; aprobar o solicitar corrección. Solo después se cerrará G001 y podrá prepararse S03-G002.
