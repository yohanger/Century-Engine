# Edit Mesh — controles permanentes de resolución paramétrica

**Gate autorizado:** `CENTURY-EDITOR-MESH-S01-G001-PERSISTENT-PRIMITIVE-TOPOLOGY-CONTROLS`.

## Contrato de comportamiento

- Una malla creada como esfera UV, cilindro, cono, toro, círculo, plano o rejilla conserva el tipo, las dimensiones y la resolución originales junto a la geometría serializada.
- Al convertir una primitiva de escena (cilindro, cono o esfera) a Edit Mesh, la resolución inicial coincide con la visualización inicial (32 segmentos radiales; esfera de 32 segmentos y 20 anillos). El tamaño del objeto queda incorporado en la geometría como antes.
- En Edit Mesh, el panel «Geometría de primitiva» permite modificar los segmentos, anillos o divisiones propias del tipo sin limitarse a la operación de creación. No aparece para mallas sin procedencia paramétrica acreditada.
- Las propiedades paramétricas se conservan al guardar y recuperar la geometría, incluyendo recursos compartidos. Un cambio de resolución de un recurso vinculado se aplicará a todos sus consumidores y requiere confirmación si hay más de uno.
- Una firma de geometría detecta si se realizaron modificaciones respecto a la última generación paramétrica. En ese caso, regenerar exige confirmación explícita y comunica que puede sustituir ediciones, UV o pintura. Cancelar no altera la malla.
- La operación se registra en Undo/Redo mediante el mecanismo existente y restablece la selección de componentes al cambiar la topología.
- Los cuerpos físicos y el Player consumen la malla serializada existente; no se crea un segundo generador ni un sistema de colisiones.

## Límites del alcance

- El control corresponde a una malla cuyo origen paramétrico es único. Las piezas añadidas dentro de otra malla mediante «Añadir a la malla» no reciben un registro paramétrico independiente: editar cada componente añadido por separado requeriría una definición de identidad de componentes y un contrato distinto.
- Las mallas arbitrarias, booleanas horneadas, primitivas Escalera/Rampa/Cubo y los recursos importados sin metadatos no reciben parámetros inventados. Las herramientas de edición manual permanecen disponibles.
- Las ediciones manuales se conservan hasta que el usuario confirme regenerar. No se garantiza preservar topología manual, UV ni pintura si se confirma reemplazarlas.
- No se crean migraciones obligatorias para escenas experimentales anteriores que no contengan metadatos paramétricos.

## Archivos y consumidores

- `src/engine/runtime/mesh/generators.js`: parámetros y geometría inicial.
- `src/engine/runtime/mesh/polymesh.js`: procedencia y firma persistentes en el mismo dato de malla.
- `src/core/mesh/session.js`: cambio seguro de resolución, confirmación, commit y recarga.
- `src/components/MeshPanel.vue`: campos numéricos por tipo dentro de Edit Mesh.
- `scripts/qa-suites.json`: grupo `mesh-topology`.
- `scripts/test-mesh-parametric-topology.mjs`: pruebas de geometría, persistencia, restricciones y recursos compartidos.

## Estado

IMPLEMENTADO, TEST DIRIGIDO PASS. Compilación y QA visual en Electron no verificados. Aprobación/cierre pendientes del usuario.
