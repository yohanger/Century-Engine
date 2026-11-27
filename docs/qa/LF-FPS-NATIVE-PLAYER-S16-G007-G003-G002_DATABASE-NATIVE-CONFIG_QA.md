# QA — S16-G007-G003-G002: Database nativa y movimiento

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · COMPILACIÓN, JOLT WASM, QA LOCAL Editor y NGM Runtime NO VERIFICADOS. No aprobado ni cerrado.

## Evidencia obtenida en el entorno de implementación

- Nuevos: `node --test scripts/test-fps-native-player-s16-g007-g003-g002-database-native-config.mjs` → **18 PASS, 0 FAIL, 0 SKIP**.
- Regresión focal: `node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-game-manager-g001.mjs` → **188 PASS, 0 FAIL, 0 SKIP**.
- Regresión ampliada: `node --test scripts/test-db-contract.mjs scripts/test-fps-native-player-s16-g*.mjs scripts/test-game-manager-g001.mjs` → **577 PASS, 19 FAIL**, mismo inventario de 19 fallos del baseline G003-G001 (GPPHY-17, 12 UX, 6 F12). No se atribuyen a este Gate ni se han corregido. Las suites importadas por Database duplican parte de la ejecución.
- `node --check` en archivos JavaScript cambiados → **PASS**. `tsc --noEmit --skipLibCheck --lib es2020,dom src/core/events/game-api.d.ts` → **PASS**.
- `npm run build` → **NO COMPILADO: `vite: not found`**. No se ejecutaron Electron ni NGM Runtime, Jolt WASM real tampoco.

## Instalación local

1. Conserva el ZIP anterior y tus proyectos locales. Extrae **SOURCE_BASELINE** en carpeta separada, con `package.json` en su raíz. No apliques también CHANGE al nuevo baseline.
2. Desde la raíz del proyecto:

   ```bash
   npm ci
   node --test scripts/test-fps-native-player-s16-g007-g003-g002-database-native-config.mjs
   node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-game-manager-g001.mjs
   npm run build
   npm run electron
   ```

3. En un **proyecto nuevo de QA** creado desde First Person, verifica en Assets el Prefab `Personaje FPS` y sus tres Scripts de Nodo. Arrástralo a la escena y designa su `CharacterBody3D` como personaje controlado. No sobrescribas escenas/proyectos de trabajo.

## Matriz de aceptación de usuario

| Caso | Preparación | Esperado | Estado |
|---|---|---|---|
| DB-01 | Base de datos ▸ Jugador: `walk=2`, `run=8` | Camina ~2 m/s, corre ~8 m/s tras acelerar; con Input Map | NO VERIFICADO |
| DB-02 | Cambiar `groundAccel/groundDecel` | Aceleración y frenado se actualizan sin otro controlador | NO VERIFICADO |
| DB-03 | Configurar salto automático (altura/tiempo) y manual | Velocidad vertical coherente con Database | NO VERIFICADO |
| DB-04 | Modificar `game.player.walk` en un script | Cambia durante Play; tras STOP la Database autoral no se modifica | NO VERIFICADO |
| DB-05 | Ajustar altura, radio y escalón | Un único Jolt CharacterVirtual; sin interpenetración ni objetos nuevos | NO VERIFICADO |
| DB-06 | Variar `eyeHeight` | Camera3D del jugador cambia la altura relativa en Play, sin alterar Prefab persistido | NO VERIFICADO |
| DB-07 | Cambiar `sensitivity` y `fov` | Cámara propia responde; Timeline/cámara ajena conserva prioridad | NO VERIFICADO |
| DB-08 | Crear jugador con `game.spawnPlayer` desde Prefab FPS | Configuración aplicada antes de callbacks del nodo | NO VERIFICADO |
| DB-09 | Añadir otro CharacterBody3D con Script FPS | El segundo cuerpo no toma el control del jugador | NO VERIFICADO |
| DB-10 | Escena legacy, GameManager Sin jugador y FilmMaker | Comportamiento anterior preservado | NO VERIFICADO |
| DB-11 | NGM Runtime exportado | Mismos parámetros, física y cámara que en Editor | NO VERIFICADO |

**Nota de alcance:** agua/nado, crouch, pasos, ViewModel/manos/inventario y save/load tienen Gates futuros; este QA no certifica su paridad.

## Evidencia a devolver

Resultados íntegros de los dos comandos Node, `npm run build`, capturas o vídeo de valores Database/velocidad/cámara, pruebas físicas Editor y NGM Runtime y `game.log` en caso de fallo. Diferenciar COMPILADO, QA LOCAL PASS, APROBADO y CERRADO.
