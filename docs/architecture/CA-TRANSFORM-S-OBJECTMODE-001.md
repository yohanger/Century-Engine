# CA-TRANSFORM-S-OBJECTMODE-001 · Atajo S en Object Mode

**Autoridad:** Contract Amendment específico incluido y ratificado por la declaración literal «Listo. LF-INSPECTOR-TERRAIN-CLEANUP-S13-G005-G002-INTEGRAL autoriza comenzar» del 2026-11-08.

**Contrato previo afectado:** `LF-TRANSFORM-UNIFORM-SCALE-S04-G001`. Se sustituye exclusivamente el requisito de que **S** abra una operación numérica modal de escala en Object Mode y el HUD asociado. La funcionalidad de escalado uniforme accesible desde Inspector y su motor matemático permanecen existentes.

## Contrato vinculante

1. Object Mode: pulsar **S** sin modificadores no inicia escala modal ni el HUD «Escala × 1»; no altera valores ni crea Undo.
2. Edit Mesh: **S** conserva el flujo de transformación modal de malla existente, con Enter/Escape y sus validaciones.
3. **R** conserva el gizmo Scale de objetos, y el Inspector conserva sus componentes y acciones numéricas de escala.
4. **Ctrl+S** y **Ctrl+Shift+S** conservan las rutas de guardado del Editor.
5. No se modifica el escalado de objetos vía gizmo/Inspector, el modelo de transformaciones, el renderer, ni la física.
6. Únicamente se retiran de `src/core/editor/keys.js` el manejador y estado de escala modal de Object Mode que han quedado sin uso. El estado histórico `store.uniformScaleHud` y la rama condicional de `ViewportOverlay.vue` permanecen fuera del alcance autorizado; no pueden reactivarse con S desde Object Mode. El sistema activo de HUD de Edit Mesh permanece.

## Aserciones históricas supersedidas

Las aserciones `S04-14`, `S04-21`, `S04-22` y `HUD-09` que exigían la secuencia numérica en Object Mode se reemplazan por expectativas explícitas del Amendment. Se conservan todas las demás pruebas matemáticas de escala, Undo, gizmo, Inspector y Edit Mesh. No se elimina ninguna evidencia previa.

**Estado:** APROBADO por autorización literal del Gate que lo incluye; QA implementación PENDIENTE DE USUARIO. Este Amendment no autoriza acciones fuera de S13-G005-G002.
