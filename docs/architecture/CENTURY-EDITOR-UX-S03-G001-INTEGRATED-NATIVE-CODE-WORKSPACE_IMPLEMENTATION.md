# CENTURY-EDITOR-UX-S03-G001-INTEGRATED-NATIVE-CODE-WORKSPACE

## Autoridad

`CE-EDITOR-UX-CA-002-INTEGRATED-CODE-WORKSPACE-AUTHORITY` ratificado. Gate literal autorizado por el usuario. Fuente: SOURCE_BASELINE de CORR-005, verificado archivo por archivo (3315/3315 archivos coinciden).

## Resultado en fuente

- `src/core/editor/docking.js`: registra `codeView` como vista central requerida. La normalización repara layouts guardados sin Code y descarta el panel inferior obsoleto `scriptEditor`; Edit/Play siguen obligatorios.
- `src/core/editor/view-dock-session.js`: `activateCodeDock` cambia el foco lógico a Code, conserva `store.play.on`, no fuerza `setGameView`, selecciona el primer script existente si aún no hay documento abierto y libera teclas de jugador al cambiar de vista.
- `src/core/state/database.js`: las aperturas de `openScriptEditor(id)` usan Code en escritorio, con el mismo `scriptEditId` y los setters del store; no hacen `focusNativeTool('code')`.
- `src/components/Toolbar.vue` y `DockTree.vue`: acceso Code junto a Edit/Play y selección por docking. La ruta del menú de paneles converge en el mismo activador.
- `src/components/ScriptEditor.vue`: en móvil conserva el cierre del editor flotante; en escritorio la vista Code es obligatoria. Reutiliza CodeMirror, IntelliSense, navegación, métodos, búsqueda, formateo, estado de documento, guardado y VS Code. Se aloja en `codeView`, sin `native-tool="code"`, y continúa disponible aun cuando no hay scripts.
- `src/components/FloatingEditorWindow.vue`: para Code, resuelve el elemento de docking realmente montado y preserva un host oculto al reconstruirse el grupo. Code puede flotar sin una segunda instancia. No ofrece cerrar la vista obligatoria.
- `src/components/DockPanelBank.vue`: el host oculto de Code se registra dentro de los destinos especiales; no monta otro editor.
- `src/App.vue`: monta una sola instancia de ScriptEditor mientras el proyecto de escritorio esté abierto, evita una segunda ventana flotante y oculta la barra específica del viewport al mostrar Code.

## Alcance excluido

No se cambian Three.js, Jolt, Timeline, VS Code, esquema de scripts, método de ejecución, cámara, runtime ni datos guardados. No se añaden paquetes, licencias ni costes externos. Los assets de proyectos anteriores no se migran.

## Limitaciones y riesgos

Los tests con fuentes estáticas demuestran estructura y rutas de selección, no el render real de CodeMirror ni el comportamiento de Electron. El contenedor reutilizado depende de Vue Teleport, cuyo cambio de destino se debe comprobar con pestañas, divisiones y ventanas flotantes. Compilación y QA Electron no se han acreditado.

## Aceptación pendiente

Abrir The Room; pulsar Code con y sin scripts; crear script; doble clic desde Proyecto; modificar y guardar; alternar Edit/Play/Code; iniciar Play y regresar a Code sin detener; dividir y flotar Code; cambiar proyecto y restaurar layout; confirmar que no se abre otra ventana de Electron y que VS Code solo se abre al solicitarlo. Verificar que el script persiste al regresar a Code.
