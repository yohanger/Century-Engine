# Implementación del Inspector de nodos

- `src/styles.css`: paleta XYZ compartida, con los valores previamente empleados por Edit Mesh.
- `src/components/MeshPanel.vue`: consume la paleta sin alterar operaciones de malla.
- `src/components/Inspector.vue`: compacta cabecera y secciones de nodos; conserva nombre editable, activo, bloqueo, grupos, capa, tipo, ruta y plegado. Elimina el icono genérico duplicado y la botonera redundante de scripts; conserva el selector, asignación, orden, eliminación, drag and drop y editables. Colorea XYZ para selección individual y múltiple y conserva los componentes numéricos y callbacks. Adapta la disposición estrecha sin retirar controles.
- `src/components/MaterialSection.vue`: reutiliza la esfera representativa, selector y menú de material de modelos importados para primitivas y mallas. Conserva acciones de asignación, creación, edición y conversión a local; restauración de original exclusiva de slots importados. Miniatura CSS y URL de textura existente, sin nuevo contexto GPU. El editor del recurso independiente conserva su presentación.
- Catálogo de QA: suite focal Node, runner y fixture Electron. Se adapta una assertion histórica que exigía la botonera eliminada al nuevo contrato visual, conservando el control de restauración y la comprobación de ausencia de botonera redundante.

No se modifica el runtime, los algoritmos, la selección, la persistencia ni las dependencias. Los cambios son de presentación e interacción del Inspector. Los estados históricos no se alteran.
