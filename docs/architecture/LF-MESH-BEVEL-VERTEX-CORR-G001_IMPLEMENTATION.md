# LF-MESH-BEVEL-VERTEX-CORR-G001 — Contrato e implementación

## Origen y alcance

SOURCE_BASELINE heredado: `LevelForge_NODE_COLLISION_BOX_FIT_CORR_G001_SOURCE_BASELINE.zip`.
No se sustituye `bevel.js` ni la cadena de guardado de mallas; se extiende mediante `bevel-vertex.js` y `bevel-boundary.js`, conectados desde `ops-edit.js` y `EditSession`.

## Decisiones técnicas

1. **Vértices:** `Ctrl+Shift+B` exige modo vértice. Prevalidación de abanicos orientados, aristas de una o dos caras, convexidad local, ancho, perfil y segmentos. Reconstrucción en copia de `PolyMesh`; las caras modificadas sustituyen la esquina con una curva racional; los vértices interiores reciben un tapón triangulado con orientación inversa. `pruneLoose()` elimina vértices antiguos sin usar y remapea selección.
2. **Contorno abierto:** `Ctrl+B` acepta aristas de una cara solo cuando pertenecen a caras aisladas, con cuatro o más vértices, sin compartir extremo con otra arista seleccionada. Se generan bandas de transición con 1–32 segmentos; la frontera continúa abierta. No se admiten bordes abiertos conectados a otras caras porque exigirían dividir la malla adyacente: se devuelve error *antes* de alterar el objeto. Las aristas interiores siguen en el algoritmo existente.
3. **Transacciones:** `EditSession._previewOp()` parte de copia de la malla, reconcilia atributos y no genera commit; `modalConfirm()` ejecuta un único commit; `modalCancel()` restaura `base`. No hay un segundo historial.
4. **Datos y físicas:** no cambia el formato de `PolyMesh`, `.lfproj`, `MeshShape` ni `BoxShape3D`. `EditSession.commit()` escribe con `writeMesh`, sincroniza consumidores del meshRef y dispara el refresco del SceneGraph. Las mallas TriMesh leen esos datos al reconstruir física; el autoFit existente sigue dependiendo del SceneGraph.
5. **Bordes que se rechazan:** aristas sueltas, no manifold, mezcla de interiores/exteriores, selección compleja en una sola cara abierta y esquinas cóncavas no compatibles con la operación actual. No se promete paridad completa con el modificador Bevel de Blender.

## Diseño de interfaz

`src/core/commands.js` registra `mesh.bevelVertex` con `Ctrl Shift B`. `MeshPanel.vue` y el menú contextual ofrecen entrada explícita. `session-input.js` distingue modificador Shift en Ctrl+B. El HUD, rueda, valores numéricos, perfil y confirmación se reutilizan.

## QA y limitaciones

Ver `docs/qa/LF-MESH-BEVEL-VERTEX-CORR-G001_QA.md`. Se ejecutan pruebas Node sobre topología de caja/placa y las regresiones. Build Vite, UI Electron, Jolt WASM y empaquetados Linux/Windows quedan PENDIENTES si no hay dependencias locales.
