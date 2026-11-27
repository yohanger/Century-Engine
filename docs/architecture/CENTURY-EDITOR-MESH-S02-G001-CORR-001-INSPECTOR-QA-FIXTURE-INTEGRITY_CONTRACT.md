# Integridad del fixture de QA del Inspector Edit Mesh

Gate ratificado y autorizado literalmente: `CENTURY-EDITOR-MESH-S02-G001-CORR-001-INSPECTOR-QA-FIXTURE-INTEGRITY`. Baseline de entrada: `CENTURY_EDITOR_MESH_S02_G001_INSPECTOR_UX_SOURCE_BASELINE.zip` (3921 archivos comparados byte por byte con la copia disponible, sin diferencias ni archivos adicionales). El equipo local del usuario no es accesible. El Gate de UX principal está pendiente de aprobación; se autoriza esta corrección sobre su entrega acumulativa.

## Autoridad y alcance

El fixture compartido debe inicializar un proyecto válido mediante `createProjectData` y conservar las condiciones explícitas de su escenario de malla, incluida la geometría vinculada opcional, el terreno desactivado, Snap y el historial real. Se preservan las 19 comprobaciones Electron del Gate original y las assertions existentes. Se permite añadir pruebas de diagnóstico y regresión. Sin cambios en fuentes productivas, estilos, algoritmos, contratos de modelado, dependencias, licencias, formato de proyectos ni migraciones. No se elimina ningún archivo ni se altera el historial documental.

## Evidencia y aceptación

El usuario aportó un fallo Electron anterior a la primera comprobación: `layerName` recibió un registro de capas indefinido desde `TagLayerRow`. El Inspector de objetos sigue montado aunque oculto en el dock de malla. El diagnóstico del registro incompleto es reproducible mediante la función de capas real. QA integrado de la corrección requiere Vite y Electron instalados; pruebas Node de contrato y de capas no equivalen a montaje real. La causa de cualquier fallo posterior se investigará según evidencia. No hay conflicto que requiera sustituir el contrato UX principal.
