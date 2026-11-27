# CENTURY-EDITOR-UX-S03-G001-CORR-002-NATIVE-DOCKABLE-CODE-WINDOW-AND-CORNER-ALIGNED-CONTROLS

## Autoridad y fuente

Gate autorizado explícitamente. Se conserva el Amendment `CE-EDITOR-UX-CA-002-INTEGRATED-CODE-WORKSPACE-AUTHORITY`, junto con la autoridad previa de Edit Mode y Play Mode. SOURCE_BASELINE: `CENTURY-EDITOR-UX-S03-G001-CORR-001-PROFESSIONAL-CODE-WORKSPACE-AND-NATIVE-WINDOW-UX_SOURCE_BASELINE.zip` (SHA-256 `51ea318c9fc972132bad04fe8647f2bc288a78b4caadd78d583030de5f82d700`). El ZIP contiene 3334 archivos, sin `.git` ni `node_modules`; sus bytes coinciden con la copia de trabajo previa a este Gate. No se altera el proyecto The Room.

## Corrección

- `DockTree.vue`: tanto el comando Desacoplar de la pestaña Code como el arrastre fuera del docking despachan una única petición de ventana nativa. Se conserva `floatDockPanel()` para otros paneles; Code no pasa por ese mecanismo CSS.
- `FloatingEditorWindow.vue`: consume la petición, abre `native-tool="code"` bajo demanda y permite reacoplar mediante la acción existente. Se conserva el componente único `ScriptEditor.vue`, con autoridad documental en el store. Las distribuciones antiguas que contienen Code como flotante CSS se reubican al docking al montar su vista. Al desprender Code, el editor principal muestra Edit Mode y no queda un panel de Code vacío activo. Maximizar/restaurar dentro del editor sigue siendo distinto de abrir ventana nativa.
- `electron/main.cjs`: para `lf-tool-code`, `did-create-window` separa el BrowserWindow del padre con `setParentWindow(null)` y establece `modal: false`. La ventana principal cierra sus herramientas al finalizar su propio cierre autorizado, evitando ventanas huérfanas. Las otras herramientas mantienen su ruta.
- `view-dock-session.js`: cuando Code está fuera, los accesos a Code traen esa ventana al frente sin sustituir la vista editorial principal.
- `ScriptEditor.vue` y CSS del contenedor: el encabezado agrupa los iconos en el extremo derecho, con un espacio de no solapamiento de 65 px durante docking. En otros modos la barra de menús ocupa toda la anchura disponible. El contenido y CodeMirror no cambian.

## Preservación

Una autoridad de documentos en `store.project.scripts`, una instancia de `ScriptEditor`/CodeMirror, sin proyectos duplicados, sin rediseño ajeno, sin operaciones Git, sin migraciones obligatorias de escenas o recursos. Los `EditorState` y scroll del editor siguen reutilizando el mecanismo existente cuando cambia el documento DOM. No se añade dependencia.

## Límites y aceptación

Las comprobaciones Node acreditan rutas, estados, código del BrowserWindow y el contrato de restauración. La apertura real, interacción con el sistema operativo, segundo monitor, transferencia DOM/CodeMirror y funcionamiento visual dependen del QA Electron local. Sin `node_modules`, la compilación Vite está bloqueada.

Aceptar tras comprobar: Code acoplado, maximizar/restaurar, desacoplar desde botón de pestaña, desde el botón de Code y arrastrando fuera; ventana Electron movible a otro monitor, minimizable y maximizible; editor principal interactivo; reacoplar desde ventana o cerrarla; cambios sin guardar, selección, historial, búsqueda, IntelliSense y guardado conservados; cierre del proyecto/ventana principal sin herramientas huérfanas, y Play sin reinicio.
