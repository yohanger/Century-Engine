# LevelForge — LF-MESH-TRANSFORM-NUMERIC-G001 · QA

**Autorización literal:** `Listo. LF-MESH-TRANSFORM-NUMERIC-G001 autoriza comenzar`.

**Estado:** IMPLEMENTADO · TEST NODE PASS · COMPILACIÓN/QA VISUAL NO VERIFICADOS · APROBACIÓN PENDIENTE.

## Fuente de continuidad

Se ha utilizado **exclusivamente** `LevelForge_MESH_LOOPCUT_INTERACTIVE_G001_SOURCE_BASELINE(1).zip` proporcionado por el usuario (868 archivos, ZIP íntegro). Conserva el Loop Cut interactivo y las modificaciones previas de Codex. Los archivos que no constan en la lista de cambios se mantienen idénticos, byte por byte.

## Comportamiento y alcance

La herramienta se integra **dentro de Edit Mesh**, en `MeshPanel.vue`, sin modificar el Inspector de objetos ni crear otro editor:

- Un solo vértice en modo Vértices: **posición absoluta local X/Y/Z**, editable y previsualizada.
- Más de un vértice, aristas o caras: **desplazamiento relativo** ΔX/ΔY/ΔZ para toda la selección, conservando distancias y evitando aplicar dos veces la transformación a vértices compartidos.
- Dos o más vértices seleccionados: **rotación por eje en grados** y **escala por eje mediante factor**. Ambas utilizan el pivote central de la selección. Para un vértice solo, están deshabilitadas.
- El desplazamiento de conjuntos, la rotación y la escala siguen el espacio local/global actual. La coordenada absoluta de un único vértice siempre es local; se indica en pantalla.
- Reutiliza `_prepXform()` y `_xform()` para conservar **simetría X** y **edición proporcional**. La selección activa y la geometría determinan el conjunto afectado. Las herramientas del gizmo siguen siendo independientes y conservan su Snap. El valor tecleado se aplica de forma exacta, sin forzar Snap adicional sobre un número explícito.
- `NumberField` emite actualizaciones durante el arrastre o edición y confirma al finalizar. Se agrupan en **un único commit Undo/Redo** y se evitan confirmaciones que no producen cambios. Cambiar de selección, modo, gizmo o herramienta modal cancela previsualizaciones pendientes.
- Se amplía **únicamente** la precisión de serialización de las coordenadas de vértices de PolyMesh de 5 a 8 decimales, para evitar que se pierda la precisión de los nuevos campos al guardar. Los archivos previos de 5 decimales siguen siendo compatibles. UV, colores y pesos conservan su precisión/serialización previa de 5 decimales.
- `NumberField.vue` incorpora la propiedad opcional `disabled` (default false) para bloquear los campos que no son aplicables; no cambia el comportamiento de los controles existentes.

**Compatibilidad:** sin cambios a Shader Graph, Dock/Undock, clipboard, Mesh Instances, Loop Cut, selección de objetos, materiales, exportador ni Player. Se conserva la topología PolyMesh, UV, Vertex Paint y la ruta de guardado.

## Evidencia de QA automatizada

| Validación | Resultado |
|---|---|
| `scripts/test-mesh-transform-numeric-g001.mjs` | **22 PASS, 0 FAIL** |
| Regresión de Node sobre las suites disponibles, sin `test-starcat.mjs` | **1833 PASS, 0 FAIL, 18 SKIP** |
| Syntax checks de los módulos JS editados | **PASS** |
| `npm run build` en este entorno | **NO VERIFICADO — vite: not found (exit 127)** |
| Editor Electron, Player, UI real, GPU, export | **NO VERIFICADOS** |

La suite nueva ejecuta el **`xformMethods` original** con sustitutos matemáticos de Three.js (Vectores/Quaternion/Matrix4) y usa `Sel`, `PolyMesh` y generadores reales. Prueba posición absoluta, coordenadas locales y globales bajo escala no uniforme, aristas/caras, selección múltiple, rotación, escala, edición proporcional, simetría, no-op, cancelación, commit único y serialización de precisión. No sustituye una prueba de interacción Vue/Electron real.

## Instalación segura (CHANGE solamente)

Antes de sobrescribir, verificar que los archivos afectados no hayan recibido cambios locales **posteriores** al baseline proporcionado. Respaldar:

```bash
cd ~/ENGINES/lf-0.26.13/lf
mkdir -p ~/ENGINES/LevelForge_BACKUPS/LF-MESH-TRANSFORM-NUMERIC-G001
cp --parents \
  src/components/MeshPanel.vue \
  src/components/NumberField.vue \
  src/core/mesh/session-xform.js \
  src/core/mesh/session.js \
  src/core/mesh/session-modal.js \
  src/core/mesh/session-pick.js \
  src/engine/runtime/mesh/polymesh.js \
  docs/qa/LevelForge_DB_Ledger.xlsx \
  ~/ENGINES/LevelForge_BACKUPS/LF-MESH-TRANSFORM-NUMERIC-G001/
```

Aplicar CHANGE (si no hay conflicto con cambios locales posteriores):

```bash
cd ~/ENGINES/lf-0.26.13/lf
unzip -o ~/Downloads/LevelForge_MESH_TRANSFORM_NUMERIC_G001_CHANGE.zip -d .
node --test scripts/test-mesh-transform-numeric-g001.mjs
npm run build
npm run electron
```

**Resultado esperado de la prueba nueva:** 22 PASS, 0 FAIL.

## QA funcional del usuario (no se declara PASS anticipadamente)

- [ ] Crear un cubo, entrar en Edit Mesh, seleccionar un vértice y escribir X = 1.23456789; debe conservar el valor de ocho decimales tras guardado/reapertura.
- [ ] Cambiar Y y Z en el mismo vértice. Confirmar que el gizmo sigue al vértice, el origen del objeto no se mueve y Undo/Redo restauran los valores.
- [ ] Seleccionar una arista. Desplazar ΔX = 1.25; sus dos vértices deben trasladarse exactamente una vez sin variar su distancia.
- [ ] Seleccionar una cara. Desplazar ΔY = -0.75; comprobar que otras caras compartidas se actualizan coherentemente.
- [ ] Seleccionar dos vértices; rotar 45° sobre Z alrededor del centro; escalar X por factor 1.5. Verificar resultados en el viewport y Undo/Redo.
- [ ] Comprobar local/global con el objeto rotado y escalado; las coordenadas de vértice único permanecen locales.
- [ ] Probar arrastre continuo en un campo, seguido de una sola operación de Undo. Comprobar que los campos relativos vuelven a cero después de confirmar.
- [ ] Probar Simetría X y Edición proporcional existentes; comprobar un vértice único sin controles de rotación/escala activos.
- [ ] Alternar selección, modo y herramienta modal durante una previsualización; no deben persistir alteraciones sin commit.
- [ ] Probar el Loop Cut interactivo anterior y comprobar que no existe regresión; guardar, reabrir y probar en Player.

**Nota:** los datos guardados conservan ocho decimales en PolyMesh, pero la representación gráfica mediante Float32 puede limitar la precisión visual a escala grande; no confundir los límites de la GPU con la serialización.

## Continuidad

Se registró el Gate en las seis hojas del ledger. La aprobación anterior `LF-MESH-LOOPCUT-INTERACTIVE-G001` se anota como APROBADO POR USUARIO, manteniendo sin verificar su QA visual formal. No se declara aprobado el Gate actual hasta evidencia/confirmación del usuario.
