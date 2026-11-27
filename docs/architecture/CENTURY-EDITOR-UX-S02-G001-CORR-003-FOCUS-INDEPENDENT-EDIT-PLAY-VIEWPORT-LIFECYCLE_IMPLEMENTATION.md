# Century — Edit/Play independientes del foco (CORR-003)

## Fuente, autoridad y delimitación

- Gate autorizado: `Listo. CENTURY-EDITOR-UX-S02-G001-CORR-003-FOCUS-INDEPENDENT-EDIT-PLAY-VIEWPORT-LIFECYCLE autoriza comenzar`.
- Autoridad contractual previa: `CE-EDITOR-UX-CA-001-EDIT-PLAY-INDEPENDENT-AUTHORITY-AND-DOCKING`, ratificada; no se introduce Amendment adicional.
- Fuente de cambios: `SOURCE_BASELINE` íntegro de CORR-002. Auditoría previa: 3287 entradas del ZIP comparadas con la copia de trabajo; 0 faltantes, 0 diferencias y 0 archivos de proyecto adicionales. No hay repositorio Git en el ZIP.
- Se preservan la sesión única `PlayMode`, el dock existente y los diagnósticos de frustum/occlusion de CORR-002.

## Problema acreditado en la fuente

Con Play detenido, `App.vue` montaba el canvas principal en `sceneView`, mientras `SceneRuntimeObserver` solo existía en Play o con `store.gameView.on`. Activar la pestaña `gameView` antes de Play invocaba `Editor.setGameView(true)` y desplazaba la autoridad del viewport principal, en lugar de montar un visor de juego independiente. Una vista Play abierta podía permanecer negra y su estado dependía de cuál de las dos vistas recibía el foco.

## Solución implementada

1. `App.vue` asigna el viewport principal por estado de ejecución, no por foco: `sceneView` antes de Play y `gameView` durante Play. El observador secundario, ya existente, ocupa el panel opuesto mientras este esté activo. Su variante cambia entre `game` (vista previa de cámara antes de Play) y `scene` (observador editorial durante Play).
2. `view-dock-session.js` solo cambia la vista global con `Editor.setGameView` en modos no escritorio; en escritorio, seleccionar una pestaña central modifica foco y docking, no cámara ni simulación. Conserva la limpieza del input al pasar a Edit Mode durante Play.
3. `camera-tools.js` expone la resolución de cámara de vista previa con los mecanismos ya existentes de `sceneGameConfig`, `resolveMainCamera` y `placeCameraNode`. Su filtro temporal de visuales editoriales se reutiliza desde el visor secundario. Se restauran los estados incluso si falla el dibujo.
4. `SceneRuntimeObserver.vue` reutiliza **su único renderer secundario** para la cámara pre-Play. En este modo no conecta los gizmos ni la navegación editorial ni crea una segunda instancia de `PlayMode`. Muestra un aviso cuando no existe cámara válida. Respeta la relación de aspecto y la escala de la vista de juego; la representación usa el renderer WebGL del observador, no una instancia del compositor completo del viewport principal.
5. `ViewBar.vue` atiende al foco editorial en escritorio. `DockFloating.vue` y las superficies de Edit/Play trasladan el foco al interactuar, sin alterar el ciclo de vida de los renderizadores. Los paneles de pestañas realmente inactivos no montan el render secundario; al restaurarlos se reacondiciona su tamaño y se actualiza el frame.

## QA y limitaciones

- 8/8 pruebas nuevas PASS; batería focalizada acumulada 43/43 PASS.
- Regresión ampliada 93/95 PASS: `DOCK-30` y `DOCK-C09` continúan fallando como en el baseline anterior; no se atribuyen aquí a la corrección.
- Dominio (selección, inspector múltiple, oclusión y malla): 61/61 PASS.
- Sintaxis de los módulos JS y `<script setup>` modificados: PASS. Esta verificación no equivale a compilación Vue.
- `npm run build`: no ejecutable (`vite: not found`). La prueba Three real está bloqueada por el paquete faltante. Electron/WebGL2, cámaras, Jolt y QA visual de The Room: **NO VERIFICADO**.
- El observador pre-Play dibuja la escena mediante Three; puede diferir de efectos de posprocesado del compositor completo de Play. No se declara paridad visual completa ni rendimiento GPU sin QA local.
- Persistencia aislada de cambios editoriales durante Play y las herramientas especializadas de Edit Mesh/pintura continúan fuera del alcance y sin validación integral desde CORR-001.

**Estado:** IMPLEMENTADO EN FUENTE · TESTS NODE ACOTADOS PASS · BUILD BLOQUEADO · QA VISUAL NO VERIFICADO · NO APROBADO · NO CERRADO.
