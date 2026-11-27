# Implementación — Substract / Mesh Substract vinculados al padre

**Gate:** `CENTURY-EDITOR-MESH-S02-G001-CORR-002-PARENT-BOUND-SUBTRACT-AND-WORLD-SPACE-ALIGNMENT`

## Cambios

1. `nodes/hierarchy.js`: `nearestMeshParent` utiliza el recorrido de ancestros ya existente y reconoce la malla o primitiva más próxima sin guardar un segundo receptor.
2. `scene/brushes.js`: todos los cortadores resuelven esa autoridad; cuando existe, solo afectan al receptor padre. Los nodos globales siguen recortando por intersección.
3. `scene/brushes.js`: separación de `rootWorld` y `world` para obtener la raíz sin escala visual y la forma con escala visual. La fuente `meshSubtract` se transforma al espacio de su padre antes de incorporar la pose del propio cortador.
4. `scene/objects.js`: una sincronización de `Node3D` o `sceneInstance` invalida los brushes con el mismo mecanismo diferido ya existente.
5. `Inspector.vue`: receptor automático para ambos tipos. Una fuente manual igual al receptor usa la misma copia interior que el modo automático; el margen expuesto conserva la carcasa.
6. Dobles de pruebas CSG actualizados para inyectar el nuevo helper compartido y ampliación de las pruebas de composición con escenarios de jerarquía, escalera desplazada y matrices rotadas.

## Compatibilidad y restricciones

No se modifican la definición de nodos, la serialización, el picker, las herramientas de malla, ni el editor de geometría. Los nodos `subtract` anteriores fuera de una jerarquía receptora mantienen su alcance global. La geometría autoral no se elimina.

No se introducen dependencias ni versiones nuevas. El rendimiento visual real, la estabilidad de las normales sobre una escena de usuario y la respuesta de Jolt/Player continúan sin verificación local en Electron.
