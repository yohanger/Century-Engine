# Optimización y diagnóstico

Mide antes de optimizar. **Stats** permite consultar FPS y contadores de escena; el visor ofrece modos de diagnóstico para geometría y materiales. Los modos de visualización editorial no son efectos que se exporten automáticamente al juego.

## Occlusion Culling estático

En Ajustes del motor, la sección de render permite habilitar la oclusión estática y hornear los datos de la escena en GPU. La geometría elegible debe ser estática; el horneado depende de la escena y se debe revisar si cambia su geometría. No elimina los nodos del proyecto ni equivale a una reducción de polígonos. El horneado está restringido durante Play y Edit Mesh.

## TriangHor

En el Inspector de Escena, **Hornear Mapa · geometría** permite hornear piezas de Terrain habilitadas. La acción se deshabilita si no existen piezas activas o hay una operación en curso. Evalúa la geometría resultante y conserva la autoría original según el mecanismo de horneado. No hay una tasa universal garantizada de reducción.

## Iluminación y perfiles

Hornear iluminación y hornear geometría son operaciones distintas. La iluminación se procesa en segundo plano. Compara Forward+, Mobile y Compatibility según el hardware de destino y valida Play y exportación en el perfil seleccionado. Las preferencias del visor no sustituyen los ajustes de render del proyecto.
