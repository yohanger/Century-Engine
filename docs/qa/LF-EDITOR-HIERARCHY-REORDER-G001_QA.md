# LF-EDITOR-HIERARCHY-REORDER-G001 · Jerarquía: orden de nodos

**Autorización literal recibida:** `Listo. LF-EDITOR-HIERARCHY-REORDER-G001 autoriza comenzar`.

**SOURCE_BASELINE vinculante:** `LevelForge_AUDIO_MIXER_INSPECTOR_S02_G001_CORR_001_SOURCE_BASELINE.zip`.

## Diagnóstico observado

`SceneTree.vue` distinguía zonas de arrastre `before/inside/after`, pero la operación entre hermanos utilizaba `reparent()` en `src/core/state/tree.js`. Esa ruta puede calcular de nuevo matrices de transformación, actualizar el grafo espacial y sincronizar nodos aunque su padre no haya cambiado. Las franjas superiores/inferiores de fila eran pequeñas y el listado virtualizado no tenía autoscroll durante el gesto.

## Mecanismo de corrección

- `reorderSiblings(ids,parentId,beforeId)` manipula exclusivamente el orden de los hermanos en `project.objects`, sin modificar `parentId`, Transform ni sincronizar el viewport. Devuelve `false` para no-op o destino inválido; el gesto produce un único Undo/Redo.
- En el DnD de `SceneTree.vue`, soltar en mitad superior inserta **antes**, en mitad inferior **después**. Para cambiar de padre se mantiene **Alt** durante el gesto y se suelta sobre la fila destino: el cambio sigue usando `reparent()` y `validateNodeParent()` existentes. El cursor usa líneas visibles y un texto de ayuda.
- El orden de selección múltiple se conserva, se impide mover un nodo bloqueado o bajo un padre bloqueado y se evita crear ciclos. Se incluye autoscroll con `requestAnimationFrame` sobre la lista virtualizada.
- `terrain` puede reordenarse con los otros nodos raíz. Sigue bloqueado su cambio de padre porque su geometría/física no admite ese Transform heredado; el dato físico mantiene su ID.
- El DnD de Script desde Assets sigue pasando por `nodeScriptFromDrop` existente.

## QA en este entorno

- Nuevas pruebas HR: **16/16 Node PASS**.
- Regresión focal Node: **219/221 PASS; 2 FAIL preexistentes**; el test de VFX espera una forma de llamada antigua y el test de CSS del Inspector espera una regla que ya no existe en el baseline. Sus archivos originales no cambiaron.
- `scripts/test-node-editor-s06-g001.mjs`: adaptado su harness `node:vm` para inyectar el nuevo cierre `endDragging` al ejecutar una función aislada; la prueba de CSS histórica permanece sin modificar.
- Electron/Vue, build y Player **NO VERIFICADOS**. No hay `node_modules`: `vite: not found`; el runner Electron falla antes de cargar la fixture.

## QA local obligatorio (usuario)

En la raíz del SOURCE_BASELINE G001, con dependencias instaladas:

```bash
npm ci
node --test scripts/test-editor-hierarchy-reorder-g001.mjs
node --test scripts/test-editor-hierarchy-reorder-electron-g001.mjs
npm run build
npm run electron
```

En Editor, con un proyecto de prueba de varios nodos raíz y grupos:

1. Arrastrar un hermano sobre la mitad superior e inferior de otro; comprobar línea y orden exacto.
2. Ordenar varios nodos seleccionados; conservar el orden relativo. Repetir en grupos y raíces.
3. Mantener **Alt** sobre un padre válido para reparenting. Sin Alt no cambia el padre. Rechazar parentesco inválido, ciclos, bloqueados y Terrain como hijo.
4. Comparar posición/rotación/escala antes y después de reordenar; probar Undo/Redo y confirmar que no hay cambio físico.
5. Jerarquía larga: arrastrar cerca de bordes para autoscroll; buscar y alternar filtro/colapsado.
6. Guardar, cerrar, reabrir y cambiar de escena; el orden debe persistir. Revisar prefabs, scripts por DnD, Player y terreno sin duplicados.

Devolver consola Node, Electron y build, capturas antes/después de arrastre y evidencia de guardado/reapertura. **No declarar QA LOCAL PASS ni CERRADO sin aprobación y evidencia.**

## Fuera de este Gate

El usuario solicitó limpiar la categoría Shift+A → Primitivas, trasladando Agua a Ambiente, y añadir una herramienta de modelado que construya mallas por conexión de vértices y abra Edit Mode. **Ambas solicitudes son PENDIENTES de auditoría, contratos y Gates propios; no se implementan aquí.** Asimismo sigue pendiente la unificación del Inspector de Terrain.
