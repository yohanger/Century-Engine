# LevelForge — S16-G007-G003-G003 · QA local ViewModel e inventario 3D

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G003-VIEWMODEL-INVENTORY-INTEGRAL`.

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · COMPILADO NO VERIFICADO · QA LOCAL PENDIENTE · NO APROBADO · NO CERRADO.

## Preparación

1. Extraer el `SOURCE_BASELINE` de este Gate en una carpeta nueva, sin sobrescribir los proyectos locales ni aplicar CHANGE encima de la misma carpeta.
2. Desde la carpeta donde está `package.json`:

   ```bash
   npm ci
   node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-gameplay-object.mjs
   npm run build
   npm run electron
   ```

   **Referencia automatizada:** 192 PASS, 0 FAIL, 0 SKIP. En la máquina de implementación Vite no estaba instalado, por lo que no se pudo compilar.

3. Usar un proyecto de QA nuevo. No modificar ni reemplazar partidas o proyectos del usuario. En Database ▸ Jugador, mantener slots existentes `right` y `left` (o sus IDs propios actuales). Preparar un Gameplay Object vinculado a Item y otro a Weapon con modelos válidos; preparar un nodo ordinario de prueba y un arma equipada.
4. Para personaje nativo designado, arrastrar el Prefab FPS de Assets a la escena y seleccionar su `CharacterBody3D` como personaje controlado. Para aparición diferida, elegir el modo **Aparición por API** y crear el jugador con el mecanismo `game.spawnPlayer()` aprobado en S16-G003-G002. No utilizar un segundo `FpsPlayer` en esas escenas.

## Matriz de QA manual

| Caso | Resultado esperado | Estado |
|---|---|---|
| Inicio en escena nativa designada | Se montan exactamente una vista `vmView` y slots desde Database | NO VERIFICADO |
| `game.viewModel.slots`, `slot('right')`, `slot('left')` | IDs y posiciones de los slots correctos, sin crear copias de Database | NO VERIFICADO |
| Attach de un nodo del mundo | Aparece en manos, sin colisión con personaje ni sombras duplicadas | NO VERIFICADO |
| Cambio de mano | El objeto cambia de slot; no se duplica ni repite evento de recogida | NO VERIFICADO |
| Drop y Throw con Input Map | Acción configurada/tecla reasignable y fuerza Database existentes | NO VERIFICADO |
| Lanzar objeto dinámico | Impulso Jolt existente; se libera y deja de ser objeto en mano | NO VERIFICADO |
| Stash y Unstash | Estado, visibilidad, capas y sensores restaurados | NO VERIFICADO |
| Item y Weapon Gameplay Object | Recolección, equipo, uso/consumo, almacenamiento y recuperación conservan inventario autoritativo | NO VERIFICADO |
| Señales de Gameplay Object | `object.grabbed`, `object.dropped`, `object.thrown`, `item.picked_up` sin duplicados | NO VERIFICADO |
| Cámara y render | Mano conserva capa `VM_LAYER`, FOV, oclusión y sin doble renderer | NO VERIFICADO |
| Jugador por Spawn Player | `game.viewModel` disponible tras Spawn, antes de `_ready`; tras destruirlo no quedan manos/cuerpos fantasma | NO VERIFICADO |
| Spawn posterior con arma guardada | Estado `stored` se rehidrata y se puede sacar de nuevo | NO VERIFICADO |
| Escena «Sin jugador» / FilmMaker | No se crea ViewModel ni se renderiza mano | NO VERIFICADO |
| Cambio de escena / STOP | No quedan slots, referencias o objetos perdidos; escenas previas intactas | NO VERIFICADO |
| FPS heredado | Vista y comandos existentes sin regresiones | NO VERIFICADO |
| NGM Runtime exportado | Comportamiento equivalente en jugador nativo, Spawn y legacy | NO VERIFICADO |

## Evidencia necesaria

- Salida del comando Node y `npm run build`.
- Grabación o capturas de objeto antes/en la mano/después de soltar o lanzar, junto con consola / `game.log` si hay errores.
- Resultado de equipar arma y usar/guardar Item con Database, sin inventario duplicado.
- Comprobación del mismo escenario en Editor y NGM Runtime independiente.
- Confirmación explícita del usuario antes de aprobar/cerrar el Gate.

**No confundir:** PASS con dobles de Three.js no constituye evidencia de QA de render ni Jolt WASM. La restauración entre partidas se revisará en G003-G004. El nodo Spawn heredado se eliminará de nuevos templates solo en G008.
