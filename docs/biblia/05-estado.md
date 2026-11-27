# Estado, Inspector y preferencias

`src/core/store.js` es fachada; las mutaciones residen en `src/core/state/`. `history.js` centraliza commits, deshacer/rehacer y autosave. `editor-workspace.js` codifica/restaura cámara, selección, vista y preferencias de sesión; el estado del proyecto no equivale al estado de una ventana. `electron/editor-config.cjs` y `electron/editor.toml` participan en la configuración editorial. `mouse-sensitivity.js` combina sensibilidad general y factores de navegación.

## Inspector y datos numéricos

`src/components/Inspector.vue`, `InspectorDock.vue` y `src/core/state/multi-inspector.js` resuelven selección y propiedades comunes. `NumberField.vue`, `Vec3Field.vue` y `number-draft.js` separan borrador textual, precisión de presentación y valor almacenado. Dos decimales visuales no equivalen a redondear el modelo. `src/engine/runtime/numeric-integrity.js` valida datos finitos.

`src/engine/runtime/scene/script-editables.js` analiza las propiedades de scripts; `state/objects.js` persiste los valores por nodo. La presentación en `PreferencesModal.vue` es independiente del mecanismo de persistencia. Los estilos de secciones y categorías son locales.

**Impacto:** no modificar el modelo desde un borrador incompleto; verificar cambios de selección, Undo/Redo, guardado, focos nativos y cierre de ventanas. Suites: `numeric-display-precision`, `preferences-section-alignment`, `editor-workspace-session`.

