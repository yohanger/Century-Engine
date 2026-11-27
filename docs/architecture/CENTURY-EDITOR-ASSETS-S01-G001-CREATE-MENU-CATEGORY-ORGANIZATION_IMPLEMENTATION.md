# CENTURY-EDITOR-ASSETS-S01-G001-CREATE-MENU-CATEGORY-ORGANIZATION — Implementación

## Autorización y base

Gate autorizado mediante `Listo. CENTURY-EDITOR-ASSETS-S01-G001-CREATE-MENU-CATEGORY-ORGANIZATION autoriza comenzar`.
Fuente inspeccionada: `source_baseline(6).zip` suministrado para Century Engine, versión declarada `0.26.13`. El ZIP no contiene metadatos Git ni el estado del repositorio del usuario; los cambios locales externos a este paquete no son auditables.

## Mecanismo

- Se reorganiza únicamente `createItems(parent)` de `src/components/ProjectPanel.vue`. Mantiene las mismas acciones `run`, argumentos, destino y condiciones de disponibilidad.
- Categorías con `children`: **Escenas** (dos acciones), **Prefabs** (dos), **Cinemáticas** (tres, únicamente en `Assets`), **Scripts** (dos) y **Shaders y materiales** (cinco).
- Siguen visibles directamente **Carpeta**, **Efecto VFX**, **GameManager** e **Interfaz**. No se crean categorías de una sola opción.
- En `Assets/Cinematics` y carpetas anidadas se conserva la entrada individual **Cinematic**. Las rutas del sistema UI permanecen restringidas.
- El botón **+ Crear**, el clic derecho sobre el fondo, **Crear aquí** en carpeta de recursos y **Crear aquí** en el árbol consumen el mismo `createItems`.
- `MenuList.vue` y `ContextMenu.vue` no se modifican: ya proporcionan apertura lateral por hover/clic, posicionamiento `fixed`, inversión horizontal ante bordes, activación de hojas, semántica ARIA y teclado. El nuevo menú no utiliza acordeones ni altera la posición de las filas principales.

## Alcance y compatibilidad

No se modifican APIs de creación, modelos de assets, serialización, importadores, render, Player, comandos globales, docking o estilos. No se añaden dependencias ni hay migraciones.

## Estado

**IMPLEMENTADO EN FUENTE; 7/7 pruebas focales PASS; QA Electron y compilación NO VERIFICADOS; NO APROBADO; NO CERRADO.** La validación y aprobación visual corresponden al usuario.
