# Century — Composición mixta de recortes CSG

**Gate:** `CENTURY-EDITOR-MESH-S02-G001-CORR-001-MIXED-SUBTRACT-COMPOSITION`

## Autoridad y objetivo

Este Amendment concreta la composición entre los tipos `subtract` y `meshSubtract` sin sustituir los contratos anteriores ni cambiar la estructura persistida de las escenas. La autorización literal del Gate figura en la conversación.

## Semántica

- Un receptor compatible puede acumular recortes de ambos tipos usando una única evaluación `carveGeometries()` sobre su geometría base (`baseGeo`). No se encadenan nuevas mallas editables ni se destruye la geometría autoral.
- `meshSubtract` define la cavidad interior desde una malla cortadora cerrada; `subtract` puede crear una abertura que comunique esa cavidad con el exterior, como una puerta bajo una escalera.
- Cuando se combinan ambos tipos de cortador, el orden de evaluación es **determinista**, primero `meshSubtract` y después `subtract`, con desempate por identificador estable dentro del tipo. Los proyectos que contienen solo un tipo conservan el orden previo de evaluación.
- Reordenar nodos en la Jerarquía no constituye un cambio geométrico. No debe recalcular el recorte ni sustituir geometrías temporales cuando las fuentes, transformaciones y activaciones siguen iguales.
- Eliminar, desactivar o transformar cualquiera de los nodos cambia únicamente su contribución al resultado acumulado. Las superficies del hueco continúan heredando el material del receptor.

## Restricciones preservadas

- No se crea un nuevo motor booleano, no se duplica `TransformControls` ni se reemplaza el nodo Substract anterior.
- Se preservan el almacenamiento no destructivo, la resolución `sourceId` del Mesh Substract y las protecciones contra mallas abiertas o referencias circulares.
- La colisión de una cavidad requiere una configuración `StaticBody3D` + `TriMeshShape3D` compatible con el receptor. No se crean colisiones automáticamente. La paridad física con Jolt y el QA visual en Electron no están verificados en este Gate.
- No hay migraciones obligatorias ni cambio de formato de escena. No se agregan paquetes o costes de licencia.

## Fuente y límites de auditoría

Se trabajó sobre `CENTURY-EDITOR-GIZMOS-S01-G001-CORR-001-TRANSLATION-PLANE-PIVOT-AND-SCALE-INTEGRITY_SOURCE_BASELINE.zip`, que ya contiene Mesh Substract. No se dispone de acceso a cambios locales fuera del ZIP: cualquier divergencia local debe revisarse antes de aplicar el CHANGE.
