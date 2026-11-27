# Escape en propiedades del Editor — Implementación

**Gate:** `CENTURY-EDITOR-UX-S01-G001-ESCAPE-PROPERTY-FOCUS-RELEASE`

**SOURCE_BASELINE:** archivo `source_basline.zip` proporcionado por el usuario. Se preservaron sus modificaciones locales frente al baseline anterior (selección del editor, Substract, pruebas y VSIX).

## Diagnóstico

Los controles nativos de propiedades no tenían un manejo común de Escape; `NumberField` y `TextField` sí cancelaban su borrador. Además, `AppWindow` trataba Escape propagado desde cualquier campo como cierre de la ventana. Los editores de código, los controles modales y la captura de teclas poseen rutas prioritarias que deben conservarse.

## Implementación

- `src/core/editor/property-focus.js`: función compartida que intercepta Escape sobre `input`, `textarea`, `select` y `contenteditable`, liberando exclusivamente el foco activo. Si el control ya gestionó Escape (`defaultPrevented`), impide una segunda acción sin alterar su decisión. No interfiere con IME ni con CodeMirror, reconocido mediante la ruta de propagación del evento.
- `src/core/editor/keys.js`: registra el controlador en el documento durante la vida del editor y lo retira en cleanup. Se utiliza la fase de burbujeo, dejando primero actuar a los controles internos y operaciones modales; se detiene la propagación antes de los atajos globales.
- `src/components/AppWindow.vue`: reutiliza el mismo controlador antes de cerrar una ventana con Escape. La tecla sale del campo editable, sin cerrar la ventana, y sigue cerrando la ventana si el foco está fuera de una propiedad y no fue manejada anteriormente.
- `scripts/test-editor-escape-property-focus.mjs`: pruebas de la función y ejecución de la rama `onEsc` extraída del componente real.
- `scripts/qa-suites.json`: nueva suite `escape-property-focus` con regresión dirigida.

## Compatibilidad y límites

Se conserva el comportamiento de borradores de `NumberField` y `TextField`, los selectores modales, CodeMirror, las herramientas modales de Edit Mesh y la captura global de entradas. No se alteran el core de geometría, CSG, `setPointerCapture`, CSP ni la lógica de Undo/Redo. La prioridad de Escape de un control específico que ya detiene la propagación sigue siendo de ese control.

Los controles nativos sin gestión previa confirman sus cambios según la lógica existente en `blur`; no se fuerza una cancelación de valores nativa ni se altera el almacenamiento.

## Validación

Consultar `docs/qa/CENTURY-EDITOR-UX-S01-G001-ESCAPE-PROPERTY-FOCUS-RELEASE_EVIDENCE.md`. La validación visual en Electron y la compilación siguen pendientes en este entorno.
