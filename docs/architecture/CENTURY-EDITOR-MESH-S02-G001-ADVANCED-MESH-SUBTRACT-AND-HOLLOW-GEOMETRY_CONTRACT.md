# Century Engine — Mesh Substract: contrato y límites de geometría

**Gate:** `CENTURY-EDITOR-MESH-S02-G001-ADVANCED-MESH-SUBTRACT-AND-HOLLOW-GEOMETRY`

## Autoridad y baseline

Autorización literal del usuario recibida. Se utilizó como entrada el ZIP `CENTURY-EDITOR-GIZMOS-S01-G001-CAMERA-FACING-TRANSLATION-PLANE-HANDLES_SOURCE_BASELINE.zip`, sin reemplazar archivos de proyecto locales ajenos a ese paquete. No hay migraciones obligatorias. No se modifican los contratos ni la interpretación de `type: subtract`.

## Semántica

- `meshSubtract` es un **tipo de nodo distinto** del `subtract` actual. Conserva una referencia `props.sourceId` a una geometría de la escena sin copiar sus vértices al proyecto.
- Fuentes disponibles: `mesh` editable, primitivas volumétricas `box/ramp/stairs/cylinder/cone/sphere`, o `CollisionShape3D` de tipo `TriMeshShape3D` con `sourceId` válido hacia una primitiva/malla de su `StaticBody3D`.
- La geometría de la fuente debe ser **cerrada**, orientada hacia fuera, finita y triangulable, y respetar el límite geométrico existente. No se fabricará un volumen arbitrario a partir de una superficie abierta.
- El nodo usa la geometría y transformación mundial de su fuente. La pose propia de Mesh Substract aplica un desplazamiento/rotación/escala adicional al volumen recortador; se admite transformar la malla de origen y/o el nodo cortador. La fuente sigue siendo un objeto independiente; puede ocultarse en el Editor sin interrumpir la referencia.
- Cuando la fuente elegida —automática o manual— coincide con el receptor jerárquico, `meshSubtract` usa una copia interior para vaciar ese mismo sólido; `autoInset` conserva una carcasa (0.1 por defecto) y la pose/escala del nodo ajusta la cavidad. En escaleras rectas, la copia mantiene el perfil escalonado y desplaza sus caras hacia dentro para no atravesar huellas ni tabicas exteriores. Fuera de esa relación jerárquica se conserva la protección contra autosustracción global accidental.
- Receptores: primitivas y mallas editables cuyos `props.carve` no estén desactivados. Las paredes nuevas conservan el material del receptor. La propiedad del `mesh` original no se destruye y retirar el cortador restaura la fuente autoral.
- Varias instancias de Mesh Substract pueden emplear una misma fuente. La referencia se redirige si forma parte del mismo duplicado o escena instanciada; las referencias a objetos externos se conservan cuando corresponda.

## Restricciones

- **TriMeshShape3D** es un descriptor físico, no un volumen universal: solo es válido como referencia si se resuelve una malla fuente cerrada. Las mallas abiertas o con errores se rechazan; no hay reparador ni otro CSG.
- Los modelos GLB/GLTF como nodos `model` **no se admiten directamente** como fuente hasta disponer de una extracción segura de componentes y validación de sólidos. Deben convertirse a malla editable cerrada cuando esa conversión sea compatible con el flujo actual.
- Se rechazan matrices fuente con determinante no positivo o singular. Los recortes BSP en geometrías autointersectadas o no manifold no tienen garantía de éxito. No se declara validación geométrica universal.
- La geometría resultante de una colisión precisa requiere configurar explícitamente `StaticBody3D` con `TriMeshShape3D` referenciando al receptor; `BoxShape3D` no representa un hueco interior. No se crean cuerpos ni se cambian tipos de colisión automáticamente.
- Sin autorización de QA en Electron/Player ni compilación completa, no se declara paridad visual/física acreditada.

## Dependencias y costes

Se reutilizan el registro de nodos, el CSG/BSP, `PolyMesh`, el sistema de previsualización de Substract, `TriMeshShape3D` y la ruta de sincronización de cuerpos estáticos existente. No se agregan dependencias ni costes de licencias. El coste CSG depende de la complejidad de la malla; no se han medido presupuestos de tiempo/RAM de la escena real.
