# LF-SCENE-INSTANCING-G001-CORR-001-GODOT-WORKFLOW-UX

Fecha: 2026-11-17  
Estado: **AUTORIZADO · IMPLEMENTADO · TEST PASS · COMPILACIÓN NO VERIFICADA · QA LOCAL PENDIENTE · NO CERRADO**

## Autoridad y origen

- Gate padre aprobado: `LF-SCENE-INSTANCING-G001-INTEGRAL`.
- SOURCE_BASELINE utilizado: `LF_SCENE_INSTANCING_G001_INTEGRAL_VSCODE_SYNC_SOURCE_BASELINE.zip`.
- SHA-256 del ZIP de entrada: `efa1a3905a59d02819d3e0745e8dc482ae5596589825ad5c02c97b8a62ca4684`.
- Alcance de esta corrección: **solo flujo editorial UX**; no cambia el resolvedor de instancias, formato de recursos, scripting, Player, física ni Camera Orchestration.
- Proceso: copia aislada; no se modificó GitHub ni se sustituyeron fuentes locales del usuario.

## Cambios y mecanismos

1. `SceneTree.vue`: se separa el botón **+ Añadir nodo** de **Instanciar escena existente** en la cabecera de Jerarquía. La acción principal crea por defecto en la raíz (`parentId: null`).
2. `SceneInstancePicker.vue`: nueva vista de selección dentro del `AppWindow` **existente**, no un segundo sistema de ventanas. Lee `project.scenes`, excluye la escena activa, busca por nombre/carpeta, permite teclado y confirma una sola instancia a través de `instantiateScene()`.
3. Menú contextual de una fila de Jerarquía: **Instanciar escena hija…** permite seleccionar explícitamente un padre. Se rechazan los padres bloqueados, el terreno, una raíz `sceneInstance` y nodos derivados.
4. Doble clic en la **raíz** de una instancia vinculada abre su escena fuente; se conserva el acceso desde Inspector y la navegación de hijos derivados. Renombrar continúa en `F2` y menú contextual.
5. `commands.js`: se retira el acceso redundante a escenas del menú **Añadir nodo**, sin cambiar sus demás categorías. `ProjectPanel.vue` conserva el acceso directo desde Assets y el arrastre existente.
6. `docs/web-src/escenas.md` explica el flujo nuevo. `test-scene-instancing-g001.mjs` actualiza solo los asertos de la forma nueva de la Jerarquía. El runner `test-scene-instancing-g001-corr001-ux.mjs` ejercita el controlador y el selector sin reconstruir el motor.
7. Ledger de seis hojas: registro de continuidad en `docs/qa/LevelForge_DB_Ledger.xlsx`, preservando las entradas históricas.

## Evidencia reproducible

Entorno disponible: Node.js 22.16.0, npm 10.9.2. **No** es el entorno Electron del usuario.

| Comando | Resultado |
| --- | --- |
| `node --experimental-vm-modules --test scripts/test-scene-instancing-g001.mjs scripts/test-scene-instancing-g001-corr001-ux.mjs` | **18 PASS, 0 FAIL** (11 contrato padre + 7 corrección UX) |
| `node --check src/core/commands.js` | **PASS** |
| `node --check` de scripts extraídos de `SceneTree.vue`, `SceneInstancePicker.vue`, `ProjectPanel.vue` | **PASS** (sintaxis JS, no compilación Vue) |
| `node --experimental-vm-modules --test scripts/test-assets-slot-dnd-s01-g001.mjs scripts/test-assets-slot-dnd-s01-g002.mjs scripts/test-assets-slot-dnd-s01-g003.mjs scripts/test-assets-slot-dnd-s01-g004.mjs` | 61 PASS, 2 FAIL; **los mismos 2 fallos se reproducen en el SOURCE_BASELINE intacto** (un aserto antiguo del VFX Editor y un runner que exige una firma antigua de `allEntries`) |
| `npm run build` | **NO COMPILADO**; falla con `vite: not found` porque las dependencias no están instaladas en el entorno de pruebas |
| `npm run docs:check` | Referencia API al día; portal web **NO VERIFICADO** porque falta la dependencia `marked` |

Los dos fallos heredados del bloque Assets no justifican modificar `VfxEditor` ni `core/project.js` fuera del alcance. El test de GUI prueba el flujo de control en aislamiento; **no acredita visualmente el componente Vue**.

## QA manual obligatorio antes de aprobar/cerrar

1. Aplicar el CHANGE sobre el SOURCE_BASELINE identificado, o recuperar el SOURCE_BASELINE completo en un directorio nuevo, sin sobrescribir cambios externos.
2. Ejecutar `npm run electron` en una instalación con dependencias preparadas.
3. Abrir proyecto que tenga escenas `Mundo` y `Casa`; pulsar el **botón de escena** de Jerarquía. Buscar por nombre y carpeta, confirmar: verificar que `Casa` se instancia **en raíz**, seleccionada, aunque antes estuviera seleccionado otro nodo.
4. Repetir con otra escena y dos instancias `Casa` con transformaciones distintas; verificar que se mantienen independientes y con la misma fuente.
5. Clic derecho en `Node3D` editable, elegir **Instanciar escena hija…**: verificar que aparece bajo él; validar el rechazo de nodos vinculados/bloqueados y del terreno.
6. Probar búsqueda vacía, lista sin resultados, teclado (`↓`, `↑`, `Intro`, `Escape`), y cierre de ventana.
7. Arrastrar `Casa` desde Assets al viewport, a una fila válida de Jerarquía y al espacio de raíz; confirmar que conserva su flujo y no afecta el drag-and-drop de scripts ni de Prefabs.
8. Doble clic en la **raíz** de instancia para abrir la escena fuente; regresar, comprobar cambios desde origen, luego guardar, reabrir, duplicar, deshacer y rehacer.
9. Comprobar que el selector no permite instalar la escena activa dentro de sí misma y que el resolvedor informa ciclos transitivos.
10. Ejecutar el Player exportado con el proyecto que incluya instancias, sin cambios de API ni en las rutas de carga.

**Aprobación del usuario:** PENDIENTE. **QA LOCAL PASS:** NO VERIFICADO. **CIERRE:** PENDIENTE.
