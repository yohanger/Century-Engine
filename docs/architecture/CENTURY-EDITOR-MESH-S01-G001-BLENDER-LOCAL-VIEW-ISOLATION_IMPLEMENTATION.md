# Century — Modo Local: implementación

Baseline: `CENTURY_EDITOR_SCRIPT_S01_G001_SOURCE_BASELINE.zip`, aprobado expresamente por el usuario antes de este Gate. La comparación de archivos no registra eliminaciones. No se dispone del árbol de trabajo Git del usuario; no se presupone su estado local.

## Integración

- `keys.js` identifica `/` y `NumpadDivide` antes del dispatch de operaciones de malla; conserva las barreras de foco, modo de edición, Play y operaciones modales.
- `meshedit.js` conserva una sesión temporal y un snapshot con `saveEditorView()`. El encuadre se calcula desde los vértices de `EditSession.poly` transformados al espacio mundial, sin los hijos lógicos. `restoreEditorView()` restaura las cámaras de perspectiva y ortográfica.
- `local-mesh-view.js` calcula las ramas hermanas de la cadena de ancestros de la malla. Reutiliza los helpers de visibilidad temporal del observador (extraídos sin cambiar su comportamiento). Conserva la rama visual de edición y las dos luces editoriales. No clona ni desvincula nodos. Oculta durante un dibujo únicamente y restituye los valores en `finally`.
- `Viewport` usa su mismo renderer, escena y cámara en un pase editorial neutro, sin sombras ni postproceso ambiental. Mantiene el indicador de orientación y el registro de rendimiento del dibujo. En Play no utiliza este pase.
- La salida de Edit Mesh, la destrucción de la sesión y la carga de escena limpian el aislamiento; Play ya llama a `exitEditMode` antes de capturar la vista. La captura de cámara por escena usa la vista anterior al aislamiento. Se omite la actualización de miniatura mientras esté activo; la DB conserva la miniatura previa. No se crea una entrada de Undo para activar/desactivar la vista.
- El indicador `Modo Local · /` aparece solo durante el aislamiento. Los diagnósticos visuales del pipeline normal no se presentan durante el pase editorial.

## Límites y estado

Las pruebas específicas acreditan el mecanismo y la integración estática; no acreditan WebGL real, compilación Vue ni QA visual. No se han añadido dependencias ni migraciones, ni se modifican los datos de escena. El cambio compartido de viewport está protegido por el callback exclusivamente editorial y la barrera `!playing`. Ver QA y manifiesto.

Estado: IMPLEMENTADO EN FUENTES · PENDIENTE DE QA LOCAL · NO APROBADO · NO CERRADO.
