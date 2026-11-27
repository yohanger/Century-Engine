# Iconografía de Proyecto y limpieza de la barra superior

Gate `CENTURY-EDITOR-UX-S05-G001-ASSET-ICONOGRAPHY-AND-TOOLBAR-CLEANUP`, ratificado y autorizado por el usuario. Implementación en fuentes, pendiente QA Electron, aprobación y cierre.

## Autoridad y alcance

- `src/core/project.js` continúa clasificando recursos. `src/core/editor/asset-icon.js` proyecta esa clasificación a iconografía, sin cambiarla. OBJ, GLB y GLTF son los modelos admitidos; FBX no adquiere soporte por esta intervención. HDR/EXR son panoramas reconocidos por `scene/environment.js` y MTL se consume en `scene/models.js`, aunque el catálogo los almacene como archivos.
- Los SVG `src/assets/icons/asset_*.svg` son originales, sin marcas ni recursos de terceros. Se reutilizan los PNG de carpetas, script, material y archivo genérico. `ProjectPanel.vue` conserva la precedencia de miniaturas reales, acciones y estructura de lista/cuadrícula. No hay render de modelos, cambios de importadores, persistencia de recursos ni dependencias nuevas.
- `Toolbar.vue` conserva las tres vistas y herramientas restantes; retira los cinco accesos ratificados. `commands.js` publica **Ver → Paneles del editor**, con los tres conmutadores, Mostrar panel y Restaurar disposición. `view-dock-session.js` centraliza los mecanismos que anteriormente vivían en Toolbar. El menú se evalúa al abrirlo. Añadir y Shift+A se conservan.
- No se modifica la autoridad de docking, las ventanas Electron, los recursos del juego, el runtime, la paleta, las fuentes ni el logo. Dos pruebas de toolbar se ajustan al nuevo alcance explícito; se conserva su verificación de los accesos a Añadir. Se repara la fixture de acceso a Malla para ejecutar el propietario real.

## Validación

Suite `asset-iconography-toolbar` 11/11; regresión seleccionada 82/90 frente a 81/90 anterior (ocho fallos preexistentes); recuperación de ratón 70/70; autoridad modal 9/9. `asset-iconography-toolbar-electron` bloqueada por falta de Vite, al igual que el build. La inspección de iconos rasterizados es evidencia de los recursos gráficos, no del layout en Electron. Los cambios locales del usuario no son accesibles.
