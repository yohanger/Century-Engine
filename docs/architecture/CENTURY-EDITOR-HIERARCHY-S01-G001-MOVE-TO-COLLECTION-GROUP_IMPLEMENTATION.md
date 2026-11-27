# Mover a grupo — implementación

- `commands.js`: opción de Jerarquía con destinos válidos, búsqueda por ruta e iconos del registro. Captura raíces, proyecto y escena al abrir el menú y revalida al ejecutar. Se deshabilita sin destinos o fuera del modo de autoría.
- `MenuList.vue`: búsqueda optativa, normalización reutilizada del menú Añadir, encabezado sticky, filas de 28 px, altura máxima de 324 px (10 filas + buscador + borde y padding), scroll, teclado y posicionamiento lateral preexistente. Los menús que no solicitan búsqueda mantienen filas directas y comportamiento original.
- `tree.js`: separación de planificación y aplicación del reparentado para usar una misma autoridad tanto en la operación individual como en el movimiento colectivo. Todos los cambios se validan antes de mutar el árbol y la propuesta final pasa por validateNodeTree. Se aplican las raíces y se sincronizan los descendientes; un único commit existente. No hay estado persistente adicional. Se omiten raíces que ya están en el destino.
- `scripts/qa-suites.json`: grupos focales Node y Electron. Las pruebas Node utilizan la implementación real de planificación y validación jerárquica con dobles de cálculo de traslación y del historial, además de comprobaciones de código fuente UI. El fixture Electron usa Vue, matrices Three.js y el historial real con un editor de prueba; su ejecución quedó bloqueada.

Riesgo pendiente: medir respuesta en escenas muy grandes, ya que cada destino potencial verifica la selección y el árbol. No se acredita rendimiento ni QA visual por las pruebas Node.
