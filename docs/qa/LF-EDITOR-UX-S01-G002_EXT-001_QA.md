# LF-EDITOR-UX-S01-G002_EXT-001 — Selección y transformación múltiple

**Autorización literal:** `Listo. LF-EDITOR-UX-S01-G002_EXT-001 autoriza comenzar` (2026-10-25).

**Fuente obligatoria:** `LevelForge_EDITOR_UX_S01_G002_SOURCE_BASELINE.zip` (732 entradas, Three.js 0.186.1). **Estado:** implementado en fuente; QA visual/compilación en Linux pendientes.

## Diagnóstico comprobado

La selección en `src/core/state/objects.js` ya admitía `selectedIds`, Shift para añadir, Ctrl/Cmd para alternar y rangos del árbol. `src/core/editor/selection.js::_updateGizmoMode` conectaba los tres `TransformControls` exclusivamente a `store.selectedId`; por lo tanto los demás nodos conservaban su selección visual, pero no se transformaban. El historial `commit` ya captura todos los objetos y la selección; una confirmación tras terminar el gesto es suficiente. La arquitectura `makeRoot` conserva la escala propia exclusivamente en `root.userData.visual`: el nodo principal y su cadena de padres contienen posición y rotación.

## Cambios aprobados

- **Selección:** se conservan Shift + clic (aditivo en el viewport), Ctrl/Cmd + clic (toggle), Shift en Hierarchy (rango desde el ancla) y Ctrl/Cmd en Hierarchy (toggle). Shift sobre una fila sin ancla añade; Ctrl/Cmd tiene prioridad aunque Shift también esté presionado. Shift/Ctrl + clic en el vacío no borra la selección; clic normal en vacío sí la borra.
- **Pivote común:** con dos o más raíces editables seleccionadas, se crea un `THREE.Object3D` temporal, sin geometría, en el punto medio de sus orígenes de mundo. Se conecta a los `TransformControls` ya existentes; no se crea ningún controlador nuevo. Con espacio local, los ejes del pivote adoptan la orientación mundial del nodo activo; en espacio global permanecen alineados con el mundo.
- **Transformación:** en `mouseDown` se capturan transformaciones mundiales y escala visual originales. `objectChange` proyecta la traslación/rotación/escala del pivote a cada raíz, usando conversiones mundiales/locales a través del padre y sin modificar permanentemente la jerarquía. La escala del objeto se aplica en `visual.scale`, mientras que su origen se aleja/acerca del pivote. La selección de padre+hijo usa exclusivamente la raíz, lo que impide aplicar el movimiento dos veces.
- **Edición y bloqueo:** nodos con candado y descendientes de padres bloqueados no participan. Con un único nodo editable (por ejemplo, padre+hijo seleccionados), se usa el objetivo tradicional. En un conjunto con nodos no escalables se deshabilita la operación de escala conjunta; mover y rotar siguen disponibles.
- **Historial:** durante el gesto solo se actualiza la escena. En `mouseUp`, `updateObject(...,{commit:false})` sincroniza los afectados y se realiza **un único `commit(...)`**, lo que permite Undo/Redo conjunto. Si no hubo cambio no se añade entrada de historial. Al cambiar selección se libera el pivote temporal.

## Restricción geométrica conocida

LevelForge no representa cizalla (*shear*) en el modelo de objetos: las matrices de padres no llevan escala, y la escala propia se aplica al `visual`. Cuando varios objetos poseen orientaciones diferentes y se emplea una escala **no uniforme** en espacio global, el resultado no puede representar una cizalla exacta. Se preserva la rotación individual, se modifican las distancias al pivote y se escala cada visual según los factores del gizmo. Se exige QA visual en esas combinaciones; no se introducen matrices de cizalla ni se modifica el formato del proyecto.

## Verificación automatizada

- `node --test scripts/test-editor-ux-s01-g002-ext-001.mjs`: **15 PASS, 0 FAIL**. Pruebas de selección, pivote medio, traslación, rotación, escala, padre/hijo, nodo bloqueado, gesto nulo, liberación, snapping/mismos controles, historial, modo universal, anclaje en única raíz editable y conversión mundial/local bajo padre rotado.
- Pruebas anteriores de G001/G002 también conservadas.
- Regresión acumulada `scripts/test-*.mjs` excluyendo `test-starcat.mjs` (depende de Three.js instalado): **902 PASS, 0 FAIL, 18 SKIP**. La suite EXT-001 contiene 15 PASS; se repitió la regresión al terminar los cambios.
- Sintaxis Node en módulos `.js`: PASS.
- `npm ci`, `npm run build`, Electron Editor y GPU real: **NO VERIFICADOS EN ESTE ENTORNO** (sin `node_modules`); ejecución requerida en Linux.

## QA manual de aceptación

| Caso | Acción | Criterio |
|---|---|---|
| EXT-UX-01 | Crear tres cubos. Shift + clic en viewport y Ctrl + clic alternadamente. | Se mantienen los seleccionados y Ctrl quita/agrega sin resetear el resto. |
| EXT-UX-02 | Shift + clic en Jerarquía con ancla; Ctrl + clic en elementos no contiguos. | Selección de rango y alternancia; el Inspector sigue el activo. |
| EXT-UX-03 | Seleccionar dos cubos separados y mover con W. | Aparece un solo pivote central; se desplazan ambos conservando separación. |
| EXT-UX-04 | Rotar con E dos objetos alrededor del centro. | Ambos orbitan el pivote y cambian orientación. |
| EXT-UX-05 | Escalar dos cubos con R. | Cambian las escalas propias y las distancias al pivote, no la escala de sus padres. |
| EXT-UX-06 | Usar gizmo universal Y. | Sin conflictos entre asas, un solo gesto a la vez. |
| EXT-UX-07 | Activar snapping y cambiar Local/Global. | Mover/rotar/escalar usan incrementos existentes y orientación coherente. |
| EXT-UX-08 | Seleccionar un grupo padre y uno de sus hijos. | El hijo se desplaza una sola vez al mover el grupo. |
| EXT-UX-09 | Seleccionar dos objetos con distintos padres rotados/trasladados. | Cada transformación local se calcula a partir del mundo correctamente. |
| EXT-UX-10 | Mezclar un nodo bloqueado con uno libre. | El bloqueado no se transforma directamente. |
| EXT-UX-11 | Trasladar varios, Undo una vez y Redo una vez. | Se restauran y reaplican todos juntos, sin pasos intermedios por nodo. |
| EXT-UX-12 | Duplicar, editar en Inspector y borrar multiselección. | Sin regresiones de operaciones existentes. |
| EXT-UX-13 | Seleccionar objetos con rotaciones distintas y escalar en un eje. | Verificar limitación documentada; sin rotaciones espurias ni NaN. |
| EXT-UX-14 | Repetir entrada/salida de Play, abrir proyecto antiguo y exportar Player. | Sin pivote fantasma ni cambios de runtime/colisión. |
| EXT-UX-15 | `node --test scripts/test-editor-ux-s01-g002-ext-001.mjs && npm run build && npm run electron:dev`. | Tests + compilación Editor/Player PASS, consola sin errores nuevos. |

## Fuera de alcance

- RectAreaLight y vinculación independiente DirectionalLight/sol/luna, referenciadas en `FrostEngine_v1(1).unitypackage`: **G003**, sin inspección ni modificación aquí.
- G004: cámara/órbita/restauración en Play. G005: Color Picker, snapping UI y Textboxes.
- No duplicar `TransformControls`, cambiar Jolt, reescribir selección ni actualizar Three.js. Exactamente dos ZIP: CHANGE y SOURCE_BASELINE; sin SHA separado ni scripts `.sh`.
