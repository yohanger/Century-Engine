# QA de Biblia Técnica

Entrada: CONT SOURCE_BASELINE, 4.204 archivos, CRC correcto. Delta contra anterior: +15, 35 modificados, 0 retirados. No se accede al árbol local del usuario. Original PDF preservado exactamente.

- Portal: 358 páginas, 145 del grupo Biblia Técnica (16 capítulos de autoría y 129 índices). Las 213 páginas anteriores conservan exactamente sus objetos HTML, búsqueda, títulos, toc y resúmenes.
- Inventario: 762/762 rutas de src; 12.404 entradas AST, 131 Vue, 131 nombres de tokens CSS. Imports literales y macros detectables, no grafo de ejecución. 0 diagnósticos sintácticos del parser para los bloques analizados, no un typecheck global.
- Node: 28/28 pruebas documentales/API/Git; docs:check 14/14, comparado con el resultado generado localmente. TypeScript 5.8.3 y Marked 4.0.19 disponibles; no se certifica generación con Marked 12.0.2 fijado por package.json. No se modifican las dependencias declaradas.
- Chromium: file:// bloqueado por política del entorno. Prueba aislada con los mismos recursos inline, sin red, navegación hash, búsqueda CloudVolume y tabla: PASS, sin pageerror. No equivale a ejecución del portal directamente desde disco ni a Electron.
- PDF: 380 páginas A4, 1.419 bookmarks, 435 enlaces, sin páginas vacías detectadas. Renderizadas seis páginas representativas. WeasyPrint 68.0. El PDF y portal comparten contenido; no se certifica revisión visual individual de las 380 páginas.
- Ledger: seis hojas, fila añadida por hoja; comparación de valores/fórmulas existentes preservada.
- No se altera código productivo, API, runtime, VSIX, recursos del juego ni manuales de uso. Los contratos se indexan; no se acredita vigencia de todos. QA local Electron, build, dependencias fijadas, revisión contractual y discrepancias de API previas: pendientes.

Comandos locales: `npm run docs:build`, `npm run docs:check`, `npm run test:suite -- documentation-api`, `npm run test:suite -- documentation-api-electron`. Para regenerar PDF: `python3 scripts/export-engineering-bible.py` (WeasyPrint en entorno documental).
