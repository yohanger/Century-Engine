# LF-TIMELINE-LIBRARY-PICKER-UX-S12-G005-INTEGRAL — implementación

Fecha: 2026-11-08.
Autorización: «Listo. LF-TIMELINE-LIBRARY-PICKER-UX-S12-G005-INTEGRAL autoriza comenzar».
Baseline: `LF_TIMELINE_COMMAND_MENU_ICONS_S12_G004_INTEGRAL_SOURCE_BASELINE.zip`.

## Contratos preservados

- Única biblioteca persistente: `store.project.timelines`. No se agregan almacenes, archivos de recurso ni IDs alternativos.
- `timelines` filtra explícitamente `!isFilmMakerTimeline(t)`. No introduce recursos de Nether FilmMaker en el selector nativo.
- `chooseTimeline(id)` conserva `store.projSel` y `openTimelineEditor(id)` y cierra el popup. Una búsqueda no modifica proyecto ni el transporte del Preview.
- `Nuevo Timeline` sigue utilizando `createTimelineDialog()` y su cancelación no crea recursos.
- S07 PRO UX, S06 biblioteca, S12-G004 menú de pistas y modelo/Player quedan preservados.

## Mecanismo aplicado (EXTEND BEFORE DUPLICATE)

Se extendió solo `src/components/TimelinePanel.vue`:

1. El popup existente continúa teletransportado a `body` y se posiciona con `repositionPopup()` respecto al selector. La altura es `auto` y el máximo es el mínimo entre 340 px y el espacio disponible; la lista pasa a usar `flex:0 1 auto` con scroll cuando supera el máximo.
2. Se reutilizan los iconos existentes `search`, `check` y `play` desde `Icon.vue`. No se cambia `Icon.vue` ni se instalan dependencias.
3. `librarySearch` recibe foco después de abrir con `nextTick`. El propio popup maneja ArrowUp/ArrowDown sobre botones reales, Enter desde búsqueda selecciona el primer resultado filtrado, y Escape cierra y devuelve foco al selector. Los botones conservan Enter nativo y su ID original.
4. Contador muestra coincidencias y total cuando existe filtro; listado muestra nombre, carpeta, duración y señal de Timeline activo. Estados vacíos quedan explícitos.
5. Clic exterior cierra popup; no altera el estado de recursos. `aria-controls`, `aria-haspopup="dialog"`, `role="dialog"` y `aria-pressed` documentan relación y selección.

Se actualizó una prueba S07-CORR001 cuyas expectativas de altura fija y scroll siempre visible quedaban sustituidas por la declaración explícita de G005. No se debilitaron los límites de viewport ni las comprobaciones de búsqueda, selector e identidad.

## Seguridad y límites

No se modifican `project.json`, serialización, Player, Cinematics, Asset management, historial, transporte, AudioEngine, Timeline Engine ni el docking general. No se agregan watchers persistentes, servicios globales ni timers. La lista se lee de un único `computed` existente. Las referencias de foco solo viven en el componente y Vue las libera al desmontarlo.

## Estado de evidencia

Node focal: 23 PASS / 2 SKIP / 0 FAIL. Regresión compatible: 71 PASS / 2 SKIP / 0 FAIL. Dos suites S06 de la regresión extendida fallaron por ausencia de `vite` en el entorno de generación, no por un fallo funcional demostrado. Electron y build posteriores a G005 no pudieron ejecutarse por falta de Vite: **NO VERIFICADOS**. QA local **PENDIENTE**. No se declara PASS de visualización sin evidencia local.
