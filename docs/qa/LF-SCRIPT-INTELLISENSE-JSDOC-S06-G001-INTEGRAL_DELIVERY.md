# Entrega S06 JSDoc · Instalación y continuidad

- Baseline de entrada: `LevelForge_UI_DESIGNER_PRO_UX_S05_G001_INTEGRAL_CLOSE_SOURCE_BASELINE.zip`.
- CHANGE contiene únicamente los archivos afectados y permite aplicar S06 sobre **una copia idéntica** de esa base, tras comparar cambios locales.
- SOURCE_BASELINE contiene el proyecto acumulado y será el único candidato a base del siguiente Gate después de QA local y aprobación.
- **No extraer ambos ZIP uno sobre otro.** Conservar el baseline anterior y proyectos/Assets/escenas locales. No reemplazar cambios locales sin comparación.
- Se excluyen `node_modules`, `dist`, `dist-player`, cachés, temporales y scripts de shell.
- Tras extracción limpia, ejecutar la matriz de QA en el documento correspondiente. No eliminar el baseline anterior hasta aceptación del usuario.
- Los permisos Unix del Git embebido se conservan `0755` en los tres ejecutables Linux.
- El inventario exacto de nuevos/modificados/eliminados se comprobará contra el ZIP de entrada antes del empaquetado definitivo.
