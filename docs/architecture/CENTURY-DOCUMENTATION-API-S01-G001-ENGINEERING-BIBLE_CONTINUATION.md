# Biblia Técnica de Century Engine — continuación autorizada

La ratificación amplía el Gate documental existente, sin crear otro Sprint. El manual de autoría y la Biblia de ingeniería se publican en grupos separados. La Biblia original (139 páginas) permanece byte a byte en `docs/biblia/historico/`. Se parte del ZIP CONT de 4.204 archivos; las diferencias del árbol local del usuario no son accesibles.

## Implementación

- Capítulos de autoría en `docs/biblia/`; inventarios AST y léxicos en `scripts/gen-engineering-bible.mjs`, consumidos por el generador existente del portal.
- El PDF deriva del mismo contenido del portal mediante `scripts/export-engineering-bible.py`. WeasyPrint es una herramienta externa opcional de documentación, no una dependencia de Century. No se alteran las dependencias npm.
- Los inventarios recorren las raíces fuente declaradas, scripts, fixtures, documentos de arquitectura, dependencias raíz y suites; la presencia de un archivo no certifica su uso. Imports literales resueltos, símbolos AST, props/emits detectables y tokens CSS son índices de navegación, no un análisis semántico completo ni una auditoría de licencias.
- La comprobación de separación de las páginas de uso sigue vigente. Los detalles internos se publican solo en el grupo de ingeniería, conforme a la ampliación ratificada.
- No se modifica API, runtime, componentes de juego ni la extensión. La futura colocación cardinal no se implementa en este Gate.

## Límites

Contratos históricos indexados, no ratificados de nuevo. Discrepancias API, JSDoc pendiente y VSIX del Gate anterior se mantienen abiertos. La Biblia no certifica build, Electron, rendimiento ni ejecución distribuida.
