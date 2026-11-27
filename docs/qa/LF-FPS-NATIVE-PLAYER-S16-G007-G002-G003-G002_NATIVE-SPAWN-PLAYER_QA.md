# LevelForge · S16-G007-G002-G003-G002 · QA de Spawn Player nativo

**Estado de implementación:** IMPLEMENTADO; **CORR local:** pendiente. **Contract Amendment:** CA-001 RATIFICADA. No declarar CERRADO sin QA local y aprobación expresa.

## Resultado técnico verificado

- Modo de escena `playerSpawnMode: 'api'` (selector **Aparición por API**) sin alterar escenas anteriores.
- `game.spawnPlayer(prefab, { position?, parent? })` instancia una raíz de Prefab con exactamente un `CharacterBody3D` activo y vincula `game.player` al cuerpo de Jolt. No se crea el FPS heredado simultáneamente.
- `game.player` es `null` antes de la aparición diferida; después, utiliza el handle nativo y sus propiedades físicas.
- Un segundo Spawn, GameManager «Sin jugador», FilmMaker, un Prefab inválido o una identidad autoral incompatible producen rechazo explícito y no dan lugar a un jugador alternativo.
- Error de Jolt/materialización/callback de inicialización: rollback. Destrucción por `game.prefabs.destroy(root)` y STOP: invalida el jugador y retira objetos temporales.
- Se preservan escenas legacy, `FpsPlayer`, GameManager, Camera Orchestration, Database, ViewModel y prefabs originales.

## Pruebas automatizadas

Desde la raíz de LevelForge con `package.json`:

```bash
npm ci
node --test scripts/test-fps-native-player-s16-g007-g002-g003-g002-native-spawn.mjs
node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-hub-templates-s01-g001.mjs
npm run build
npm run electron
```

**Resultado de referencia en el entorno de implementación:** 19/19 pruebas nuevas y 167/167 en la regresión acumulada PASS. Declaración TypeScript: PASS. **Build:** NO VERIFICADO (`vite: not found`). **Empaquetado oficial VSIX:** NO VERIFICADO (`jszip` ausente). No convertir el CRC de VSIX en QA real.

## Escenario funcional de Editor

1. Abrir un proyecto de QA separado creado mediante **First Person** (no sobrescribir proyectos anteriores).
2. Comprobar `Assets/Prefabs/Personaje FPS` y sus tres Scripts de Nodo. Mantener el `playerNodeId` **sin asignar**.
3. En **Inspector de Escena → Personaje controlado → Aparición del jugador**, elegir **Aparición por API**. El GameManager efectivo no debe indicar «Sin jugador».
4. Crear un recurso **Script Global** que se ejecute durante el arranque, utilizando el ejemplo en `scripts/fixtures/fps/s16-g007-g002-g003-g002-deferred-spawn.js`. No adjuntarlo al personaje que aún no existe.
5. Ejecutar Play con el suelo configurado y Jolt activo. El script debe poder comprobar que `game.player === null` antes del Spawn. Después, `game.player` debe representar el CharacterBody3D creado con el Prefab y ser compatible con los scripts nativos de movimiento/cámara/interacción.
6. Verificar que pulsar Play **sin ejecutar** el Spawn deja la escena sin jugador y no crea una cápsula FPS oculta. Comprobar cámara principal de escena si es necesaria para ver el mundo antes del Spawn.
7. Comprobar segundo Spawn rechazado, Prefab inválido sin residuos, destrucción de la raíz con `game.prefabs.destroy()`, nuevo Spawn posterior, STOP y reinicio.
8. Comprobar que `playerNodeId` no se escribe como ID temporal en la escena y que guardar/reabrir mantiene únicamente `playerSpawnMode`.
9. Probar una escena heredada sin ese campo y otra con GameManager «Sin jugador»: deben mantener su semántica anterior.
10. Exportar y ejecutar con **NGM Runtime** independiente: validar el mismo resultado de cámara, Jolt, scripts y ciclo de vida.

## Matriz de aceptación local

| Caso | Resultado esperado | Estado |
|---|---|---|
| Modo API antes de Spawn | Sin FPS paralelo y `game.player === null` | NO VERIFICADO |
| Spawn de Personaje FPS | Un CharacterBody3D válido, scripts activos, cámara nativa | NO VERIFICADO |
| Segundo Spawn | Error sin otro cuerpo ni IDs nuevos | NO VERIFICADO |
| Otro Prefab sin cuerpo | Rechazo sin cambios | NO VERIFICADO |
| Fallo de Jolt o `_ready` | Instancia retirada, sin referencias fantasma | NO VERIFICADO |
| Destruir y reaparecer | Jolt libera/crea cuerpo sin reiniciar el mundo | NO VERIFICADO |
| STOP / cambio escena | No se guardan instancias dinámicas | NO VERIFICADO |
| Escena heredada / Sin jugador / FilmMaker | Paridad con comportamiento anterior | NO VERIFICADO |
| Electron y NGM Runtime independiente | Misma semántica de juego | NO VERIFICADO |

**Evidencia a devolver:** salida de Node, build, observaciones de Editor y NGM Runtime, `game.log`, capturas/vídeo de errores y confirmación de guardado/reapertura. Distinguir IMPLEMENTADO, TEST PASS, COMPILADO, QA LOCAL PASS, APROBADO y CERRADO.
