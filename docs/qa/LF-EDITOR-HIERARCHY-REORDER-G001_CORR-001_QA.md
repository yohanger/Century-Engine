# LevelForge — LF-EDITOR-HIERARCHY-REORDER-G001_CORR-001

**Autorización exacta:** `Listo. LF-EDITOR-HIERARCHY-REORDER-G001_CORR-001 autoriza comenzar`

**SOURCE_BASELINE:** `LevelForge_EDITOR_TOP_HUD_LAYOUT_CORR_G001_SOURCE_BASELINE.zip`. **Estado:** IMPLEMENTADO · TEST NODE PASS · QA ELECTRON NATIVO/BUILD/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Incidencia reportada y diagnóstico

El usuario confirma que `LF-EDITOR-HIERARCHY-REORDER-G001` no permite ni reordenar hermanos ni cambiar de padre mediante el ratón. El test anterior de Vue generaba eventos `dragstart/dragover/drop` manualmente, pero no verificaba el gesto de mouse nativo.

**OBSERVADO en código previo:**

1. `dragging.value = true` insertaba mediante `v-if` una franja de ayuda encima de la lista *durante `dragstart`*, desplazando la posición de las filas en un momento crítico del gesto.
2. `onDrop()` dependía de `drop.value`, alimentado exclusivamente por el último `dragover`. Si faltaba o quedaba vacío, `endDragging()` abortaba sin mover el nodo.
3. El emparentamiento exigía Alt en lugar de ofrecer la zona central accesible de cada fila.
4. `@dragover.self` y `@drop.self` de `.list` no admitían soltar sobre los elementos de relleno (`pad`), de modo que el retorno a la raíz podía resultar inaccesible.

**CAUSA RAÍZ demostrada a nivel de código:** el flujo de drop era frágil ante cambios de DOM y eventos faltantes; la imposibilidad observada en Electron de usuario requiere su QA nativo para confirmar que esos mecanismos explicaban toda la falla. No afirmar FIXED visual antes de recibir el resultado.

## Mecanismo correctivo aplicado

- Se retira la franja añadida durante dragstart, por lo que la altura y la posición de la lista permanecen estables. No se crea otro estado permanente.
- La mitad central de cada fila se convierte en destino **dentro**, sin exigir Alt; una franja superior/inferior permite **antes/después**. Alt sigue forzando dentro como atajo opcional.
- `onDrop()` calcula el destino directamente desde la fila bajo el cursor y no confía en el marcador temporal de `dragover`.
- La escena raíz y el área libre de la lista aceptan Drag & Drop de nodos, incluidos los eventos que burbujean desde elementos de relleno. La escena raíz no bloquea arrastres externos de Assets.
- Reutiliza `reorderSiblings` sin alterar transformaciones y `reparent` cuando cambia el padre, con sus validaciones, Undo y sincronización existentes.
- Terrain solo se reordena en la raíz, y el drag de Script desde Assets no se asocia a Terrain.
- Se conserva virtualización, autoscroll, búsqueda, selección múltiple y contrato `application/x-lf-node` para prefabs en Assets.
- El runner Electron existente acepta opcionalmente un plan de gestos **nativos** de la fixture y los ejecuta con `webContents.debugger` e `Input.dispatchMouseEvent`. El runner normal de WebGL permanece intacto en ausencia de ese plan.

**Fuera del Gate:** cuadrados XY/XZ/YZ del gizmo orientados hacia cámara, restos del HUD superior, Terrain Inspector, modificación de física o de API de transformaciones.

## Evidencia automatizada

- `scripts/test-editor-hierarchy-reorder-corr001.mjs`: **18/18 PASS** (lógica real del componente con eventos, sin Electron).
- `scripts/test-editor-hierarchy-reorder-g001.mjs`: **16/16 PASS**, actualizado al nuevo contrato de tres zonas.
- Regresión focal con Assets/NodeCore/Terrain: **145 PASS, 0 FAIL, 0 SKIP**.
- Regresión ampliada (Node): **416 PASS, 6 FAIL, 1 SKIP**. Los seis fallos se reproducen idénticos en el SOURCE_BASELINE anterior: VFX historial, CAM-09, assets S03, CSS de Inspector NE6-16 y dos suites Jolt dependientes del entorno. No declarar PASS global.
- Sintaxis del componente, QA Electron main, tests y archivos JS: **PASS**.
- `scripts/test-editor-hierarchy-reorder-electron-corr001.mjs` + fixture: **NO VERIFICADO** en este entorno por ausencia de Vite y Electron instalados (`Falta Vite; ejecutar npm ci`). El runner usa Electron embebido del proyecto, no Brave/Chromium externo. El plan contiene cinco gestos reales: antes, dentro, raíz, Terrain y después; también verifica Undo/Redo y Transform.
- Build Editor/Player: **NO VERIFICADO**, `vite: not found`.
- QA local y persistencia manual: **PENDIENTE**.

## QA local (Linux)

Extraer el SOURCE_BASELINE CORR-001 en carpeta nueva. No reemplazar proyectos locales ni escenas sin comparar.

```bash
npm ci
node --test scripts/test-editor-hierarchy-reorder-corr001.mjs
node --test scripts/test-editor-hierarchy-reorder-g001.mjs
node --test scripts/test-editor-hierarchy-reorder-electron-corr001.mjs
npm run build
npm run electron
```

**Esperado:** nuevas 18/18 PASS, G001 16/16 PASS, Electron 1/1 con al menos 12 verificaciones internas y cinco gestos nativos, compilación Editor/Player satisfactoria.

### QA manual obligatorio

1. Arrastrar desde el nombre de un nodo a la franja **superior** de otro: debe quedar inmediatamente antes. Repetir en franja **inferior**: inmediatamente después.
2. Arrastrar al **centro** de un grupo válido: debe quedar dentro, sin Alt. Confirmar el resaltado de destino. Reabrir el grupo y comprobar el hijo.
3. Devolver el nodo a la raíz soltándolo sobre la fila **Escena** o el espacio libre al final de la jerarquía.
4. Reordenar varios nodos seleccionados y comprobar su orden relativo. Repetir con jerarquías de más de 50 nodos y autoscroll.
5. Probar nodos bloqueados, ciclos inválidos, Terrain raíz y Script arrastrado desde Assets.
6. Guardar/cerrar/reabrir una escena existente con transformaciones de padres y prefabs. Comprobar posiciones, rotaciones, escalas y orden de hermanos. Probar Undo/Redo.
7. Comprobar que el prefab drag desde la jerarquía a Proyecto sigue funcionando y no se pierde el tipo de datos.

Devolver salida Node/Electron/build, captura antes/después, evidencia de reparent y guardado/reapertura. **Solo entonces** decidir QA LOCAL PASS, aprobación y cierre. Si falla el DnD nativo, registrar el primer evento que no ocurre y corregir dentro de un Gate autorizado; no legitimar el fallo alterando el contrato.

**Entregas:** exactamente dos ZIP: CHANGE con archivos nuevos/modificados y SOURCE_BASELINE completo acumulado. Ledger sincronizado en ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY. No SHA separado ni scripts `.sh`.
