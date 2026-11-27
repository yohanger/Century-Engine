# Inspector profesional de Escena — implementación

## Componentes

- `Inspector.vue`: retirada de la cabecera redundante, sin cambios en la selección.
- `InspectorDock.vue`: búsqueda y acciones globales de plegado sobre el panel de escena existente. Se conserva el buscador de otros inspectores.
- `scene-inspector-search.js`: coincidencia insensible a acentos y mayúsculas, propagación a ancestros, expansión transitoria de secciones coincidentes y recuperación de las preferencias al limpiar el filtro. Solo se buscan propiedades actualmente montadas de acuerdo con las condiciones originales.
- `ScenePanel.vue`: iconos existentes, agrupación contractual, estilos locales, controles numéricos nativos junto a los 44 sliders existentes con las mismas rutas de actualización y confirmación. Indicador horario CSS ligado a la hora configurada y elevación solar procedente del cálculo existente; el fondo de color es un esquema horario, no una simulación astronómica adicional.
- `SceneStreaming.vue`: presentación compacta y advertencias funcionales conservadas.

Las preferencias conservan `fold:scene:*`; la búsqueda no cambia esas preferencias ni el proyecto. Los chunks de streaming recuperan su apertura previa al filtro. El diseño usa tokens existentes y consultas de contenedor. No hay modificaciones en `src/engine`, `src/core`, dependencias ni formato de proyecto.

## Evidencia y límites

Las pruebas estáticas históricas que exigían una cabecera HTML literal se ajustaron a la cabecera con icono y al identificador del panel: se conservan sus verificaciones semánticas. No se corrigieron los cuatro fallos preexistentes fuera del alcance. El fixture Electron monta el dock real con el constructor nativo de proyecto y WebGL; usa un adaptador mínimo para las llamadas del editor, no constituye prueba del runtime completo. La navegación entre escenas, Undo/Redo integrado y responsividad visual requieren QA local. La compilación de Vue no ha podido verificarse por ausencia de Vite.
