# LevelForge — LF-MATERIAL-UX-S01-G001

**Autorización exacta:** `Listo. LF-MATERIAL-UX-S01-G001 autoriza comenzar` (26 de octubre de 2026).  
**SOURCE_BASELINE de entrada:** `LevelForge_BLOCKOUT_S01_G001_SOURCE_BASELINE.zip` (794 archivos).  
**Estado de implementación:** IMPLEMENTADO; REGRESIÓN AUTOMATIZADA PASS; **BUILD, ELECTRON, GPU y PLAYER NO VERIFICADOS**.

## Objetivo

Reorganizar las propiedades de materiales de primitivas y mallas con un Inspector estilo recurso de Godot: cada nodo puede conservar material **local** o referenciar un `.material` **compartido**, que alberga color, rugosidad, metalicidad, opacidad, parámetros físicos y el shader opcional. El pipeline PBR/Forward/Mobile se sigue eligiendo desde **Render**, no desde cada objeto. Shader Graph, Blockout, los parámetros declarativos y los materiales antiguos se conservan.

## Mecanismo y fuente de verdad

- `src/engine/runtime/render/material-resource.js`: modelo puro serializable del recurso Material y función `effectiveMaterialObject(obj, materials)`; **cuando existe `materialId` válido, las propiedades del recurso prevalecen, y si no, siguen aplicándose los campos locales antiguos**.
- `src/engine/runtime/render/pbr.js`: **se amplía el mismo `syncPbrMaterial`**, leyendo materiales desde `PBR_ENV.materials`, suministrado por `scene-graph.js`. No se crea otro material renderer.
- `src/engine/runtime/nodes/primitive.js` y `nodes/mesh.js`: el Blockout métrico consulta la **asignación efectiva** para calcular sus atributos de un metro. La geometría y las UV artísticas no cambian.
- `src/core/state/materials.js`: funciones de crear, asignar, editar, hacer local y eliminar; actualizar un recurso sincroniza únicamente los nodos consumidores. Los materiales modificados se incorporan en el **historial Undo/Redo existente**.
- `src/components/MaterialSection.vue`: Inspector único de material (recurso + propiedades desplegables y Shader Graph opcional). `MaterialShader.vue` ahora acepta un callback de edición para el recurso o el material local, sin duplicar su formulario.
- `src/components/MaterialResourceEditor.vue` + `App.vue`: permite abrir, editar y renombrar recursos desde el panel Assets sin seleccionar una primitiva.
- `src/components/ProjectPanel.vue` y `state/filesystem.js`: crear, renombrar, mover, duplicar, importar JSON `.material`, exportar y eliminar de Assets.
- `src/core/project.js`, `core/lfproj.js`, `core/levelpackage.js`, `core/levelpackage-import.js`: carpeta estándar `Assets/Materials`, colección `project.materials`, migración no destructiva y dependencia `materialId`; `.material` se trata como JSON y no como archivo binario.
- `core/state/history.js`: la captura/restauración del estado incluye materiales; no introduce otro sistema de undo.

## Compatibilidad y decisiones

1. Un proyecto antiguo sin `project.materials` se normaliza a colección vacía. Los objetos sin `materialId` mantienen intactos `obj.color`, `obj.mat`, `obj.roughness`, `obj.metallic` y `obj.opacity`.
2. Compartir un material **no duplica sus propiedades activas en el objeto**: la referencia `materialId` se resuelve al dibujar. Hacer local copia explícitamente las propiedades actuales y retira la referencia.
3. Borrar un material usado por objetos de la escena activa o prefabs los convierte a local conservando su apariencia. Si hay referencias desde otras escenas guardadas, se bloquea su eliminación para no romperlas.
4. Los shaders incorporados existentes **siguen funcionando** para objetos que ya los utilizaban, incluido Blockout; el selector normal muestra la herencia desde Render y los shaders personalizados del proyecto. No se borran opciones de Render ni recursos anteriores.
5. `castShadow`, la iluminación global y la decoración estática permanecen en secciones propias del objeto; no se incorporan como propiedades de un recurso de material.
6. El material `text` conserva su color local anterior; el recurso compartido de este Gate se aplica exclusivamente a nodos `primitive` y `mesh` para no modificar el contrato independiente de texto 3D.
7. No hay soporte por cara ni edición de materiales de modelos GLB importados en este Gate. No se modifica la física Jolt, el editor de mallas ni el Shader Graph.

## Evidencia automatizada

- `node --test scripts/test-material-ux-s01-g001.mjs` → **38 PASS / 0 FAIL**. Modelo, herencia, recurso compartido, referencias, Blockout, Inspector, persistencia, importación, eliminación, Undo/Redo y renderización integrada mediante contratos inspeccionables.
- Regresión acumulada: `find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' -print0 | sort -z | xargs -0 node --test` → **1363 PASS / 0 FAIL / 18 SKIP**. Tras los ajustes finales debe revalidarse.
- Cuatro pruebas de legado tuvieron que **actualizar sus verificaciones de ubicación y ruta de datos**: `test-blockout-s01-g001.mjs` (material efectivo), `test-editor-ux-s01-g005-ext-001.mjs` (shader en material local/compartido), `test-three-s01.mjs` (controles migrados al recurso) y un ajuste de espaciado en el Inspector para conservar el test de batching. No se cambian los contratos de malla, pintura, iluminación o textura.
- `npm run build` → **NO VERIFICADO** (`vite: not found` en este contenedor, sin dependencias instaladas). Compilar no equivale a validar la UI/GPU.
- Editor Electron, Player exportado, `.lfproj` real, `.levelpackage` real, optimización y GPU: **NO VERIFICADOS** aquí. Algunas pruebas de integración verifican código fuente y modelo puro, no render WebGL.

## QA local del usuario — Linux

- [ ] En un proyecto antiguo, verificar que las primitivas conservan apariencia previa, texturas, materiales y ajustes del shader.
- [ ] Crear un nuevo cubo y confirmar Blockout local predeterminado; abrir Materiales y desplegar propiedades.
- [ ] Crear `Assets/Materials/Blockout.material` desde el Inspector y asignarlo a otro cubo; cambiar albedo/rugosidad y verificar actualización de **ambos**.
- [ ] Seleccionar el recurso en Assets y abrirlo sin ningún nodo seleccionado; renombrar, duplicar y editar propiedades.
- [ ] Hacer local uno de los cubos; editar material compartido y confirmar que el objeto local conserva su propio aspecto.
- [ ] Asignar Shader Graph propio; editar parámetros; comprobar que Render sigue controlando el pipeline global.
- [ ] Verificar que una malla editada y extruida conserva Blockout, métricas de 1 m y UV artísticas al compartir material.
- [ ] Deshacer y rehacer una edición de material compartido en el mismo proyecto y verificar re-renderización de usuarios.
- [ ] Exportar/importar `.lfproj` y `.levelpackage` que contengan escenas, materiales compartidos, texturas y shaders; comprobar referencias.
- [ ] Comprobar eliminación con material utilizado por otra escena; debe bloquearse, no generar una referencia rota.
- [ ] Compilar Editor y Player, validar en Electron y Player exportado; devolver capturas, logs y pasos ante cualquier fallo.

## Entrega

Exactamente dos ZIP: `LF-MATERIAL-UX-S01-G001_CHANGE.zip` con los cambios de este Gate, pruebas, documentación y ledger; y `LevelForge_MATERIAL_UX_S01_G001_SOURCE_BASELINE.zip` con fuente acumulada. Se excluyen `node_modules`, builds, cachés y temporales. No se proporciona SHA-256 separado ni scripts `.sh`.

**Estado de cierre:** implementación entregada para QA local. El Gate no se declarará cerrado ni visualmente aprobado hasta recibir evidencia del usuario.
