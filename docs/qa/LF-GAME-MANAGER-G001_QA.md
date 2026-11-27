# LevelForge — LF-GAME-MANAGER-G001 · Implementación y QA

**Autorización literal:** `Listo. LF-GAME-MANAGER-G001 autoriza comenzar` (2026-10-26).

**Fuente:** `LevelForge_HUB_TEMPLATES_S01_G001_SOURCE_BASELINE.zip` (770 entradas). Este Gate no sustituye el sistema existente de Player, Render ni de perfiles `.profile`.

## Contrato implementado

- Recurso editable `Assets/GameManagers/*.gamemanager`, administrado dentro de `project.gameManagers`, con `{id, name, folder, player, camera, profile}`. Es un recurso de datos; no un nodo 3D, ni un gestor paralelo de escenas.
- Cada escena puede tener una referencia opcional `scenes[].gameManagerId` en metadatos; una misma referencia se puede reutilizar en varias escenas. Los proyectos antiguos, sin lista ni referencia, siguen usando `project.game` y el sistema de cámara y perfiles original.
- Player: `inherit` conserva `project.game.player`; otro identificador utiliza el registro `player/index.js`. `none` permite una escena sin Player, sin introducir un registro de Jugador en Database.
- Cámara: el ID de una Cámara visible en la escena prevalece; si no existe se respeta la Cámara «principal» normal. Si tampoco hay, se utiliza la del Player donde corresponda. La cámara del Timeline mantiene su flujo existente.
- Perfil: el perfil elegido en GameManager se aplica como referencia inicial y base de la escena. Un perfil explícito en Spawn prevalece; una Cámara de Timeline puede sobrescribirlo temporalmente; los cambios mediante `game.profile` siguen disponibles.
- Editor: crear, editar, duplicar, renombrar, mover y eliminar GameManager desde Proyecto; seleccionar uno desde Escena ▸ GameManager; modal para elegir tipo de Player, Cámara y perfil.
- Persistencia: `.lfproj` conserva el GameManager como JSON (sin binarios) y el paquete runtime conserva `gameManagers` y la referencia dentro de `scenes[]`. `.levelpackage` incluye el GameManager al exportar una escena que lo referencia, cierra la dependencia de `.profile` y remapea los IDs al importar.
- El borrado de GameManager limpia `gameManagerId` en todas las escenas. El borrado de `.profile` limpia su referencia en los GameManagers.

## Compatibilidad, límites y riesgos

- [X] Proyectos sin GameManager conservan su configuración anterior.
- [X] La plantilla Empty no recibe GameManager por defecto, ni se añade Player a Database.
- [X] No hay Player, compositor ni sistema de Asset duplicados.
- [X] Una Cámara asignada que no exista en otra escena vuelve a la selección de cámara normal.
- [X] Los perfiles desaparecidos son ignorados sin alterar el contenido original del recurso.
- [ ] No se dispone de prueba gráfica de ejecución real en Electron ni del Player exportado.
- [ ] No se ha verificado `npm run build` porque no existe `vite` en este entorno.
- [ ] Las pruebas de `.levelpackage` en este Gate incluyen validación de cableado y la regresión anterior, pero queda pendiente validar un intercambio real entre dos proyectos con referencias a GameManager.
- [ ] No está implementado `DontDestroyOnLoad`: quedará para `LF-RUNTIME-PERSIST-G001`.
- [ ] No se ha creado `.post` nuevo ni PostProcessVolume: corresponden a los Gates específicos.
- [ ] La cámara seleccionada en un recurso compartido referencia un ID de objeto. En escenas donde dicho ID no exista, se usa la cámara principal existente: no se instancian cámaras automáticamente.

## Pruebas ejecutadas

`node --test scripts/test-game-manager-g001.mjs`: **30 PASS / 0 FAIL**. Incluye pruebas unitarias sobre normalización y resolución de GameManager, y comprobaciones estáticas de puntos de integración.

`node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)`: **1141 PASS / 0 FAIL / 18 SKIP**.

`node --check` de JavaScript nuevo y modificado: PASS.

`npm run build`: **NO VERIFICADO** (`vite` no instalado; el comando falla en este entorno). No se declara ninguna prueba visual ejecutada ni QA local aceptado.

## QA manual del usuario en Linux

1. Antes de instalar CHANGE, comparar con las modificaciones locales. Con el proyecto en su carpeta real, aplicar el ZIP, ejecutar `npm ci` si hace falta, `node --test scripts/test-game-manager-g001.mjs`, `npm run build` y `npm run electron:dev`.
2. En Proyecto ▸ Crear ▸ **GameManager (.gamemanager)** crear uno y confirmar que aparece en la carpeta. Editarlo y elegir Player `none`, cámara y un `.profile` existente.
3. En Inspector ▸ Escena ▸ GameManager, asignar el recurso. Comprobar que no aparece ningún nodo nuevo en Jerarquía.
4. Crear una escena Empty, agregar Cámara, asignar el manager con `none`, y probar Play: cámara sin FPS. Cambiar a First Person en otra escena, usar Spawn y verificar transición de Player.
5. Añadir un perfil visual de color, referenciarlo en GameManager, comprobar efecto al jugar. Añadir perfil explícito a Spawn y verificar su prioridad. Comprobar retorno tras una cámara de Timeline.
6. Asignar el mismo recurso a dos escenas, guardar, cerrar y reabrir el proyecto. Confirmar que ambos mantienen su ID de referencia.
7. Duplicar, renombrar, mover y borrar GameManager. Tras borrado comprobar que ninguna escena conserve la referencia. Borrar `.profile` referenciado y confirmar que queda limpio en GameManager.
8. Exportar juego y comprobar su inicio y transición de escenas. Exportar escena + GameManager + perfil como `.levelpackage`, importar en otro proyecto y verificar referencias remapeadas.
9. Abrir un proyecto antiguo y confirmar Player, cámaras y Render previos sin alteraciones.
10. Anotar problemas de cámara, Play Mode y consola; esta QA es requisito previo al cierre visual.

**Entrega:** exactamente dos ZIP: CHANGE y SOURCE_BASELINE completo, sin `.sha256` separado ni script `.sh`.
