# LF-FPS-NATIVE-PLAYER-S16-G003 — implementación y QA

Fecha: 2026-11-11. Gate autorizado literalmente; QA usuario pendiente. Baseline de entrada: `LF_FPS_NATIVE_PLAYER_S16_G002_IDENTITY_API_CONTRACT_SOURCE_BASELINE.zip`.

## Contrato respetado

- Se amplió **el handle existente** de `src/engine/runtime/events/play-nodes.js`, solo para `characterbody3d`. No se creó otro controlador ni otro JoltWorld.
- El script puede consultar/asignar `node.velocity` (XYZ, m/s) y leer `node.ground` (`stable`/`steep`/`air`), `node.onFloor`, `node.onWall` y `node.onCeiling`.
- Cada acceso consulta `this.phys.nodeSpatial` y comprueba identidad del objeto, nodo de escena, sesión y activación. La velocidad la controla `NodeSpatialRuntime.setVelocity`; la lectura procede de `characterState`. No se guarda un estado espejo ni se escriben `obj.props`.
- `_physics_process` ya se ejecutaba antes del paso fijo `JoltWorld.step()`, que invoca `nodeSpatial.tick(dt)`. No se agregaron bucles, managers ni timers.
- G003 **no** implementa locomoción FPS integral, salto, Input Map, manos, Camera3D, `game.player` ni Prefab. `FpsPlayer` heredado permanece intacto.
- **NGM Runtime** designa la ejecución independiente del juego, no al personaje. No se renombraron ejecutables ni clases.

## Evidencia reproducible

| Prueba | Resultado |
|---|---|
| `node --test scripts/test-fps-native-player-s16-g003-characterbody3d-api.mjs` | **11 PASS / 0 FAIL** |
| `node --check` de `play-nodes.js` y del test nuevo | PASS |
| Regresión física histórica de 6 suites en baseline G002 (125 pruebas) | 111 PASS / 13 FAIL / 1 SKIP |
| La misma regresión física histórica en G003 (125 pruebas) | **111 PASS / 13 FAIL / 1 SKIP** (sin diferencias en los conteos) |
| Regresión ampliada G003, incluidas 11 pruebas nuevas | **122 PASS / 13 FAIL / 1 SKIP** |
| `node --test scripts/test-runtime-jolt-wasm-real-corr-g001.mjs` | BLOQUEADO: falta paquete `three`; **no prueba Jolt real** |
| `npm run build` | BLOQUEADO: `vite: not found` |
| `node scripts/gen-docs.mjs --check` | FAIL preexistente de documentos generados `comandos.md`, `api.md`; no se reescribieron fuera de alcance |
| QA Electron / NGM Runtime | NO VERIFICADO |

Los 13 fallos de regresión histórica se reproducen en el baseline G002 sin cambios. Destacan mocks antiguos sin `_tlSyncBrushes` y `_nodeEnabled` y el harness de runtime físico sin integración completa. **No** implican 13 defectos nuevos de G003, pero impiden llamar PASS a la suite completa.

Los logs íntegros están en `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G003/`. La prueba usa dobles; un PASS automatizado de este Gate no equivale a colisión real WASM ni QA visual.

## Fixture de escena

`scripts/fixtures/fps/s16-g003-characterbody3d-scene.json` es una **descripción de escenario para QA y pruebas**, no un archivo `.lfproj` directamente importable. Incluye suelo StaticBody3D + BoxShape3D, dos CharacterBody3D + cápsulas y dos scripts de nodo `_physics_process` con velocidades opuestas. Su árbol, asociación y sintaxis se comprueban en el test G003-11. No modifica proyectos de usuario.

## QA local requerido

1. En una **copia de prueba** del proyecto, instala las dependencias declaradas (`npm ci`) desde la raíz con `package.json` y ejecuta los tests anteriores; después `npm run build` y `npm run electron`.
2. Dentro del Editor, crea un suelo `StaticBody3D` con una `CollisionShape3D` Box. Añade dos `CharacterBody3D` con una única `CollisionShape3D` Capsule por cuerpo, cada uno con un Script de Nodo `_physics_process`. Usa la configuración del fixture como referencia, sin importarlo como proyecto.
3. Para A: `function _physics_process(delta) { const v = node.velocity; node.velocity = [1, v[1], 0]; }`. Para B: la misma función con `[-1, v[1], 0]`. Inicia Play sin seleccionar ninguno. Ambos cuerpos deben desplazarse sin selección ni controlador FPS especial.
4. Comprueba el contacto de suelo (`node.onFloor`), descenso por gravedad, obstáculos sólidos, independencia entre ambos personajes, pausa/reanudación, STOP y reinicio Play. Prueba entrada inválida: `node.velocity = [NaN, 0, 0]` debe informar error sin corromper estado.
5. Ejecuta en **NGM Runtime** independiente a partir de un juego exportado y compara el mismo comportamiento. No se requiere modificar exportación para G003.
6. Confirma que una escena FPS heredada aún funciona, con `game.player`, manos y cámara sin cambios.

**Evidencia a devolver:** resumen de Node, salida de compilación, observación de Editor Play y NGM Runtime, mensajes de consola/game.log y capturas o vídeo si falla. El usuario es responsable del QA local.

## Estado

**IMPLEMENTADO; TEST AUTOMATIZADO FOCAL PASS; COMPILACIÓN NO VERIFICADA; QA LOCAL NO VERIFICADO; APROBACIÓN PENDIENTE; G003 NO CERRADO.** G004 permanece no autorizado.
