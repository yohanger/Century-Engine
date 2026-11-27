# LevelForge · S16-G007-G002-G001 — Identidad de jugador por escena

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G001-SCENE-PLAYER-IDENTITY`  
**Base:** SOURCE_BASELINE S16-G007-G001, sin reconstrucciones ni renombrados de archivos existentes.  
**Decisión vinculante de S16:** el personaje controlado es un `CharacterBody3D` ordinario y no un tipo privilegiado. No introducir nuevo manager, `FpsPlayer` o estado de movimiento.

## Autoridad y mecanismo

- **Identidad:** `project.scenes[].playerNodeId`, ID explícito del `CharacterBody3D` de la **misma escena**, no un campo de GameManager ni un atributo del propio script.
- **Edición:** `ScenePanel.vue` muestra la opción «Personaje controlado»; `assignScenePlayerNode` valida un cuerpo activo antes de guardar y registra Undo/historial mediante `commit`.
- **Resolución:** `resolveScenePlayerNode(scene, objects)` comprueba ID, tipo y activación efectiva, incluidos padres, sin consultar selección de Jerarquía, Inspector o nombre del nodo. Estados: `unassigned`, `valid`, `missing`, `wrong-type`, `inactive`, `ambiguous`, `invalid`.
- **Referencia perdida:** al eliminar o regenerar el ID de un hijo de Prefab, se mantiene la referencia editorial para avisar del problema. No se elige otro cuerpo por proximidad, orden ni nombre. El usuario la corrige manualmente.
- **Persistencia:** el campo viaja en el descriptor de la escena de `project.json` dentro de `.lfproj`; `splitProject`/`migrateRecord` y `ensureFs` lo conservan por copia de campos. Duplicar una escena conserva la referencia porque sus nodos se copian con los mismos IDs **dentro de la nueva escena**. En NGM Runtime, `writePackage` conserva `playerNodeId` en su descriptor sin utilizarlo aún.
- **Escenas antiguas:** si el campo no existe, `unassigned` es el estado. No se fuerza una migración ni se modifica el controlador FPS heredado.

## Separación de responsabilidades

**G001 IMPLEMENTA** elección y persistencia editorial de identidad. **G002** deberá conectar la interfaz `game.player` al nodo real, validar su resolución al activar cada escena y preservar los consumidores heredados. **G003** tratará Spawn Player como API, no como nodo obligatorio. Los siguientes Gates deberán decidir la política de remapeo explícito tras actualizar una instancia Prefab; G001 conserva y denuncia la referencia invalidada, nunca la remapea de forma especulativa.

No se modificaron `FpsPlayer`, Database, Input Map, Camera Orchestration, los scripts G004–G006, Jolt, la creación de Prefabs ni los proyectos locales.

## Estado

- Código de autoría: **IMPLEMENTADO**.
- Pruebas focales: **15/15 PASS**; seleccionadas con plantillas: **52/52 PASS**.
- Tres fallos de transiciones preexistentes en G007-G001: **NO ATRIBUIBLES A ESTE GATE**.
- Build, QA Electron, exportación y ejecución NGM Runtime: **NO VERIFICADOS**.
- Aprobación y cierre de G001: **PENDIENTES DE QA LOCAL DEL USUARIO**.
