# LF-NODE-COLLISION-TRIMESH-G001 — Colisión TriMesh vinculada a primitivas y mallas

**Fecha:** 2026-10-30. **Baseline de entrada:** `lf(4).zip` proporcionado por el usuario (1.306 archivos). **Estado:** implementado en fuente, QA de Node superado; compilación Vite, Jolt WASM y experiencia visual pendientes de QA local.

## Arquitectura: extender antes de duplicar

Se amplía el recurso `CollisionShape3D` del sistema de nodos con `TriMeshShape3D` (`kind: 'mesh'`). El recurso `.lfproj` solo almacena `{type:'TriMeshShape3D',sourceId:'id'}`, no una copia de los vértices; mantiene el vínculo con la primitiva o `mesh` editable. `StaticBody3D` sigue siendo el **único** cuerpo Jolt, aunque conviva con otras formas. No se modifica el sistema Terrain, los eventos ni la física global.

- `physics/shapes.js`: registra y valida el nuevo recurso. Solo está permitido como hijo directo de `StaticBody3D`. Un `RigidBody3D`, `CharacterBody3D` o `Area3D` no puede utilizar una malla triangular cóncava.
- `physics/trimesh-source.js`: valida que el nodo fuente sea `primitive` o `mesh` dentro del mismo StaticBody3D sin atravesar otro cuerpo físico anidado; fuentes ausentes u ocultas se rechazan.
- `physics/trimesh-geometry.js`: extrae el BufferGeometry real ya triangulado por la geometría de Three.js, transforma sus vértices al espacio local de `CollisionShape3D`, invierte el orden de triángulos si la transformación tiene determinante negativo y rechaza vértices no finitos y triángulos inválidos. Límites: 200.000 triángulos, 450.000 vértices por forma.
- `physics/node-bodies.js`: usa `_meshShape` de `JoltWorld` existente, sin motor ni loop adicional. Libera las referencias creadas por la forma triangular tanto directamente como al componerla con formas primitivas. El cuerpo permanece estático.
- `nodes/physics.js`, `scene/objects.js`, `scene-graph.js`: dibujan las aristas de la malla como *preview* de edición (no collider extra). Se reconstruyen cuando se sincroniza una malla, una primitiva, un nodo Transform intermedio o una escena tras Undo/Redo.
- `Inspector.vue`: selector de origen, mensajes de error, configuración de forma. `commands.js`: nuevo comando mediante Añadir → Física → TriMeshShape3D. Si existe una sola malla directa en el cuerpo, se enlaza automáticamente.

## Contrato de autoría

```text
StaticBody3D (Acera)
├── Mesh (Acera editable)
└── CollisionShape3D (TriMeshShape3D, sourceId → Acera editable)
```

El usuario puede editar el mesh con sus herramientas actuales, confirmar la edición y reproducir con Jolt utilizando los triángulos actualizados al iniciar Play. Transformaciones de geometría y de la forma se respetan. También se admiten fuentes visuales descendientes bajo nodos Node3D sin cruzar cuerpos físicos. Una referencia no elegida no fabrica una caja por defecto: el Inspector avisa y Play reporta un error explícito. No se generan geometrías persistentes por duplicado.

## Alcance y límites

- **Estático:** TriMesh es una colisión de triángulos, de superficie cóncava; no es adecuada como forma de objetos rígidos dinámicos. Un mesh abierto puede ser colisionable solo desde la dirección física de sus caras (winding); para un sólido cerrado se necesita geometría adecuada.
- **Render/Physics:** el editor muestra aristas. Jolt opera mediante la forma MeshShape y el PlayMode compartido con Player. La validación real de contactos jugador/suelo requiere iniciar Electron/Player y Jolt WASM.
- **Rendimiento:** las colisiones se reconstruyen al iniciar Play, no en cada frame ni al arrastrar cada vértice; el preview sí se actualiza tras cambios de edición/Undo/Redo. No se permiten colisiones TriMesh de dimensión ilimitada.
- **Persistencia:** el recurso conserva `sourceId`, por lo que mantiene vínculo después de guardar/reabrir, y Undo/Redo de ediciones de malla usa el historial existente. Si se elimina la fuente, el motor no crea otro colisionador implícito.
- **Fuera de alcance:** Bevel de vértices (`LF-MESH-BEVEL-VERTEX-CORR-G001`), Shift/Snap, Git web docs y adaptación automática de BoxShape3D (Gate independiente).
- La exportación del **Player de LevelForge** utiliza el mismo `PlayMode`. La antigua exportación a Godot `.tscn` no se modifica en este Gate.
