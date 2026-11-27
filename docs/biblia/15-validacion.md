# Mantenimiento, contratos y QA

## Procedimiento de ingeniería

Localizar el propietario, seguir consumidores e imports, comparar contrato y Amendments vigentes, identificar estado persistente y temporal, revisar recursos y costos, limitar cambios y seleccionar pruebas. El código acredita implementación; los resultados acreditan ejecución; la aprobación y el cierre son estados distintos. Un documento histórico puede estar supersedido. Los inventarios incluyen todos los documentos de arquitectura sin atribuirles vigencia automática.

## Reproducción documental

El portal se genera desde `scripts/gen-docs.mjs`, `gen-docs-web.mjs` y el inventario `gen-engineering-bible.mjs`. `npm run docs:build` y `npm run docs:check` mantienen HTML y referencias; `python3 scripts/export-engineering-bible.py` produce la Biblia PDF desde las mismas páginas del portal (requiere WeasyPrint para exportar PDF, no para ejecutar Century). La sección de ingeniería está separada de las páginas de uso; la búsqueda local del portal cubre ambas.

## Límites de esta edición

No hay acceso al árbol local posterior al ZIP. No se ha revalidado cada contrato histórico, ni probado ejecución, GPU, compilación, Electron, AppImage o licencias de todas las dependencias. Los hallazgos de API de la continuación previa siguen abiertos. Los inventarios incluyen código vendorizado y declaraciones históricas; no clasifican automáticamente la actividad efectiva de cada archivo. Los resultados de pruebas deben leerse en las evidencias del Gate correspondiente. La Biblia original conserva su valor histórico y no debe sobrescribirse.

