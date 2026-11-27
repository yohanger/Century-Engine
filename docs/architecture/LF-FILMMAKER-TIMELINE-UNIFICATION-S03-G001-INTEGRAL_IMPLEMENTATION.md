# LF-FILMMAKER-TIMELINE-UNIFICATION-S03-G001-INTEGRAL

**Estado:** AUTORIZADO; implementación de capacidades compatibles en fuentes; QA local y cierre PENDIENTES. Fecha: 2026-11-05.

## Fuentes verificadas

SOURCE_BASELINE: `LF_CINEMATICS_S07_G001_CORR001_SOURCE_BASELINE.zip`. Los archivos de trabajo se verificaron byte a byte frente al ZIP para el Timeline LevelForge, FilmMaker y el ledger. S07 y S02 mantienen su QA local PENDIENTE.

## Auditoría diferencial

- `src/components/TimelinePanel.vue` es el editor de Timeline gameplay; dispone de regla y selección por ID, zoom, menús de contexto, arrastre de nodos, pistas de método/comandos y evaluación que separa Edit y Player.
- `src/filmmaker/NleTimeline.vue` es el NLE de cine; conserva planos, actor, capas, audio multipista, fundidos, claves y bakes. Usa `session.film.edit` como autoridad y `session.montage.T` para el reloj.
- `newFilm()` ya crea `shots/layers/audio/nodeTracks/physicsBakes` vacíos. Los carriles fijos de la interfaz producían la impresión de contenido de ejemplo; no eran recursos persistidos.
- Los contratos CA-001/CA-002 mantienen una cámara principal estructural; retirarla queda fuera del Gate.
- Las pistas `method/commands` del Timeline de gameplay tienen efectos laterales y no cuentan con contrato de autoría/seguridad equivalente en FilmMaker. No se han habilitado: BLOQUEADO para esa subcapacidad, pendiente de Amendment si se decide incluirla.

## Mecanismo aplicado

1. `core/timeline/model.js` define el cálculo acotado `timelineRulerTicks()` que usan **ambos** componentes originales. Se comparte geometría temporal; no se duplica un estado de reloj o de reproducción.
2. `TimelinePanel.vue` usa el nuevo cálculo sin modificar sus datos o controles temporales.
3. `NleTimeline.vue` adopta escala, cabecera de carriles coherente y barra de creación contextual (mismo lenguaje de Timeline). No muestra carriles ficticios de Planos/Actor/Texto/Efectos cuando no existen. Presenta un estado vacío sin crear recursos.
4. `NleTimeline.vue` utiliza el MIME de Jerarquía `application/x-lf-node` y la infraestructura `store.menu` de LevelForge para añadir pistas de nodos por ID, contextualizar pistas y claves, duplicar/borrar elementos, acceder a interpolación y navegar al cabezal. Añade ajuste a ventana e inicio/final mediante teclado.
5. `montage.js` extiende operaciones **puras** existentes de duplicación de planos, capas y clips de audio, con nuevos IDs y sin mutar el recurso fuente.
6. `node-authoring.js` y `session.js` extienden la misma autoría de claves/historial de FilmMaker a presets Bézier existentes de `anim/model.js`, sin un segundo evaluador. No se duplican estados de edición de Timeline/FilmMaker.
7. La creación de `.nfm`, grabación, bakes, montajes, exportación, Cinematics y Player no cambian de arquitectura ni de formato.

## Límites de verificación

- Pruebas nuevas: 13 PASS/0 FAIL.
- Suites ejecutables FilmMaker/Cinematics/Timeline (27 archivos): 370 PASS, 3 SKIP, 0 FAIL. Los SKIP no se declaran PASS.
- Barrido amplio de 42 suites: 370 PASS, 4 SKIP, 14 errores de ejecución por **dependencias ausentes** (Vite/Electron/JSZip); no se atribuyen a regresiones funcionales. Los 14 casos no están verificados.
- Scripts Vue extraídos: chequeo de sintaxis JavaScript PASS; **no equivale** a compilación SFC ni a QA visual.
- Compilación Editor, Player, FilmMaker, importación `.nfm` real y QA Electron: NO VERIFICADOS.
- Pistas de método/comandos cinematográficas: BLOQUEADAS por ausencia de contrato de ejecución seguro. No se presentan como implementadas.

## Responsabilidades preservadas

Timeline LevelForge conserva `project.timelines`; FilmMaker conserva `film.edit` y `session.montage.T`; Cinematics importa recursos FilmMaker y permanece de solo lectura. La creación de nuevos datos es explícita; no se añade `schemaVersion`, lógica de migración ni otro formato `.nfm`.

## Cierre

Gate **NO CERRADO**. El usuario debe ejecutar compilación/QA local, verificar edición/grabación/guardado/reapertura/exportación con una película real y decidir si requiere las pistas de métodos/comandos dentro de FilmMaker, resolviendo el contrato antes de habilitarlas.
