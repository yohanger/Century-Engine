# CENTURY-EDITOR-UX-S03-G001-CORR-001-PROFESSIONAL-CODE-WORKSPACE-AND-NATIVE-WINDOW-UX

## Autoridad y fuente

Amendment `CE-EDITOR-UX-CA-002-INTEGRATED-CODE-WORKSPACE-AUTHORITY` y Gate correctivo autorizado por el usuario. Baseline anterior: `CENTURY-EDITOR-UX-S03-G001-INTEGRATED-NATIVE-CODE-WORKSPACE_SOURCE_BASELINE.zip`; 3324 archivos de origen, sin `.git` ni dependencias de instalación. No se borró historia, proyecto ni configuración del editor.

## Integración

- `ScriptEditor.vue`: sustituye la hilera de botones por menús Archivo, Editar, Buscar, Ir a, Ver y Ayuda. Los comandos vuelven a usar guardado del store, búsquedas y diagnóstico de CodeMirror, formatCode, referencias API y VS Code opcional. La barra conserva accesos rápidos a navegación y guardado; los métodos y carpetas siguen integrados en un único navegador redimensionable.
- `FloatingEditorWindow.vue`: Code puede maximizarse sin abandonar el docking. En modo concentración la capa se traslada temporalmente al `body` mediante Teleport; al restaurar conserva la disposición del layout. También permite abrir Code bajo demanda en una ventana Electron del mismo proceso y devolverlo al editor al cerrarla.
- `native-tool-window.js`: conserva la autoridad de las ventanas nativas y permite apertura/cierre dinámicos sin abrir una ventana adicional al montar Code. El registro de foco vive en `native-tool-registry.js` para que el docking permanezca independiente de Vue.
- `ScriptEditor.vue`: al cambiar de documento DOM hacia/desde la ventana Electron, recrea la vista CodeMirror con **el mismo EditorState** después de destruir la vista anterior; conserva texto, selección, historial de undo/redo y posición de scroll para evitar dos instancias vivas del editor. No crea otro proyecto ni copia de scripts. Este ciclo necesita QA Electron real.
- `DockTree.vue` y `view-dock-session.js`: mantienen la vista Code obligatoria, indican su presencia en una ventana externa y permiten recuperar el foco de esa ventana desde Century.
- `package.json`/`package-lock.json`: declara directamente `@codemirror/commands@6.11.1`, que ya figuraba en el lock anterior como dependencia transitiva de CodeMirror; no añade un paquete distinto al árbol resuelto.

## Alcance conservado

Sin sustitución de CodeMirror, sin cambios a esquema de scripts, guardado, editor de eventos, VS Code, cámaras, Three, Jolt, runtime Play ni proyectos existentes. No se modificó Git. Se mantienen editabilidad de la selección y reglas de docking.

## Garantías y límites

Las pruebas Node verifican lógica de docking, contrato de comandos y una simulación aislada de apertura/cierre nativo. No prueban la visualización compilada, las interacciones reales en Electron, la corrección del traslado de CodeMirror entre ventanas ni el uso en dos monitores: quedan **NO VERIFICADOS** hasta compilar y hacer QA local.

## Prueba de aceptación pendiente

Abrir The Room; pulsar Code; comprobar menús, atajos, scripts y métodos; modificar texto sin guardar; maximizar/restaurar repetidamente desde Code acoplado y flotante; abrir Code en ventana Electron, moverla a otro monitor, seguir editando, guardar, cerrar ventana y regresar al mismo cursor y documento; alternar Edit/Play/Code durante una simulación; abrir otro script; comprobar que solo existe un editor y no se pierde Undo/Redo. Repetir con un proyecto sin scripts y con Code minimizado/oculto tras pestaña.
