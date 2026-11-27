# S06-G001 · CORR-001 · Fixture FilmMaker

Corrección dentro del Gate S06-G001 autorizado y todavía abierto. Base técnica: entrega S06-G001 de 2.054 archivos; deriva del último baseline aprobado S03-G001. S06 no está aprobado y no se avanza al puente VS Code.

## Evidencia del usuario

El 4 de noviembre de 2026: Node 17/17 PASS; docs:check 12/12 PASS; Electron FAIL en la octava comprobación («Biblioteca excluye películas FilmMaker»); build interrumpido mediante Ctrl+C. QA local no aprobado. El aviso de deprecación Three.js no causó esa aserción. El nombre S03 de la carpeta no prueba una instalación incorrecta: los scripts S06 estaban presentes y la evidencia corresponde al fixture entregado.

## Diagnóstico reproducido

OBSERVADO: createTimeline devuelve el objeto original que insertó en el array reactivo. El fixture creaba un recurso nativo y le asignaba después filmMaker mediante ese objeto original. Con un consumidor computed y un watcher síncrono, la lista permanecía cacheada con tres elementos aunque el filtro directo ya devolvía dos. La mutación a través del proxy del store sí invalidaba la lista.

CAUSA RAÍZ DEL TEST: preparación del fixture mediante una mutación no reactiva que no representa el importador real. importFilm asigna la procedencia antes de insertar el recurso normalizado y confirma la importación mediante el historial existente.

Se reemplaza esa preparación por packNfm + importFilm reales, con una toma y sin montaje adicional. Se conservan los recursos nativos y se comprueba que la colección contiene una película importada mientras la biblioteca mantiene únicamente los dos timelines nativos. Se añade comprobación de exclusión por nombre. No se cambia el filtro, createTimeline, importFilm ni otro código productivo.

La prueba Node nueva reproduce el consumidor reactivo, exporta/importa un NFM y renderiza el TimelinePanel real mediante Vue SSR. Comprueba dos elementos y ausencia del nombre de la película. SSR no acredita layout, eventos del navegador ni Electron.

El fixture Electron completo exige ahora 23 comprobaciones (antes 20 mínimas). No se elimina la aserción que falló ni se rebaja su requisito. La ruta real de importación también produce el commit necesario para que Undo/Redo del duplicado sigan comprobándose correctamente.

## Validación

- Node: 18/18 PASS (17 focales anteriores + una integración nueva de importación, reactividad y render SSR).
- docs:check: PASS, 12/12.
- Electron local del asistente: NO VERIFICADO; el entorno no inicia el renderer. No hay resultado del fixture corregido en Electron ni PASS visual.
- Código de producto idéntico a S06. Se conserva la evidencia de compilación anterior; no se inventa una compilación local del usuario tras Ctrl+C.
- QA local CORR-001: PENDIENTE. Gate abierto.

Los logs finales de esta corrección están en docs/qa/evidence/LF-TIMELINE-LIBRARY-ASSETS-S06-G001-CORR-001/. Se conservan el fallo local del usuario y los resultados históricos.

## Instalación y ejecución

Conservar S03 aprobado, la entrega S06 anterior y los proyectos de juego. Extraer el SOURCE_BASELINE CORR-001 completo en una carpeta nueva:

`~/Desktop/LevelForge_TIMELINE_LIBRARY_ASSETS_S06_G001_CORR_001_SOURCE_BASELINE/`

En la raíz deben quedar package.json, src/, electron/, scripts/ y vendor/. No aplicar CHANGE encima de ese SOURCE_BASELINE ni sobrescribir cambios locales. CHANGE contiene solo nuevos/modificados para inspección o aplicación sobre una copia limpia de la entrega S06 anterior. No hay eliminaciones ni cambios de dependencias. Se excluyen node_modules, dist, dist-player, release y temporales.

Desde la raíz, ejecutar esta cadena: se detiene si falla cualquier paso.

```bash
npm ci &&
node --test --test-concurrency=1 scripts/test-timeline-library-assets-s06-g001.mjs scripts/test-timeline-library-assets-s06-g001-corr-001.mjs &&
node --test scripts/test-timeline-library-assets-s06-g001-electron.mjs &&
npm run docs:check &&
npm run build &&
npm run electron
```

Esperado: 18 pruebas Node PASS; un test Electron PASS con 23 comprobaciones, incluida importación real/exclusión de FilmMaker; docs:check 12/12; Editor/Player compilados. Los resultados Electron y visuales siguen pendientes de ejecución local.

Si falla, devolver la aserción, su lista de checks y el error completo; no continuar ni aprobar el Gate. Si pasa, completar el QA funcional de la guía S06 original. La siguiente acción real es repetir Electron corregido y después el resto del QA, no iniciar el puente local VS Code.
