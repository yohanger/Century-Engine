# Inspector profesional de Edit Mesh

Gate ratificado y autorizado literalmente: `CENTURY-EDITOR-MESH-S02-G001-PROFESSIONAL-EDIT-MESH-INSPECTOR-UX`. El usuario aprobó el Gate anterior de integridad de gizmos. Baseline de entrada: `CENTURY_EDITOR_GIZMOS_S01_G001_CORR002_SOURCE_BASELINE.zip`, 3907 archivos comparados byte a byte con la copia disponible, sin diferencias. No se inspeccionó el equipo local del usuario. Madurez preestable; no se requieren migraciones ni se eliminan archivos. El identificador completo diferencia este Gate del anterior S02-G001 de Subtract; no se reescribe su contrato ni su historial.

## Alcance y autoridad

- Extender `MeshPanel.vue` e `InspectorDock.vue` para compartir el buscador, la identidad semántica de las secciones, las preferencias `inspFold`, los iconos y controles nativos; mantener las operaciones existentes. Mostrar selector de modo, estadísticas seleccionadas/totales, transformación horizontal XYZ, herramientas agrupadas con atajos y secciones plegables. Colapsar las secundarias inicialmente; la búsqueda abre coincidencias temporalmente sin cambiar la preferencia.
- Priorizar los controles de la operación modal existente. El valor principal, los segmentos activos y la confirmación/cancelación son propiedad de `EditSession`. Los ajustes contextuales complementarios solo usan los parámetros que la operación ya consulta; mantener acceso explícito a los demás valores por defecto. No inventar parámetros o algoritmos de modelado.
- Conservar todas las conexiones de comandos, eventos, campos numéricos, UV, pintura, pivote, construcción, limpieza, topología, física, Snap, Modo Local, historial y atajos. No añadir dependencias ni alterar Player, geometría, formato de escena o motor.
- Usar estilos y tooltips existentes; mantener avisos de error, diagnóstico y límites relevantes. Ajustar controles a anchos reducidos. No se introducen contextos GPU ni renderizadores; el coste de renderizado de la previsualización UV existente no cambia intencionalmente y queda por medir.

## Evidencia y conflictos

QA específico Node, comparación de regresiones con el mismo baseline, sintaxis JS, compilación y runner Electron con el InspectorDock y EditSession reales. QA visual y medición de rendimiento local son requisitos pendientes si el entorno no permite ejecutarlos. No se ratifica cierre sin evidencia y aprobación. Contrato de plegado global LF-INSPECTOR-GLOBAL-UX-CLEANUP-S13-G001 y contratos de modelado previos se conservan; no se detecta conflicto que requiera sustituirlos.
