# LF-NODE-COLLISION-BOX-FIT-CORR-G001 — Cierre de implementación BoxShape3D

Fecha: 2026-10-29 · SOURCE_BASELINE: `LevelForge_NODE_COLLISION_TRIMESH_G001_SOURCE_BASELINE.zip`.

## Contrato implementado

- El recurso `BoxShape3D` acepta `autoFit: true|false` y mantiene el `size` XYZ y posición local del nodo, sin utilizar `scale` como sustituto de las dimensiones físicas. Los recursos antiguos sin `autoFit` son **manuales**, sin migración ni cambio de sus medidas.
- Solo una `CollisionShape3D` nueva bajo un cuerpo que contenga geometría `primitive` o `mesh` adquiere `autoFit: true` por defecto; al crearla, el SceneGraph ya conoce la forma y ajusta sus dimensiones antes del commit de alta.
- `src/engine/runtime/physics/box-fit-bounds.js`: convierte las ocho esquinas de cada bounding box geométrico con la matriz afín al espacio local de la forma, acumula límites, devuelve `size` y `center`, y rechaza entradas inválidas.
- `src/engine/runtime/physics/box-fit-editor.js`: encuentra las geometrías del cuerpo físico, ignora herramientas editoriales y nodos físicos anidados, respeta visuales desplazados/rotados/transformados y obtiene la posición local de la forma sin reescalar el cuerpo ni sus mallas.
- `src/engine/runtime/scene/objects.js` y `scene-graph.js`: recalculan únicamente las cajas con `autoFit: true` tras sincronizar la geometría y al reconstruir la escena. Cuando cambia una geometría, se usa el mismo ciclo de `syncObject` y el mismo commit de la modificación que ya tiene LevelForge. Las cajas manuales no se actualizan. El gizmo utiliza la misma forma persistida.
- Inspector: activa/desactiva Autoajuste, botón **Ajustar a geometría**, tamaños editables y aviso si no existe fuente válida. La modificación manual de tamaño o posición desactiva el seguimiento; la rotación cambia la envolvente local manteniendo el autoajuste. La acción explícita de recalcular no activa el modo automático si estaba desactivado.
- Jolt: `src/engine/runtime/physics/node-bodies.js` ya construye `world._boxShape(...resource.size)` y utiliza la posición relativa del nodo con `RotatedTranslatedShapeSettings` o la forma compuesta; no se crea otro cuerpo Jolt. El Player comparte este runtime.
- Proyectos existentes: no se reinterpreta su tamaño `1 × 1 × 1` ni se activa autoFit de forma silenciosa. La serialización de `props.shape` conserva la configuración booleana. Undo/Redo restaura el objeto y vuelve a sincronizar la geometría desde el snapshot.

## Límites

- Caja envolvente orientada por la rotación de `CollisionShape3D`; es una **aproximación convexa**, no una malla TriMesh exacta ni una colisión de concavidades. Se respeta el mínimo de dimensión `0,01 m`.
- El cálculo soporta primitivas y `Mesh` editables de LevelForge. La geometría de modelos externos y terreno nativo queda fuera de este Gate. Cuerpos físicos anidados no se agregan al padre.
- Geometría vacía/oculta/inválida: no inventar una nueva caja o forzar `1 × 1 × 1`; conservar los valores existentes y mostrar aviso al intentar recalcular.
- Recalcular una forma automática no debe añadir un punto de Undo extra al movimiento geométrico; el `commit` del objeto ya incluye los ajustes.
- No se modifica TriMeshShape3D, el sistema de nodos, física de eventos ni otra variante de Shape3D.

## Verificaciones

`npm run test:box-fit` valida 24 pruebas: 9 matemáticas, 8 contratos de integración y 7 pruebas de escena con matrices equivalentes sin GPU. `npm run test:trimesh` ejecuta 92 pruebas del Gate anterior: 91 PASS, 0 FAIL y 1 SKIP (falta módulo Three.js para una prueba opcional).

**QA físico pendiente:** ejecutar `npm ci`, `npm run build`, `npm run electron` y Player exportado en Linux/Windows; probar creación de caja nueva para suelo con dimensiones 20 × 0,5 × 20, ajuste a mallas rotadas/varias primitivas, cambios Edit Mesh, Undo/Redo, guardado y carga `.lfproj`, colisión real Jolt y cuerpos anidados. Los tests estáticos y del adaptador **no sustituyen** a un contacto físico real.
