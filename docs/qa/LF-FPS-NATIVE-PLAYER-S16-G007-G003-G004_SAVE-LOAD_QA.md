# S16-G007-G003-G004 — Matriz de QA de guardado y carga del jugador

**Gate:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G004-SAVE-LOAD-INTEGRAL`  
**Estado:** IMPLEMENTADO / TEST AUTOMATIZADO PASS / COMPILACIÓN NO VERIFICADA / QA LOCAL NO VERIFICADO / NO CERRADO.

## Preparación reproducible

1. Extrae el `SOURCE_BASELINE` de G003-G004 en una **carpeta nueva** con `package.json` en la raíz. Conserva el ZIP de G003-G003, proyectos y partidas reales. No superpongas CHANGE al baseline nuevo.
2. Instala dependencias según el procedimiento habitual del proyecto (`npm ci`, si hay conexión o caché). No alteres dependencias solo para intentar pasar una prueba.
3. Ejecuta desde la raíz:

   ```bash
   node --test scripts/test-fps-native-player-s16-g007-g003-g004-save-load-integral.mjs
   node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-gameplay-object.mjs
   npm run build
   npm run electron
   ```

   Esperado: **29/29 nuevas PASS** y **221/221 focal PASS**; build y Electron requieren QA real. En el entorno de implementación no se pudo compilar por `vite: not found`.

4. Utiliza **un proyecto de QA nuevo y ranuras vacías** (por ejemplo 6 y 7). No sobrescribas archivos locales ni saves actuales. El FPS template **todavía conserva Spawn heredado**, cuya retirada corresponde a G008. Para probar un personaje designado usa `playerNodeId` sobre el `CharacterBody3D`; para aparición por API usa el modo editorial «Aparición por API» y desasigna `playerNodeId`.
5. Para el Spawn automático utiliza el ejemplo ya existente `scripts/fixtures/fps/s16-g007-g002-g003-g002-deferred-spawn.js`: crea el personaje una sola vez con `game.on('start')`. No llames simultáneamente a la API desde dos sitios. Para pruebas de carga usa `game.save.save(6)` y `game.save.load(6)` desde un script de QA con mecanismos existentes, y registra los resultados en la consola; `game.save.load` es asíncrono.

## QA funcional manual (Editor y después NGM Runtime)

| Caso | Esperado | Estado |
|---|---|---|
| SL-01 · Designado en escena | Guardar posición, yaw, pitch y velocidad; cargar restaura **el mismo CharacterBody3D** | NO VERIFICADO |
| SL-02 · Spawn API | Guardar, mover, cargar: jugador en pose guardada, sin usar Spawn heredado ni crear segundo controlador | NO VERIFICADO |
| SL-03 · Repetir carga 3 veces | No se acumulan cuerpos Jolt, instancias, señales ni ViewModels | NO VERIFICADO |
| SL-04 · Ausencia en modo API | Guardar antes de crear jugador; cargar después de haberlo creado: queda sin jugador | NO VERIFICADO |
| SL-05 · Sin jugador / GameManager none | Guarda y carga sin crear personaje ni manos | NO VERIFICADO |
| SL-06 · Cambio de escena | Guardar en escena B y cargar desde A: limpia instancia A y restaura solo B | NO VERIFICADO |
| SL-07 · Hands / Stash | Los objetos autorales sostenidos o guardados recuperan slot/visibilidad/colisiones, sin señales duplicadas | NO VERIFICADO |
| SL-08 · Objetos internos del Prefab | Nodo del Prefab sostenido reaparece con su **nuevo** ID de instancia, no con el ID de Play anterior | NO VERIFICADO |
| SL-09 · Item / Weapon Database | Inventario, cantidades, equipo y estado de Gameplay Object no se duplican ni se pierden | NO VERIFICADO |
| SL-10 · Prefab ausente o revisión incompatible | Error explícito. El preflight no sobrescribe Party/variables ni el juego crea un Player parcial | NO VERIFICADO |
| SL-11 · Jolt o Script `_ready` fallidos | Rollback de instancia nueva y advertencia, sin colisiones fantasma | NO VERIFICADO |
| SL-12 · Partida anterior sin `world.player` | Se carga mediante la ruta anterior, sin inventar un Prefab nuevo | NO VERIFICADO |
| SL-13 · Proyecto autoral / STOP | Prefab y escenas originales sin objetos transitorios guardados; STOP libera handles | NO VERIFICADO |
| SL-14 · Control de cámara | FOV y Camera Orchestration siguen la cámara del `CharacterBody3D` restaurado | NO VERIFICADO |
| SL-15 · Compatibilidad heredada | FPS anterior y su Spawn permanecen funcionales hasta G008 | NO VERIFICADO |
| SL-16 · NGM Runtime independiente | Misma semántica de SaveManager/Prefab/Jolt que en Editor | NO VERIFICADO |

## Evidencias que debe devolver el usuario

- Salida completa de las dos pruebas Node y de `npm run build`.
- Capturas o grabación de SL-01, SL-02, SL-03, SL-04 y SL-07; estado y cantidad de objetos antes/después de `load`.
- Resultado de SL-10 con error textual y `game.log` o consola. No estropear partidas de usuario para probar fallos: usar copia de QA.
- Prueba equivalente en NGM Runtime independiente y confirmación de la ruta de exportación usada.
- Aprobación explícita. **No cerrar el Gate por tener tests sintéticos PASS**.

## Evidencia de implementación (no QA local)

- `docs/qa/evidence/LF-FPS-S16-G007-G003-G004/01-focal-node.log`: 221/221 PASS.
- `02-wide-current.log` y `03-wide-baseline.log`: 26 FAIL preexistentes en ambos; listas nominales idénticas.
- `05-build-env.log`: Vite ausente. `06-typecheck.log` vacío por PASS; `07-syntax.log` confirma sintaxis.
