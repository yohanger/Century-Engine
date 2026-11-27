# LF-NODE-COLLISION-TRIMESH-G001 — QA y criterios de cierre

**Gate autorizado:** `Listo. LF-NODE-COLLISION-TRIMESH-G001 autoriza comenzar`.
**Estado:** IMPLEMENTADO EN FUENTE · QA DE NODE APROBADO · QA VISUAL / JOLT WASM / BUILD PENDIENTE.

## Automatización ejecutada

- `node --test scripts/test-node-trimesh-g001.mjs scripts/test-node-physics-s02-g001.mjs scripts/test-node-physics-runtime-s03-g001.mjs`: **91 PASS, 0 FAIL y 1 SKIP**. La omisión corresponde a una prueba histórica de Three.js real que requiere `node_modules`.
- Pruebas específicas TM-01..17: recurso serializable, fuentes primitiva/malla, jerarquías anidadas, rechazo de RigidBody, fuentes ausentes/ocultas, winding negativo, límites de geometría, cálculo local y continuidad de Inspector/Player.
- Prueba `TM-JOLT` en S03: doble de Jolt que verifica que se construye **un** cuerpo estático con MeshShape y se libera la forma cuando termina.
- Syntax check JS por `node --check`: verificar con el empaquetado antes de cerrar.
- `npm ci --offline --ignore-scripts` no pudo completarse: faltan paquetes en la caché de npm (`zip-stream`). En este entorno **no** se pudo ejecutar `npm run build`, ni la prueba física contra Jolt WASM real.

## QA local de aceptación (imprescindible)

1. `npm ci`, `npm run build`, `npm run electron` y `npm run test:trimesh`.
2. Crear `StaticBody3D` con una malla hija editada en Edit Mesh y `CollisionShape3D` → `TriMeshShape3D`; verificar que la fuente aparece en el Inspector y el preview de aristas coincide con la geometría.
3. Alterar una acera: pendiente, curva mediante bisel ya existente, desniveles y huecos; comprobar que el jugador choca **contra la malla y no contra una caja**.
4. Guardar `.lfproj`, cerrar, reabrir y ejecutar Play; comprobar que la referencia de origen no se pierde.
5. Mover/rotar/escalar el mesh fuente, incluyendo ejes invertidos; el collider debe quedar en el lugar físico correcto.
6. Mover un vértice, confirmar Edit Mesh; entrar en Play, salir, Undo/Redo y reabrir; comprobar que la colisión sigue la nueva geometría.
7. Body con múltiples CollisionShape3D (por ejemplo una caja más una TriMesh): un solo StaticBody Jolt, varios shapes.
8. Verificar que RigidBody3D/CharacterBody3D/Area3D rechazan la forma triangular y los materiales/colisiones existentes funcionan.
9. Probar 0 triángulos, fuente eliminada, 200.001 triángulos, jerarquía con otro body físico y meshes enlazadas; obtener mensajes de error seguros.
10. Probar Player exportado y 3 resoluciones del Editor: 1440×900, 1280×720 y 1024×768, sin overlays permanentes en Play/export.

No declarar Gate cerrado sin las pruebas que requieren Electron/Player/Jolt reales y aceptación del usuario.
