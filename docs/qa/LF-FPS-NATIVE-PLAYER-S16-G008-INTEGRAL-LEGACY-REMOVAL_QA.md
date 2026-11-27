# QA usuario — G008 Retirada del FPS temporal

**Estado:** PRUEBAS NODE PASS; COMPILACIÓN, QA LOCAL, JOLT WASM, NGM RUNTIME NO VERIFICADOS.

## Preparación

Extraer `SOURCE_BASELINE` en una carpeta **nueva** con `package.json` en raíz. Conservar ZIP G003-G004 anterior y proyectos de producción. Para las pruebas usar un proyecto FPS **nuevo**, una copia desechable de un proyecto antiguo y partidas en ranuras de prueba; nunca sobrescribir datos de autoría o saves reales.

```bash
npm ci
node --test scripts/test-fps-native-player-s16-g008-integral-legacy-removal.mjs
node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-game-manager-g001.mjs scripts/test-hub-templates-s01-g001.mjs
npm run build
npm run electron
```

**Resultados Node esperados de esta entrega:** 26 PASS nuevos; 286 PASS focales, ambos 0 FAIL. El build debe completarse localmente; el contenedor no tenía Vite.

La selección ampliada, si se necesita auditoría, se ejecutó como:

```bash
node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-gameplay-object.mjs scripts/test-db-contract.mjs scripts/test-game-manager-g001.mjs scripts/test-hub-templates-s01-g001.mjs scripts/test-input-mouse.mjs scripts/test-gameplay-physics.mjs
```

**Resultado de referencia:** 726 PASS / 20 FAIL (746 pruebas); baseline previo: 700 PASS / 20 FAIL (720 pruebas), los 19 nombres de pruebas fallidas son iguales. **No declarar PASS para la selección ampliada.**

## Lista de QA funcional

- [ ] En Editor, crear proyecto *First Person*. Escena inicial contiene sol; **NO existe nodo Spawn**. Assets > Prefabs contiene `Personaje FPS`. Nada aparece como jugador durante Play si no se ha designado cuerpo.
- [ ] Arrastrar Prefab FPS a la escena, designar su CharacterBody3D en Inspector de Escena; Play permite mover, correr, saltar, agacharse, mirar e interactuar; validar Camera3D, FOV e Input Map.
- [ ] Asegurar un solo Jolt CharacterBody3D autoritativo, sin controlador FPS paralelo ni errores consola. Probar input ratón + mando si el dispositivo está disponible.
- [ ] Probar Database Jugador: velocidades, salto, gravedad; ViewModel: slots, manos, armas, objetos, Drop/Throw/Stash; persistencia save/load repetida.
- [ ] Crear segunda escena **sin jugador**: no aparece FPS, manos ni cuerpo implícito. GameManager «Sin jugador» y FilmMaker sin jugador.
- [ ] Configurar otra escena `Aparición por API` y un script que invoque `game.spawnPlayer()` con Prefab válido: un solo jugador, segundo Spawn rechazado; guardar, cargar, STOP y repetir.
- [ ] Probar comando Teletransporte hacia un nodo común por nombre/tag y cambio de escena con punto destino. Sin jugador debe informar error o no mover personaje ficticio.
- [ ] Abrir **copia** de un proyecto antiguo con Spawn. El nodo y sus propiedades deben seguir visibles y exportables, pero Añadir/Shift+A no permitirá crear uno nuevo; la escena antigua **no** debe activar FPS implícito.
- [ ] Probar NGM Runtime exportado separado del Editor con escenas/Prefab y Spawn Player API; comprobar controles, ViewModel, guardado y ausencia de fallback.
- [ ] Validar STOP / Play sucesivos sin fugas de Player ni pérdida de datos de proyectos originales.

## Evidencia a devolver

1. Salida Node (26 y 286), salida build y errores si existen.
2. QA Electron: capturas de jerarquía, Assets/Prefab, Inspector de Escena, prueba de Play con/sin personaje.
3. QA NGM Runtime: si fue exportado, resultado de la ejecución, pasos de reproducción.
4. `game.log`, consola y una grabación corta si hay regresiones visuales o de interacción.
5. Dictamen del usuario: APROBADO o incidencia, sin confundirlo con QA local PASS si la ejecución no ocurrió.

**Condiciones de cierre:** tests focales PASS, QA local de Editor/Player aceptado, sin fallos nuevos atribuidos al Gate, comparación del baseline verificada, aprobación expresa de usuario y ledger actualizado. **G009 NO incluido.**
