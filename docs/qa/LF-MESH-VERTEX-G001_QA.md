# LevelForge — LF-MESH-VERTEX-G001: primitiva Vértice

**Autorización:** `Listo. LF-MESH-VERTEX-G001 autoriza comenzar` (2026-10-26).  
**Fuente de entrada:** `LevelForge_EDITOR_COLOR_PICKER_G001_SOURCE_BASELINE.zip`, 810 archivos, archivo íntegro.  
**Estado:** IMPLEMENTADO, regresión automatizada PASS; **Build, GPU/Electron, Player exportado y QA visual NO VERIFICADOS**.

## 1. Objetivo y contrato

Incorporar **Vértice** al catálogo `MESH_KINDS` como variante del **nodo `mesh` existente**. La primitiva tiene un único vértice local en `[0,0,0]`, sin caras ni aristas inicialmente. Se crea en el punto de la escena bajo el cursor usando el mecanismo de colocación ya aprobado y entra automáticamente en **Edit Mesh**, donde su punto es seleccionado. Esto evita un objeto inicialmente invisible y sin controles, ya que un punto aislado no tiene superficie para renderizar en Player.

**No** introduce un nuevo tipo de nodo, renderer, formato de malla, colisiones fantasma, árbol paralelo ni gestores de edición.

## 2. Implementación

- `src/engine/runtime/mesh/generators.js`: catálogo Vértice + generador `new PolyMesh([[0,0,0]],[],[])`; la creación sigue el registro de nodo `mesh` y su serialización `PolyMesh.toJSON()/fromJSON()`.
- `src/core/editor/placement.js`: tras usar el sistema de ubicación `addAt(spot, ...)`, si se crea específicamente la primitiva Vértice se abre el Edit Mesh del nodo. Las otras primitivas no cambian.
- `src/core/mesh/ops.js`: `appendVertex` crea un vértice local opcionalmente conectado al origen existente mediante `PolyMesh.we`, selecciona el nuevo y rechaza posiciones inválidas/duplicadas. `connectVertices` conecta exactamente dos puntos seleccionados si aún no existe una arista. Se mantienen las herramientas de borrado y selección ya existentes.
- `src/core/mesh/session.js`: en un nodo Vértice nuevo se selecciona el punto inicial. `toggleVertexDraw`, `_placeVertexFromScreen` y `connectSelectedVertices` reutilizan EditSession, `run/commit`, TransformControls, la conversión mundo/local y los ajustes de Snap de Toolbar. El plano de trazado se sitúa horizontalmente en la altura del punto activo; si la cámara mira casi paralela, utiliza un plano frontal por el mismo punto. **Este plano es una ayuda de edición, no geometría persistente**.
- `src/core/mesh/session-input.js`: con trazado activado, un clic izquierdo coloca el punto y lo conecta con el último vértice **cuando existe una única selección**; sin selección crea un punto independiente. Shift/Ctrl mantienen su función de selección. Escape desactiva trazado. No interfiere con navegación de cámara, pintura, operaciones modales ni arrastre de gizmos.
- `src/components/MeshPanel.vue`: dos controles visibles dentro del panel **Construcción desde vértices**: *Colocar vértice* y *Conectar dos puntos*. Selección, gizmos y panel de edición siguen siendo los originales.
- `src/core/state/state.js`: `vertexDraw` es un flag **temporal del editor**; no se guarda en el proyecto. Se desactiva al cambiar de modo, al salir de Edit Mesh o al restaurar Undo/Redo. `PolyMesh.we` es la única fuente persistente para aristas sueltas.

## 3. Evidencias y límites

- Prueba nueva: `node --test scripts/test-mesh-vertex-g001.mjs` → **26 PASS / 0 FAIL** (generación, topología, cadena, aristas sueltas, UV, casos inválidos, borrrado, serialización, buffers vacíos, rutas de editor, Snap, atajos y ciclo de vida).
- Regresión acumulada, excluyendo `test-starcat.mjs` por dependencia de Three no disponible en el contenedor: **1443 PASS / 0 FAIL / 18 SKIP**, 1461 pruebas registradas.
- Sintaxis de JS y bloque script Vue: PASS.
- `npm run build`: **NO VERIFICADO**, `sh: 1: vite: not found` (no hay dependencias instaladas en este contenedor). La regresión Node no certifica compilación de Vue, GLSL o Player.
- GPU, Editor Electron, selección visual, colisión y exportación: **NO VERIFICADOS** localmente.
- El Gate no genera caras automáticas: Fill/Extrude de superficies y PolyShape interactivo quedan para `LF-MESH-POLYSHAPE-G001`.
- Un nodo que sigue teniendo solo vértices y aristas no tiene superficie renderizable en Player, por diseño. En el Editor esos elementos se visualizan **durante Edit Mesh**, usando Points y LineSegments existentes. Tras salir del modo edición, es accesible de nuevo desde la jerarquía.

## 4. QA local requerido

- [ ] Ejecutar `npm ci`, `npm run build` y `npm run electron:dev` en una carpeta aislada.
- [ ] Menú Añadir → Malla editable → Vértice: nodo colocado donde apunta la cámara y entra en Edit Mesh con **V1 seleccionado**.
- [ ] Activar Colocar vértice; clic en el viewport añade V2 y la arista V1–V2. Crear al menos 5 puntos; observar el resultado mientras se mueve/orbita cámara.
- [ ] Comprobar que Shift/Ctrl continúan seleccionando sin colocar vértices y que Escape sale del trazado.
- [ ] Seleccionar dos vértices sueltos y pulsar Conectar dos puntos; verificar que no aparecen caras ni aristas duplicadas.
- [ ] Mover los vértices con gizmos y Snap. Repetir en perspectiva y vista ortográfica; probar también cuando la cámara esté casi horizontal.
- [ ] Suprimir un punto intermedio y verificar que los índices y aristas restantes no se corrompen; probar Undo/Redo de cada operación.
- [ ] Guardar/reabrir escena; comprobar posiciones y aristas de la cadena, así como ausencia de triángulos nuevos.
- [ ] Unir la malla con otra mediante las herramientas actuales, comprobar que las UV/materiales de la otra malla siguen intactos.
- [ ] Entrar/salir de Edit Mesh repetidamente; comprobar que los puntos de autoría no se muestran en Play/Player exportado si no hay caras.
- [ ] Devolver captura del visor en modo Vértices, prueba de guardado y cualquier mensaje de la consola.

## 5. Integración y entrega

SOURCE_BASELINE de entrada contiene Color Picker G001 aprobado en código y el historial acumulado. Los cambios de este Gate son únicamente los incluidos en CHANGE y el ledger con sus seis hojas actualizadas. No se incluyen `node_modules`, builds, cachés, temporales o `.sh` ni se entrega SHA-256 separado.

**Estado final:** implementado y prueba automatizada PASS; QA local y aprobación visual pendientes. No declarar CERRADO sin evidencia.
