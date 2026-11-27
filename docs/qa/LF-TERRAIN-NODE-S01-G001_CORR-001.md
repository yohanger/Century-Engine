# LevelForge — LF-TERRAIN-NODE-S01-G001_CORR-001

**Contrato correctivo:** S01 original quedó SUPERSEDIDA en cuanto al mecanismo de representación visual. El nodo `terrain` ahora pertenece al registro de nodos y a `project.objects`; cada entrada usa el **mismo ID** de la pieza `Terrain`. Las alturas, pintura, capas, vegetación, colisiones y el render continúan exclusivamente en `Terrain`. El `build` del nodo crea solo su identidad (sin otra malla ni render de terreno).

## Diagnóstico verificado

- Antes: `terrainTreeNodes()` fabricaba una fila virtual incluso para piezas `enabled=false`; se mostraba «Terreno» aunque el panel indicase que no existía.
- Antes: Shift+A se alimentaba del registro real de nodos, que no incluía `terrain`.
- Ahora: `terrain` se registra en la categoría **Ambiente** y el comando llama a la creación real existente `addTerrain` / `addTerrainPiece`.
- Ahora: `SceneTree` consume únicamente `store.project.objects`; las piezas inactivas no tienen nodo. La migración crea nodos para piezas activas en proyectos antiguos sin regenerar alturas ni pintura.
- La visibilidad de la fila no cambia las colisiones. La creación/borrado/renombrado del nodo acompaña a los datos de la pieza dentro del mismo historial.

## Alcance y límites

No se introduce Transform Y ni escala del terreno: corresponde al Gate `LF-TERRAIN-TRANSFORM-S02-G001`. El terreno aún no admite parentesco bajo otros Node3D, porque la altura y las colisiones no soportan transformaciones heredadas. No se implementa expansión individual de los cuatro lados (S03), ni se elimina `frameAll()` al aplicar tamaño (S04). La UI del Inspector sigue utilizando el panel Terrain ya existente.

## Pruebas automatizadas

- `node --test scripts/test-terrain-node-s01-corr001.mjs scripts/test-terrain-node-s01-g001.mjs`
- Regresión verificada: Node Core, Editor Nodes, Camera Continuous Grab, Player Motion FPS, Hydrology (141/141 PASS). La fixture Electron actualizada exige 15 verificaciones internas; todavía NO VERIFICADA.
- Editor / Player: `npm run build`, `npm run electron`, prueba local del Player exportado si aplica.
- Prueba manual indispensable: escena sin terreno => **ningún nodo Terreno**; Shift+A → Ambiente → Terreno => aparece una pieza física y nodo único; borrar y deshacer; guardar, recargar y alternar escenas; dos piezas con IDs y superficies distintas; visibilidad sin pérdida de colisión, altura, pintura ni vegetación.

### Evidencia y estado

- Node nuevo S01 CORR-001: 15/15 PASS.
- Node S01 revisado: 16/16 PASS.
- Regresión ampliada focal: 141/141 PASS (suites incluidas en el registro del Gate).
- Electron / build Editor-Player: **NO VERIFICADO** en el entorno del asistente (sin `node_modules`).
- QA visual del usuario: **PENDIENTE**.
- Cierre: **NO CERRADO** hasta QA local y aprobación expresa.

## Inventario

Afecta al registro de nodos, migración y estado de escenas, Shift+A, jerarquía y pruebas. Se elimina el antiguo proyector virtual `src/core/state/terrain-tree.js` al no tener consumidores. No se modifica ningún mapa de altura ni proyecto del usuario.
