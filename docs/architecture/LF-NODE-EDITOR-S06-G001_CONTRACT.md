# LevelForge — LF-NODE-EDITOR-S06-G001

**Estado:** IMPLEMENTADO EN CÓDIGO · QA LOCAL PENDIENTE  
**Fecha:** 2026-10-28  
**SOURCE_BASELINE de entrada:** `LevelForge_NODE_SCRIPT_S05_G001_SOURCE_BASELINE.zip` (936 archivos)

## Propósito

Afinar el Scene Tree y el Inspector de la **arquitectura de nodos existente** para un flujo de trabajo más cercano a Godot. No se reemplaza el editor, no se añade ECS ni se crea otro SceneGraph. Se conservan el sistema de recursos, scripts asociados a nodos, editor de eventos y física Jolt.

## Contrato de Scene Tree

1. Los nodos se muestran desde `store.project.objects`, respetando el `parentId` real, el orden del array y `open`. El árbol sigue virtualizado a 24 px por fila, con overscan.
2. Un nodo con `scriptId` tiene un distintivo de script. Pulsarlo selecciona el nodo y abre **el editor de ese recurso**, si existe. Si falta, el indicador advierte que la referencia está rota: nunca crea recursos ficticios.
3. La búsqueda permite limpiar el texto, volver al árbol con Enter/Flecha abajo y salir con Escape. Si la selección cambia desde el viewport y el filtro la ocultaba, el filtro se borra y se revelan los ancestros.
4. El árbol acepta Flechas, Home, End y F2 para navegar y renombrar. Shift extiende el rango desde su ancla. Las filas exponen su nivel, selección y expansión para navegación accesible.
5. Drag-and-drop sigue usando `reparent()` y sus validaciones físicas. Cuando se arrastran varias raíces, el movimiento es **atómico a nivel de estado**: si una operación falla, restaura el orden, parentesco y transformaciones originales. Los lotes válidos generan una sola entrada `commit()`.
6. Los controles de visibilidad y bloqueo mantienen el mecanismo `updateObject()` y los menús contextuales existentes.

## Contrato de Inspector

1. El tipo registrado se identifica debajo del nombre editable; el objeto base sigue siendo el mismo del SceneGraph. El Inspector no crea otra copia de los datos.
2. `Node` no muestra Transform. Los tipos basados en `Node3D` muestran posición, rotación y, cuando su tipo lo permite, escala. Las variantes de forma continúan con Box/Sphere/Capsule; no se agrega una cuarta opción de catálogo.
3. Las propiedades de cuerpos, personaje, áreas, geometría y scripts permanecen en las secciones específicas existentes. Se mantienen editores de recursos, Mesh Edit, Terreno y Paint.
4. Los pliegues son persistentes por **tipo de nodo y título de sección**. Se recalculan al cambiar de selección o recurso, evitando que el estado de otro tipo afecte al seleccionado. Las cabeceras admiten Enter y Espacio, con `aria-expanded`.
5. En docks estrechos, las etiquetas de campos se colocan encima del editor de valor a partir del ancho de contenedor de 340 px. Las columnas flexibles evitan desbordes. El área de scroll no crea desplazamiento horizontal.

## Dependencias conservadas

- `src/core/state/tree.js` es el propietario de reparenting y transformaciones; no hay otro gestor de jerarquía.
- `src/core/state/objects.js` sigue gestionando la selección y las ediciones con historial.
- `src/core/commands.js` y el catálogo `nodes/registry.js` siguen siendo la fuente de creación y tipos.
- `src/engine/runtime/scene/node-scripts.js` continúa como única ejecución por instancia.
- `src/engine/runtime/events/`, `nodes/event.js`, `EventEditor.vue` y `EventPreview.vue`: **sin modificaciones**, 49 archivos protegidos idénticos.

## Límites explícitos

El Gate no cambia el formato de escenas, cuerpos Jolt, Event Order Flow, código de los scripts, nodos de producción ni exportación. Tampoco autoriza rediseñar el workspace completo. Se mantienen las decisiones del usuario: nodo Script opcional, tres formas físicas directas, sin ECS ni migradores legacy.

La organización visual se basa en Godot, sin reproducir su código ni trasladar sus clases al proyecto.

## QA de aceptación

- NE6-01..NE6-18: pruebas automatizadas específicas, con ejecución real de la función de movimiento por lote en entorno aislado.
- Pruebas de regresión de S01–S05, física, eventos, materiales, Inspector y Scene Tree.
- Prueba local necesaria: crear nodos, scripts, selección viewport→árbol, teclado, arrastre válido e inválido, pliegues, escala del dock, Undo/Redo y reapertura.
- PlayMode y export: no afectados por código de producción en S06; aun así deben verificarse localmente antes de cerrar S07.
